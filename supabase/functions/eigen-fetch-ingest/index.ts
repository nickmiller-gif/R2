import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { guardAuth } from '../_shared/auth.ts';
import { requireRole } from '../_shared/rbac.ts';
import { sha256Hex } from '../_shared/eigen.ts';
import { POLICY_TAG_EIGEN_PUBLIC } from '../_shared/eigen-policy.ts';

interface FetchIngestRequest {
  url: string;
  source_system?: string;
  source_ref?: string;
  title?: string;
  policy_tags?: string[];
  entity_ids?: string[];
  chunking_mode?: 'hierarchical' | 'flat';
  embedding_model?: string;
}

function readAllowlist(): string[] {
  const raw = Deno.env.get('EIGEN_FETCH_ALLOWLIST') ?? '';
  return raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function readMaxFetchedChars(): number {
  const raw = Deno.env.get('EIGEN_FETCH_MAX_CHARS') ?? '200000';
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 5000) return 200000;
  return Math.min(n, 2_000_000);
}

function isAllowedHost(hostname: string, allowlist: string[]): boolean {
  const h = hostname.toLowerCase();
  return allowlist.some((allowed) => h === allowed || h.endsWith(`.${allowed}`));
}

function normalizeText(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractTitleFromHtml(html: string): string | null {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!match) return null;
  const title = decodeEntities(match[1] ?? '').trim();
  return title.length > 0 ? title : null;
}

function htmlToText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  const withLineBreaks = withoutScripts
    .replace(/<\/(p|div|section|article|li|h1|h2|h3|h4|h5|h6|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
  const noTags = withLineBreaks.replace(/<[^>]+>/g, ' ');
  return normalizeText(decodeEntities(noTags));
}

function toList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function parseRequest(value: unknown): FetchIngestRequest {
  if (!value || typeof value !== 'object') throw new Error('Request body must be a JSON object');
  const body = value as Record<string, unknown>;
  if (typeof body.url !== 'string' || body.url.trim().length === 0) {
    throw new Error('url is required');
  }
  return {
    url: body.url.trim(),
    source_system: typeof body.source_system === 'string' ? body.source_system.trim() : undefined,
    source_ref: typeof body.source_ref === 'string' ? body.source_ref.trim() : undefined,
    title: typeof body.title === 'string' ? body.title.trim() : undefined,
    policy_tags: toList(body.policy_tags),
    entity_ids: toList(body.entity_ids),
    chunking_mode: body.chunking_mode === 'flat' ? 'flat' : 'hierarchical',
    embedding_model: typeof body.embedding_model === 'string' ? body.embedding_model.trim() : undefined,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  const auth = await guardAuth(req);
  if (!auth.ok) return auth.response;
  const roleCheck = await requireRole(auth.claims.userId, 'member');
  if (!roleCheck.ok) return roleCheck.response;

  try {
    const body = parseRequest(await req.json());
    const targetUrl = new URL(body.url);
    if (targetUrl.protocol !== 'https:' && targetUrl.protocol !== 'http:') {
      return errorResponse('Only http(s) URLs are supported', 400);
    }

    const allowlist = readAllowlist();
    if (allowlist.length === 0) {
      return errorResponse('EIGEN_FETCH_ALLOWLIST is not configured', 500);
    }
    if (!isAllowedHost(targetUrl.hostname, allowlist)) {
      return errorResponse(`Host is not allowlisted: ${targetUrl.hostname}`, 403);
    }

    const fetchRes = await fetch(targetUrl.toString(), { redirect: 'follow' });
    if (!fetchRes.ok) {
      return errorResponse(`Failed to fetch URL: ${fetchRes.status}`, 400);
    }

    const contentType = (fetchRes.headers.get('content-type') ?? '').toLowerCase();
    const raw = await fetchRes.text();
    const maxChars = readMaxFetchedChars();
    const capped = raw.length > maxChars ? raw.slice(0, maxChars) : raw;

    const extractedBody = contentType.includes('html') ? htmlToText(capped) : normalizeText(capped);
    if (!extractedBody) {
      return errorResponse('Fetched content produced empty extracted text', 400);
    }

    const fallbackTitle =
      extractTitleFromHtml(capped) ??
      targetUrl.hostname;
    const chosenTitle = body.title && body.title.length > 0 ? body.title : fallbackTitle;

    const sourceSystem = body.source_system && body.source_system.length > 0
      ? body.source_system
      : `web:${targetUrl.hostname}`;
    const sourceRef = body.source_ref && body.source_ref.length > 0
      ? body.source_ref
      : targetUrl.toString();

    // HTTP(S) fetch may only index the public corpus. Dual-tagging with internal tiers would still
    // match public retrieval (policy filter is "any tag overlaps") and could expose non-public material.
    if (body.policy_tags && body.policy_tags.length > 0) {
      const onlyPublic = body.policy_tags.length === 1 &&
        body.policy_tags[0].trim().toLowerCase() === POLICY_TAG_EIGEN_PUBLIC;
      if (!onlyPublic) {
        return errorResponse(
          'eigen-fetch-ingest only supports public web content: omit policy_tags or use ["eigen_public"] only',
          400,
        );
      }
    }

    const ingestPayload = {
      source_system: sourceSystem,
      source_ref: sourceRef,
      document: {
        title: chosenTitle,
        body: extractedBody,
        content_type: contentType || 'text/html',
        metadata: {
          fetched_url: targetUrl.toString(),
          fetched_at: new Date().toISOString(),
          public_web_ingest: true,
        },
      },
      chunking_mode: body.chunking_mode ?? 'hierarchical',
      policy_tags: [POLICY_TAG_EIGEN_PUBLIC],
      entity_ids: body.entity_ids ?? [],
      embedding_model: body.embedding_model,
    };

    const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
    const idempotency = await sha256Hex(`${sourceSystem}|${sourceRef}|${targetUrl.toString()}`);
    const ingestRes = await fetch(`${supabaseUrl}/functions/v1/eigen-ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.headers.get('Authorization') ?? '',
        'x-idempotency-key': `fetch:${idempotency}`,
      },
      body: JSON.stringify(ingestPayload),
    });

    if (!ingestRes.ok) {
      const text = await ingestRes.text();
      return errorResponse(`eigen-ingest failed: ${text}`, 500);
    }

    const ingestData = await ingestRes.json();
    return jsonResponse({
      fetched_url: targetUrl.toString(),
      source_system: sourceSystem,
      source_ref: sourceRef,
      ingest: ingestData,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
