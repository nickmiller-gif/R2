/**
 * Oracle read model service for briefing/theme/feed projections.
 */
import type {
  OracleBriefingFilter,
  OracleBriefingItem,
  OracleThemeMapFilter,
  OracleThemeMapItem,
  OracleFeedHistoryFilter,
  OracleFeedHistoryItem,
} from '../../types/oracle/read-models.js';
import { parseJsonbField } from './oracle-db-utils.js';

export interface DbOracleBriefingRow {
  thesis_id: string;
  title: string;
  thesis_statement: string;
  confidence: number;
  evidence_strength: number;
  published_at: string;
  published_by: string | null;
  topic_tags: string[];
}

export interface DbOracleThemeMapRow {
  theme: string;
  thesis_count: number;
  avg_confidence: number;
  latest_published_at: string | null;
}

export interface DbOracleFeedHistoryRow {
  item_type: 'thesis' | 'signal' | 'outcome';
  item_id: string;
  published_at: string;
  title: string;
  summary: string | null;
  metadata: unknown;
}

export interface OracleReadModelDb {
  queryBriefings(filter?: OracleBriefingFilter): Promise<DbOracleBriefingRow[]>;
  queryThemeMap(filter?: OracleThemeMapFilter): Promise<DbOracleThemeMapRow[]>;
  queryFeedHistory(filter?: OracleFeedHistoryFilter): Promise<DbOracleFeedHistoryRow[]>;
}

export interface OracleReadModelService {
  listBriefings(filter?: OracleBriefingFilter): Promise<OracleBriefingItem[]>;
  listThemeMap(filter?: OracleThemeMapFilter): Promise<OracleThemeMapItem[]>;
  listFeedHistory(filter?: OracleFeedHistoryFilter): Promise<OracleFeedHistoryItem[]>;
}

function rowToBriefing(row: DbOracleBriefingRow): OracleBriefingItem {
  return {
    thesisId: row.thesis_id,
    title: row.title,
    thesisStatement: row.thesis_statement,
    confidence: row.confidence,
    evidenceStrength: row.evidence_strength,
    publishedAt: new Date(row.published_at),
    publishedBy: row.published_by,
    topicTags: row.topic_tags,
  };
}

function rowToThemeMap(row: DbOracleThemeMapRow): OracleThemeMapItem {
  return {
    theme: row.theme,
    thesisCount: row.thesis_count,
    avgConfidence: row.avg_confidence,
    latestPublishedAt: row.latest_published_at ? new Date(row.latest_published_at) : null,
  };
}

function rowToFeedHistory(row: DbOracleFeedHistoryRow): OracleFeedHistoryItem {
  return {
    itemType: row.item_type,
    itemId: row.item_id,
    publishedAt: new Date(row.published_at),
    title: row.title,
    summary: row.summary,
    metadata: parseJsonbField(row.metadata),
  };
}

export function createOracleReadModelService(db: OracleReadModelDb): OracleReadModelService {
  return {
    async listBriefings(filter) {
      const rows = await db.queryBriefings(filter);
      return rows.map(rowToBriefing);
    },
    async listThemeMap(filter) {
      const rows = await db.queryThemeMap(filter);
      return rows.map(rowToThemeMap);
    },
    async listFeedHistory(filter) {
      const rows = await db.queryFeedHistory(filter);
      return rows.map(rowToFeedHistory);
    },
  };
}

