/**
 * Oracle whitespace core service.
 *
 * Backend-only orchestration service that composes shared Oracle intelligence
 * primitives (whitespace gaps, retrieval contracts, temporal drift,
 * evidence freshness, opportunity modeling, cross-run diff, verification core).
 */

import { identifyGaps, predictiveGapScore } from '../../lib/oracle/whitespace.ts';
import { filterByRelevance } from '../../lib/oracle/retrieval-contract.ts';
import { feedRescore } from '../../lib/oracle/evidence-freshness.ts';
import { scoreOpportunity, multiHorizonTiming } from '../../lib/oracle/opportunity.ts';
import { temporalDrift } from '../../lib/oracle/temporal.ts';
import { crossRunDiff } from '../../lib/oracle/cross-run-diff.ts';
import {
  assessEvidenceConsistency,
  classifyContradiction,
} from '../../lib/oracle/verification.ts';
import { nowUtc } from '../../lib/provenance/clock.ts';
import type {
  OracleWhitespaceCoreRun,
  OracleWhitespaceAnalysis,
  OracleWhitespaceAnalysisInput,
  CreateOracleWhitespaceCoreRunInput,
  OraclePredictiveGap,
  OracleWhitespaceGapContext,
} from '../../types/oracle/whitespace-core.ts';

export interface DbOracleWhitespaceCoreRow {
  id: string;
  entity_asset_id: string;
  run_label: string;
  analysis_json: OracleWhitespaceAnalysis;
  created_at: string;
  updated_at: string;
}

export interface OracleWhitespaceCoreDb {
  insertRun(row: DbOracleWhitespaceCoreRow): Promise<DbOracleWhitespaceCoreRow>;
  findRunById(id: string): Promise<DbOracleWhitespaceCoreRow | null>;
}

export interface OracleWhitespaceCoreService {
  analyze(input: OracleWhitespaceAnalysisInput): OracleWhitespaceAnalysis;
  createRun(input: CreateOracleWhitespaceCoreRunInput): Promise<OracleWhitespaceCoreRun>;
  getRunById(id: string): Promise<OracleWhitespaceCoreRun | null>;
}

export function rowToEntity(row: DbOracleWhitespaceCoreRow): OracleWhitespaceCoreRun {
  return {
    id: row.id,
    entityAssetId: row.entity_asset_id,
    runLabel: row.run_label,
    analysis: row.analysis_json,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

const DEFAULT_GAP_CONTEXT: OracleWhitespaceGapContext = {
  topicImportance: 50,
  recencyFactor: 0.5,
  closureEase: 0.5,
};

export function createOracleWhitespaceCoreService(
  db: OracleWhitespaceCoreDb,
): OracleWhitespaceCoreService {
  return {
    analyze(input) {
      const gaps = identifyGaps(input.coverage);

      const predictiveGaps: OraclePredictiveGap[] = gaps.map((gap) => {
        const context = input.gapContextsByTopicId?.[gap.topicId] ?? DEFAULT_GAP_CONTEXT;
        return {
          ...gap,
          context,
          predictiveScore: predictiveGapScore(gap, context),
        };
      });

      const retrievalMinRelevance = input.retrievalMinRelevance ?? 0.5;
      const retrievalQualified = filterByRelevance(
        input.retrievalResults ?? [],
        retrievalMinRelevance,
      );

      const freshnessReferenceTime = input.freshnessReferenceTime ?? nowUtc();
      const rescoreCandidates = feedRescore(
        input.evidenceAges ?? [],
        freshnessReferenceTime,
        input.freshnessHalfLifeDays,
      );

      const verification = assessEvidenceConsistency(input.verificationEvidence ?? []);
      const contradictionSeverity = classifyContradiction(
        verification.contradictionWeight,
        verification.validationWeight + verification.contradictionWeight,
      );

      const opportunity = scoreOpportunity(input.opportunitySignals ?? []);
      const opportunityTiming = multiHorizonTiming(
        opportunity.score,
        input.opportunityDaysToAction ?? 0,
      );

      const drift = temporalDrift(input.scoreSnapshots ?? []);
      const runDiff = crossRunDiff(input.previousRunEntries ?? [], input.currentRunEntries ?? []);
      const topPredictiveGapScore = predictiveGaps.length
        ? predictiveGaps.reduce(
            (maxScore, gap) => Math.max(maxScore, gap.predictiveScore),
            predictiveGaps[0]!.predictiveScore,
          )
        : null;

      return {
        gaps,
        predictiveGaps,
        retrievalQualified,
        rescoreCandidates,
        verification,
        contradictionSeverity,
        opportunity,
        opportunityTiming,
        temporalDrift: drift,
        runDiff,
        reasoning: {
          consistent: verification.consistent,
          contradictionRatio: verification.contradictionRatio,
          uncertaintyLevel: verification.uncertaintyLevel,
          contradictionSeverity,
          retrievalQualifiedCount: retrievalQualified.length,
          rescoreCandidateCount: rescoreCandidates.length,
        },
        temporalSignals: {
          trend: drift.trend,
          driftPerDay: drift.driftPerDay,
          windowDays: drift.windowDays,
          staleEvidenceCount: rescoreCandidates.length,
          freshnessReferenceTime: freshnessReferenceTime.toISOString(),
        },
        summary: {
          gapCount: gaps.length,
          predictiveGapCount: predictiveGaps.length,
          topPredictiveGapScore,
          retrievalQualifiedCount: retrievalQualified.length,
          rescoreCandidateCount: rescoreCandidates.length,
          opportunityScore: opportunity.score,
          trend: drift.trend,
          addedCount: runDiff.added.length,
          removedCount: runDiff.removed.length,
        },
      };
    },

    async createRun(input) {
      const now = nowUtc().toISOString();
      const row = await db.insertRun({
        id: crypto.randomUUID(),
        entity_asset_id: input.entityAssetId,
        run_label: input.runLabel,
        analysis_json: input.analysis,
        created_at: now,
        updated_at: now,
      });

      return rowToEntity(row);
    },

    async getRunById(id) {
      const row = await db.findRunById(id);
      return row ? rowToEntity(row) : null;
    },
  };
}
