import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { verifyWidgetSessionToken } from '../_shared/widget-session.ts';

interface FeedbackRequest {
  widget_token: string;
  turn_id: string;
  value: -1 | 1;
  note?: string;
}

function parseRequest(value: unknown): FeedbackRequest {
  if (!value || typeof value !== 'object') throw new Error('Request body must be a JSON object');
  const body = value as Record<string, unknown>;
  if (typeof body.widget_token !== 'string' || body.widget_token.trim().length === 0) {
    throw new Error('widget_token is required');
  }
  if (typeof body.turn_id !== 'string' || body.turn_id.trim().length === 0) {
    throw new Error('turn_id is required');
  }
  if (body.value !== -1 && body.value !== 1) {
    throw new Error('value must be -1 or 1');
  }

  return {
    widget_token: body.widget_token.trim(),
    turn_id: body.turn_id.trim(),
    value: body.value,
    note: typeof body.note === 'string' ? body.note.trim() : undefined,
  };
}

function classifyRequestError(message: string): number {
  if (
    message.includes('Request body') ||
    message.includes('widget_token is required') ||
    message.includes('turn_id is required') ||
    message.includes('value must be -1 or 1')
  ) {
    return 400;
  }
  if (message.includes('Widget session token')) {
    return 401;
  }
  return 500;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    const body = parseRequest(await req.json());
    const claims = await verifyWidgetSessionToken(body.widget_token);
    const origin = (req.headers.get('origin') ?? '').replace(/\/+$/, '').toLowerCase();
    if (!origin || origin !== claims.origin) {
      return errorResponse('Widget origin mismatch', 403);
    }

    const client = getServiceClient();
    const { data: turn, error: turnError } = await client
      .from('conversation_turn')
      .select('id,site_id')
      .eq('id', body.turn_id)
      .single();
    if (turnError || !turn) return errorResponse('Turn not found', 404);
    if ((turn as { site_id: string | null }).site_id !== claims.site_id) {
      return errorResponse('Turn/site mismatch', 403);
    }

    const { error } = await client.from('conversation_turn_feedback').insert({
      turn_id: body.turn_id,
      value: body.value,
      note: body.note ?? null,
    });
    if (error) return errorResponse(error.message, 500);

    const { error: updateError } = await client
      .from('conversation_turn')
      .update({
        feedback_value: body.value,
        feedback_text: body.note ?? null,
      })
      .eq('id', body.turn_id);
    if (updateError) return errorResponse(updateError.message, 500);

    return jsonResponse({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, classifyRequestError(message));
  }
});
