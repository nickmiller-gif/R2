import { beforeEach, describe, expect, it } from 'vitest';
import {
  createOracleThesisConfidenceService,
  type DbOracleEvidenceItemLite,
  type DbOracleOutcomeLite,
  type DbOracleThesisConfidenceHistoryRow,
  type DbOracleThesisEvidenceLinkLite,
  type DbOracleThesisLite,
  type OracleThesisConfidenceDb,
} from '../../src/services/oracle/oracle-thesis-confidence.service.js';

interface MockState {
  theses: DbOracleThesisLite[];
  links: DbOracleThesisEvidenceLinkLite[];
  evidence: DbOracleEvidenceItemLite[];
  outcomes: DbOracleOutcomeLite[];
  history: DbOracleThesisConfidenceHistoryRow[];
  thesisUpdates: Array<{ id: string; confidence: number; updatedAt: string }>;
}

function makeDb(seed: Partial<MockState> = {}): OracleThesisConfidenceDb & { state: MockState } {
  const state: MockState = {
    theses: seed.theses ?? [],
    links: seed.links ?? [],
    evidence: seed.evidence ?? [],
    outcomes: seed.outcomes ?? [],
    history: seed.history ?? [],
    thesisUpdates: seed.thesisUpdates ?? [],
  };

  return {
    state,
    async findThesisById(id) {
      return state.theses.find((t) => t.id === id) ?? null;
    },
    async updateThesisConfidence(id, confidence, updatedAt) {
      state.thesisUpdates.push({ id, confidence, updatedAt });
      const idx = state.theses.findIndex((t) => t.id === id);
      if (idx >= 0) state.theses[idx] = { ...state.theses[idx]!, confidence };
    },
    async findEvidenceLinkById(id) {
      return state.links.find((l) => l.id === id) ?? null;
    },
    async findEvidenceItemById(id) {
      return state.evidence.find((e) => e.id === id) ?? null;
    },
    async findOutcomeById(id) {
      return state.outcomes.find((o) => o.id === id) ?? null;
    },
    async insertHistory(row) {
      state.history.push(row);
      return row;
    },
    async findHistoryByEvidenceLink(thesisId, evidenceLinkId) {
      return (
        state.history.find(
          (h) => h.thesis_id === thesisId && h.evidence_link_id === evidenceLinkId,
        ) ?? null
      );
    },
    async findHistoryByOutcome(thesisId, outcomeId) {
      return (
        state.history.find((h) => h.thesis_id === thesisId && h.outcome_id === outcomeId) ?? null
      );
    },
    async findHistoryByThesis(thesisId) {
      return state.history.filter((h) => h.thesis_id === thesisId);
    },
  };
}

const THESIS_ID = 't-1';
const LINK_ID = 'l-1';
const EVIDENCE_ID = 'e-1';
const OUTCOME_ID = 'o-1';

describe('createOracleThesisConfidenceService.recalibrateForEvidence', () => {
  let db: ReturnType<typeof makeDb>;

  beforeEach(() => {
    db = makeDb({
      theses: [{ id: THESIS_ID, confidence: 50 }],
      links: [
        {
          id: LINK_ID,
          thesis_id: THESIS_ID,
          evidence_item_id: EVIDENCE_ID,
          role: 'validation',
          weight: 1,
        },
      ],
      evidence: [{ id: EVIDENCE_ID, confidence: 80, evidence_strength: 80 }],
    });
  });

  it('writes a history row and updates the thesis confidence on first call', async () => {
    const svc = createOracleThesisConfidenceService(db);
    const outcome = await svc.recalibrateForEvidence({
      thesisId: THESIS_ID,
      evidenceLinkId: LINK_ID,
    });

    expect(outcome.recalibrated).toBe(true);
    expect(outcome.entry.priorConfidence).toBe(50);
    expect(outcome.entry.newConfidence).toBeGreaterThan(50);
    expect(outcome.entry.source).toBe('evidence_link');
    expect(outcome.entry.evidenceLinkId).toBe(LINK_ID);
    expect(outcome.entry.outcomeId).toBeNull();
    expect(outcome.entry.recalibrationMethod).toBe('bayesian-v1');
    expect(db.state.history).toHaveLength(1);
    expect(db.state.thesisUpdates).toHaveLength(1);
    expect(db.state.thesisUpdates[0]?.confidence).toBe(outcome.entry.newConfidence);
  });

  it('is idempotent: a second call for the same link returns the existing row without writing', async () => {
    const svc = createOracleThesisConfidenceService(db);
    const first = await svc.recalibrateForEvidence({
      thesisId: THESIS_ID,
      evidenceLinkId: LINK_ID,
    });
    const second = await svc.recalibrateForEvidence({
      thesisId: THESIS_ID,
      evidenceLinkId: LINK_ID,
    });

    expect(second.recalibrated).toBe(false);
    expect(second.entry.id).toBe(first.entry.id);
    expect(db.state.history).toHaveLength(1);
    expect(db.state.thesisUpdates).toHaveLength(1);
  });

  it('does not update the thesis confidence for an inspiration-role link', async () => {
    db.state.links[0]!.role = 'inspiration';
    const svc = createOracleThesisConfidenceService(db);
    const outcome = await svc.recalibrateForEvidence({
      thesisId: THESIS_ID,
      evidenceLinkId: LINK_ID,
    });
    expect(outcome.entry.delta).toBe(0);
    expect(db.state.thesisUpdates).toHaveLength(0);
    expect(db.state.history).toHaveLength(1);
  });

  it('throws when the thesis is missing', async () => {
    db.state.theses = [];
    const svc = createOracleThesisConfidenceService(db);
    await expect(
      svc.recalibrateForEvidence({ thesisId: THESIS_ID, evidenceLinkId: LINK_ID }),
    ).rejects.toThrow(/OracleThesis not found/);
  });

  it('throws when the link points at a different thesis', async () => {
    db.state.links[0]!.thesis_id = 'other-thesis';
    const svc = createOracleThesisConfidenceService(db);
    await expect(
      svc.recalibrateForEvidence({ thesisId: THESIS_ID, evidenceLinkId: LINK_ID }),
    ).rejects.toThrow(/different thesis/);
  });
});

