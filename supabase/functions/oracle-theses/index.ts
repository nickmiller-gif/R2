import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import { clusterSignals } from '../_shared/oracle/clusterSignals.ts';
import { buildWhitespaceFrame } from '../_shared/oracle/buildWhitespaceFrame.ts';
import { scoreWhitespace } from '../_shared/oracle/scoreWhitespace.ts';
import { buildOpportunityPortfolio } from '../_shared/oracle/buildOpportunityPortfolio.ts';
import { persistOpportunities } from '../_shared/oracle/persistOpportunities.ts';
import { stageErr, type StageResult, type ThesisSnapshot } from '../_shared/oracle/types.ts';

async function runPortfolioBuild(client: ReturnType<typeof getServiceClient>): Promise<StageResult<unknown>> {
  const { data: theses, error } = await client
    .from('oracle_theses')
    .select(
      'id, profile_id, title, thesis_statement, confidence, evidence_strength, validation_evidence_item_ids, contradiction_evidence_item_ids, metadata',
    )
    .neq('status', 'retired')
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error || !theses) {
    return stageErr('portfolio_build', 'THESIS_LOAD_FAILED', error?.message ?? 'Failed to load theses.', true);
  }

  const clustered = clusterSignals(theses as ThesisSnapshot[]);
  if (!clustered.ok) return clustered;

  const framed = buildWhitespaceFrame(clustered.data);
  if (!framed.ok) return framed;

  const scored = scoreWhitespace(framed.data);
  if (!scored.ok) return scored;

  const byId = new Map((theses as ThesisSnapshot[]).map((thesis) => [thesis.id, thesis]));
  const portfolio = buildOpportunityPortfolio(scored.data, byId);
  if (!portfolio.ok) return portfolio;

  const persisted = await persistOpportunities(client, portfolio.data);
  if (!persisted.ok) return persisted;

  return {
    ok: true,
    data: {
      processed_thesis_count: theses.length,
      upserted_opportunity_count: persisted.data.length,
      opportunities: persisted.data,
    },
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsResponse();
  }

  const auth = guardAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const thesisId = url.searchParams.get('id');

    const client = req.method === 'GET' ? getSupabaseClient(req) : getServiceClient();

    if (req.method === 'GET') {
      if (thesisId) {
        const { data, error } = await client
          .from('oracle_theses')
          .select('*')
          .eq('id', thesisId)
          .single();

        if (error) {
          return errorResponse(error.message, 404);
        }

        return jsonResponse(data);
      } else {
        const profileId = url.searchParams.get('profile_id');
        const status = url.searchParams.get('status');
        const publicationState = url.searchParams.get('publication_state');
        const noveltyStatus = url.searchParams.get('novelty_status');

        let query = client.from('oracle_theses').select('*');

        if (profileId) query = query.eq('profile_id', profileId);
        if (status) query = query.eq('status', status);
        if (publicationState) query = query.eq('publication_state', publicationState);
        if (noveltyStatus) query = query.eq('novelty_status', noveltyStatus);

        const { data, error } = await query;

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      }
    } else if (req.method === 'POST') {
      const body = await req.json();

      if (action === 'portfolio_build') {
        const result = await runPortfolioBuild(getServiceClient());
        if (!result.ok) {
          return jsonResponse({ ok: false, error: result.error }, 500);
        }
        return jsonResponse({ ok: true, ...result.data });
      }

      if (action === 'publish') {
        if (!body.published_by) {
          return errorResponse('published_by required', 400);
        }

        const thesisId = body.id;
        if (!thesisId) {
          return errorResponse('id required in body', 400);
        }

        const { data, error } = await client
          .from('oracle_theses')
          .update({
            publication_state: 'published',
            published_by: body.published_by,
            published_at: new Date().toISOString(),
          })
          .eq('id', thesisId)
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      } else if (action === 'challenge') {
        const thesisId = body.id;
        if (!thesisId) {
          return errorResponse('id required in body', 400);
        }

        const { data, error } = await client
          .from('oracle_theses')
          .update({ status: 'challenged' })
          .eq('id', thesisId)
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      } else if (action === 'supersede') {
        if (!body.superseded_by_thesis_id) {
          return errorResponse('superseded_by_thesis_id required', 400);
        }

        const thesisId = body.id;
        if (!thesisId) {
          return errorResponse('id required in body', 400);
        }

        const { data, error } = await client
          .from('oracle_theses')
          .update({
            status: 'superseded',
            superseded_by_thesis_id: body.superseded_by_thesis_id,
          })
          .eq('id', thesisId)
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data);
      } else {
        const { data, error } = await client
          .from('oracle_theses')
          .insert([body])
          .select()
          .single();

        if (error) {
          return errorResponse(error.message, 400);
        }

        return jsonResponse(data, 201);
      }
    } else if (req.method === 'PATCH') {
      const body = await req.json();
      const thesisId = body.id;

      if (!thesisId) {
        return errorResponse('id required in body', 400);
      }

      const { data, error } = await client
        .from('oracle_theses')
        .update(body)
        .eq('id', thesisId)
        .select()
        .single();

      if (error) {
        return errorResponse(error.message, 400);
      }

      return jsonResponse(data);
    } else {
      return errorResponse('Method not allowed', 405);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(message, 500);
  }
});
