import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { completeLlmChat } from '../_shared/llm-chat.ts';
import { sha256Hex } from '../_shared/eigen.ts';

interface CaptureRequest {
  source_url: string;
  page_title?: string;
  raw_excerpt: string;
  session_label?: string;
  oracle_run_id?: string;
  charter_decision_id?: string;
  metadata?: Record<string, unknown>;
}

function parseRequest(value: unknown): CaptureRequest {
  if (!value || typeof value !== 'object') throw new Error('Request body must be an object');
  const body = value as Record<string, unknown>;
  if (typeof body.source_url !== 'string' || body.source_url.trim().length === 0) {
    throw new Error('source_url is required');
  }
  if (typeof body.raw_excerpt !== 'string' || body.raw_excerpt.trim().length === 0) {
    throw new Error('raw_excerpt is required');
  }
  return {
    source_url: body.source_url.trim(),
    page_title: typeof body.page_title === 'string' ? body.page_title.trim() : undefined,
    raw_excerpt: body.raw_excerpt.trim(),
    session_label: typeof body.session_label === 'string' ? body.session_label.trim() : undefined,
    oracle_run_id: typeof body.oracle_run_id === 'string' ? body.oracle_run_id.trim() : undefined,
    charter_decision_id:
      typeof body.charter_decision_id === 'string' ? body.charter_decision_id.trim() : undefined,
    metadata: body.metadata && typeof body.metadata === 'object'
      ? (body.metadata as Record<string, unknown>)
      : {},
  };
}

async function summarizeCapture(input: CaptureRequest): Promise<{ summary: string; model: string }> {
  const prompt = [
    `URL: ${input.source_url}`,
    input.page_title ? `Page title: ${input.page_title}` : null,
    '',
    input.raw_excerpt,
  ].filter(Boolean).join('\n');
  const result = await completeLlmChat({
    provider: 'openai',
    model: Deno.env.get('AUTONOMOUS_CAPTURE_SUMMARY_MODEL') ?? undefined,
    systemPrompt:
      'Summarize capture content in 3-5 concise bullets. Keep factual claims grounded and avoid speculation.',
    userContent: prompt,
    maxTokens: 500,
    temperature: 0.1,
  });
  return { summary: result.text, model: result.model };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;
  const role = await requireRole(auth.claims.userId, 'member');
  if (!role.ok) return role.response;

  try {
    const body = parseRequest(await req.json());
    const client = getServiceClient();
    const fingerprint = await sha256Hex(`${body.source_url}\u001f${body.raw_excerpt}`);

    const summaryResult = await summarizeCapture(body);

    const upsertCapture = await client
      .from('autonomous_captures')
      .upsert(
        {
          owner_id: auth.claims.userId,
          source_url: body.source_url,
          page_title: body.page_title ?? null,
          content_fingerprint: fingerprint,
          raw_excerpt: body.raw_excerpt,
          summary: summaryResult.summary,
          summary_model: summaryResult.model,
          confidence_label: 'medium',
          session_label: body.session_label ?? null,
          oracle_run_id: body.oracle_run_id ?? null,
          charter_decision_id: body.charter_decision_id ?? null,
          metadata: body.metadata ?? {},
          ingest_status: 'pending',
        },
        { onConflict: 'owner_id,content_fingerprint' },
      )
      .select('id,summary,summary_model,source_url,page_title')
      .single();
    if (upsertCapture.error) return errorResponse(upsertCapture.error.message, 400);
    const capture = upsertCapture.data as { id: string; summary: string; summary_model: string };

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRole) {
      return errorResponse('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY', 500);
    }

    const ingestRes = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/functions/v1/eigen-ingest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRole}`,
        'Content-Type': 'application/json',
        'x-idempotency-key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        source_system: 'autonomous_os_extension',
        source_ref: `capture:${capture.id}`,
        policy_tags: ['eigenx', 'user_upload', 'autonomous_capture'],
        document: {
          title: body.page_title || body.source_url,
          body: summaryResult.summary,
          metadata: {
            source_url: body.source_url,
            capture_id: capture.id,
            summary_model: summaryResult.model,
            capture_kind: 'browser_extension',
            ...body.metadata,
          },
        },
      }),
    });

    if (!ingestRes.ok) {
      const ingestErr = await ingestRes.text();
      await client
        .from('autonomous_captures')
        .update({ ingest_status: 'failed', ingest_error: ingestErr })
        .eq('id', capture.id);
      return errorResponse(`eigen-ingest failed: ${ingestErr}`, 500);
    }

    const ingestPayload = await ingestRes.json() as { document_id?: string };
    await client
      .from('autonomous_captures')
      .update({
        ingest_status: 'ingested',
        ingest_error: null,
        ingested_document_id: ingestPayload.document_id ?? null,
        ingested_at: new Date().toISOString(),
      })
      .eq('id', capture.id);

    return jsonResponse({
      capture_id: capture.id,
      summary: capture.summary,
      summary_model: capture.summary_model,
      ingest: ingestPayload,
    }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
