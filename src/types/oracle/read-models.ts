/**
 * Oracle read models for operator/frontend consumption.
 */

export interface OracleBriefingItem {
  thesisId: string;
  title: string;
  thesisStatement: string;
  confidence: number;
  evidenceStrength: number;
  publishedAt: Date;
  publishedBy: string | null;
  topicTags: string[];
}

export interface OracleThemeMapItem {
  theme: string;
  thesisCount: number;
  avgConfidence: number;
  latestPublishedAt: Date | null;
}

export type OracleFeedItemType = 'thesis' | 'signal' | 'outcome';

export interface OracleFeedHistoryItem {
  itemType: OracleFeedItemType;
  itemId: string;
  publishedAt: Date;
  title: string;
  summary: string | null;
  metadata: Record<string, unknown>;
}

export interface OracleBriefingFilter {
  limit?: number;
}

export interface OracleThemeMapFilter {
  minThesisCount?: number;
}

export interface OracleFeedHistoryFilter {
  limit?: number;
  since?: Date;
}