describe('createOracleThesisConfidenceService.recalibrateForOutcome', () => {
  let db: ReturnType<typeof makeDb>;

  beforeEach(() => {
    db = makeDb({
      theses: [{ id: THESIS_ID, confidence: 40 }],
      outcomes: [
        { id: OUTCOME_ID, thesis_id: THESIS_ID, verdict: 'confirmed', accuracy_score: null },
      ],
    });
  });

  it('raises confidence on a confirmed verdict and persists the history row', async () => {
    const svc = createOracleThesisConfidenceService(db);
    const outcome = await svc.recalibrateForOutcome({
      thesisId: THESIS_ID,
      outcomeId: OUTCOME_ID,
    });
    expect(outcome.recalibrated).toBe(true);
    expect(outcome.entry.priorConfidence).toBe(40);
    expect(outcome.entry.newConfidence).toBeGreaterThan(40);
    expect(outcome.entry.source).toBe('outcome');
    expect(outcome.entry.outcomeId).toBe(OUTCOME_ID);
    expect(outcome.entry.evidenceLinkId).toBeNull();
    expect(db.state.thesisUpdates[0]?.confidence).toBe(outcome.entry.newConfidence);
  });

  it('is idempotent across repeated calls for the same outcome', async () => {
    const svc = createOracleThesisConfidenceService(db);
    const first = await svc.recalibrateForOutcome({
      thesisId: THESIS_ID,
      outcomeId: OUTCOME_ID,
    });
    const second = await svc.recalibrateForOutcome({
      thesisId: THESIS_ID,
      outcomeId: OUTCOME_ID,
    });
    expect(second.recalibrated).toBe(false);
    expect(second.entry.id).toBe(first.entry.id);
    expect(db.state.history).toHaveLength(1);
  });

  it('uses accuracy_score (0-100) as a confidence-in-the-outcome factor', async () => {
    db.state.outcomes[0]!.accuracy_score = 25;
    const svc = createOracleThesisConfidenceService(db);
    const tentative = await svc.recalibrateForOutcome({
      thesisId: THESIS_ID,
      outcomeId: OUTCOME_ID,
    });

    const fullDb = makeDb({
      theses: [{ id: THESIS_ID, confidence: 40 }],
      outcomes: [
        { id: OUTCOME_ID, thesis_id: THESIS_ID, verdict: 'confirmed', accuracy_score: 100 },
      ],
    });
    const fullSvc = createOracleThesisConfidenceService(fullDb);
    const certain = await fullSvc.recalibrateForOutcome({
      thesisId: THESIS_ID,
      outcomeId: OUTCOME_ID,
    });

    expect(certain.entry.delta).toBeGreaterThan(tentative.entry.delta);
  });

  it('throws when the outcome points at a different thesis', async () => {
    db.state.outcomes[0]!.thesis_id = 'other-thesis';
    const svc = createOracleThesisConfidenceService(db);
    await expect(
      svc.recalibrateForOutcome({ thesisId: THESIS_ID, outcomeId: OUTCOME_ID }),
    ).rejects.toThrow(/different thesis/);
  });

  it('does not update the thesis confidence for an inconclusive verdict', async () => {
    db.state.outcomes[0]!.verdict = 'inconclusive';
    const svc = createOracleThesisConfidenceService(db);
    const outcome = await svc.recalibrateForOutcome({
      thesisId: THESIS_ID,
      outcomeId: OUTCOME_ID,
    });
    expect(outcome.entry.delta).toBe(0);
    expect(db.state.thesisUpdates).toHaveLength(0);
  });
});

describe('createOracleThesisConfidenceService.listHistory', () => {
  it('returns history rows scoped to one thesis', async () => {
    const db = makeDb({
      theses: [
        { id: 'a', confidence: 50 },
        { id: 'b', confidence: 50 },
      ],
      links: [
        { id: 'la', thesis_id: 'a', evidence_item_id: 'ea', role: 'validation', weight: 1 },
        { id: 'lb', thesis_id: 'b', evidence_item_id: 'eb', role: 'validation', weight: 1 },
      ],
      evidence: [
        { id: 'ea', confidence: 60, evidence_strength: 60 },
        { id: 'eb', confidence: 60, evidence_strength: 60 },
      ],
    });
    const svc = createOracleThesisConfidenceService(db);
    await svc.recalibrateForEvidence({ thesisId: 'a', evidenceLinkId: 'la' });
    await svc.recalibrateForEvidence({ thesisId: 'b', evidenceLinkId: 'lb' });

    const onlyA = await svc.listHistory('a');
    expect(onlyA).toHaveLength(1);
    expect(onlyA[0]?.thesisId).toBe('a');
  });
});
