import {
  stageErr,
  stageOk,
  type ClusteredSignal,
  type StageResult,
  type ThesisSnapshot,
} from './types.ts';

function parseIdList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function clusterSignals(theses: ThesisSnapshot[]): StageResult<ClusteredSignal[]> {
  try {
    const clustered = theses.map((thesis) => {
      const metadata = thesis.metadata ?? {};
      const validation = parseIdList(thesis.validation_evidence_item_ids);
      const contradiction = parseIdList(thesis.contradiction_evidence_item_ids);
      return {
        thesisId: thesis.id,
        profileId: thesis.profile_id,
        title: thesis.title,
        buyer: String(metadata.buyer ?? 'unknown buyer'),
        offer: String(metadata.offer ?? thesis.thesis_statement),
        channel: String(metadata.channel ?? 'direct'),
        confidenceThesis: Math.max(0, Math.min(100, thesis.confidence ?? 0)),
        evidenceStrength: Math.max(0, Math.min(100, thesis.evidence_strength ?? 0)),
        validationCount: validation.length,
        contradictionCount: contradiction.length,
      };
    });

    return stageOk(clustered);
  } catch (error) {
    return stageErr('clusterSignals', 'CLUSTER_FAILED', 'Failed to cluster thesis signals.', true, error);
  }
}
