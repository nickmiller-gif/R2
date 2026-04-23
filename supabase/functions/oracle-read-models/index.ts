import { corsResponse, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';
import { guardAuth } from '../_shared/auth.ts';
import {
  createOracleReadModelService,
  type DbOracleBriefingRow,
  type DbOracleFeedHistoryRow,
  type DbOracleThemeMapRow,
  type OracleReadModelDb,
} from '../../../src/services/oracle/oracle-read-model.service.ts';
import type {
  OracleBriefingFilter,
  OracleFeedHistoryFilter,
  OracleThemeMapFilter,
} from '../../../src/types/oracle/read-models.ts';
import { withRequestMeta } from '../_shared/correlation.ts';

const ORACLE_BRIEFINGS_READ_MODEL_COLUMNS =
  'thesis_id,title,thesis_statement,confidence,evidence_strength,published_at,published_by,topic_tags';
const ORACLE_THEME_MAP_READ_MODEL_COLUMNS = 'theme,thesis_count,avg_confidence,latest_published_at';
const ORACLE_FEED_HISTORY_READ_MODEL_COLUMNS =
  'item_type,item_id,published_at,title,summary,metadata';

function createReadModelDb(client: ReturnType<typeof getSupabaseClient>): OracleReadModelDb {
  return {
    async queryBriefings(filter?: OracleBriefingFilter): Promise<DbOracleBriefingRow[]> {
      const limit = Math.min(Math.max(filter?.limit ?? 100, 1), 1000);
      const { data, error } = await client
        .from('oracle_briefings_read_model')
        .select(ORACLE_BRIEFINGS_READ_MODEL_COLUMNS)
        .order('published_at', { ascending: false })
        .limit(limit);

      if (error) throw new Error(error.message);
      return (data ?? []) as DbOracleBriefingRow[];
    },

    async queryThemeMap(filter?: OracleThemeMapFilter): Promise<DbOracleThemeMapRow[]> {
      let q = client
        .from('oracle_theme_map_read_model')
        .select(ORACLE_THEME_MAP_READ_MODEL_COLUMNS)
        .order('latest_published_at', { ascending: false });
      if (filter?.minThesisCount !== undefined) {
        q = q.gte('thesis_count', filter.minThesisCount);
      }
      const { data, error } = await q;

      if (error) throw new Error(error.message);
      return (data ?? []) as DbOracleThemeMapRow[];
    },

    async queryFeedHistory(filter?: OracleFeedHistoryFilter): Promise<DbOracleFeedHistoryRow[]> {
      const limit = Math.min(Math.max(filter?.limit ?? 100, 1), 1000);
      let q = client
        .from('oracle_feed_history_read_model')
        .select(ORACLE_FEED_HISTORY_READ_MODEL_COLUMNS)
        .order('published_at', { ascending: false })
        .limit(limit);

      if (filter?.since) {
        q = q.gte('published_at', filter.since.toISOString());
      }

      const { data, error } = await q;

      if (error) throw new Error(error.message);
      return (data ?? []) as DbOracleFeedHistoryRow[];
    },
  };
}

Deno.serve(
  withRequestMeta(async (req) => {
    if (req.method === 'OPTIONS') {
      return corsResponse();
    }

    const auth = await guardAuth(req);
    if (!auth.ok) return auth.response;

    if (req.method !== 'GET') {
      return errorResponse('Method not allowed', 405);
    }

    try {
      const url = new URL(req.url);
      const kind = url.searchParams.get('kind') ?? 'briefings';

      const client = getSupabaseClient(req);
      const readModels = createOracleReadModelService(createReadModelDb(client));

      const limitParam = url.searchParams.get('limit');
      const limit = limitParam ? parseInt(limitParam, 10) : undefined;
      if (limitParam !== null && limitParam !== '' && (Number.isNaN(limit!) || limit! < 1)) {
        return errorResponse('limit must be a positive integer', 400);
      }

      const minThesisCountParam = url.searchParams.get('min_thesis_count');
      const minThesisCount = minThesisCountParam ? parseInt(minThesisCountParam, 10) : undefined;
      if (
        minThesisCountParam !== null &&
        minThesisCountParam !== '' &&
        (Number.isNaN(minThesisCount!) || minThesisCount! < 0)
      ) {
        return errorResponse('min_thesis_count must be a non-negative integer', 400);
      }

      const sinceParam = url.searchParams.get('since');
      let since: Date | undefined;
      if (sinceParam) {
        since = new Date(sinceParam);
        if (Number.isNaN(since.getTime())) {
          return errorResponse('since must be a valid ISO-8601 date', 400);
        }
      }

      if (kind === 'briefings') {
        const rows = await readModels.listBriefings({ limit });
        return jsonResponse(rows);
      }

      if (kind === 'theme_map') {
        const rows = await readModels.listThemeMap(
          minThesisCount !== undefined ? { minThesisCount } : undefined,
        );
        return jsonResponse(rows);
      }

      if (kind === 'feed_history' || kind === 'feed') {
        const rows = await readModels.listFeedHistory({ limit, since });
        return jsonResponse(rows);
      }

      return errorResponse('kind must be briefings, theme_map, or feed_history', 400);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return errorResponse(message, 500);
    }
  }),
);
