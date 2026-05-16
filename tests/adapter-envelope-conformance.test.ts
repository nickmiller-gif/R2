import { describe, expect, it } from 'vitest';
import type { EigenIngestRequest } from '../src/adapters/eigen-ingest-client.js';
import {
  mapRaysRetreatEventToEigen,
  mapThoughtPieceToEigen,
} from '../src/adapters/raysretreat/eigen-raysretreat-adapter.js';
import { mapIpEventToEigenDocument } from '../src/adapters/ip-insights-hub/eigen-ip-adapter.js';
import { mapCentralR2EventToEigen } from '../src/adapters/centralr2-core/eigen-centralr2-adapter.js';
import { mapR2AppEventToEigen } from '../src/adapters/r2app/eigen-r2app-adapter.js';
import { mapHealthSupplementTrendToEigen } from '../src/adapters/health-supplement-tr/eigen-health-supplement-adapter.js';
import { mapSmartplrxTrendToEigen } from '../src/adapters/smartplrx-trend-tracker/eigen-smartplrx-adapter.js';
import { mapOracleOperatorEventToEigenDocument } from '../src/adapters/oracle-operator/eigen-oracle-operator-adapter.js';
import { mapInsrValidationCompleteToEigen } from '../src/adapters/insr/eigen-insr-adapter.js';
import { R2_SIGNAL_SOURCE_SYSTEMS } from '../packages/r2-signal-contract/src/v1.js';

function assertEigenIngestShape(req: EigenIngestRequest, label: string): void {
  expect(req.source_system, `${label}: source_system`).toBeTruthy();
  expect(req.source_ref, `${label}: source_ref`).toBeTruthy();
  expect(req.document, `${label}: document`).toBeDefined();
  expect(
    typeof req.document?.body === 'string' || typeof req.document?.title === 'string',
    `${label}: body or title`,
  ).toBe(true);
}

describe('adapter eigen-ingest conformance', () => {
  const cases: Array<{ name: string; req: EigenIngestRequest }> = [
    {
      name: 'rays_retreat content',
      req: mapRaysRetreatEventToEigen({
        record_id: 'r1',
        title: 'T',
        body: 'B',
      }),
    },
    {
      name: 'rays_retreat thought piece',
      req: mapThoughtPieceToEigen({
        id: 'tp1',
        retreat_year_id: 'y1',
        title: 'TP',
        content: 'C',
        theme_tags: ['a'],
        generated_at: new Date().toISOString(),
        content_hash: 'h',
      }),
    },
    {
      name: 'ip_pulse_point',
      req: mapIpEventToEigenDocument({
        analysis_run_id: 'ar1',
        analysis_title: 'IP',
        full_analysis_text: 'text',
      }),
    },
    {
      name: 'centralr2',
      req: mapCentralR2EventToEigen({
        asset_id: 'a1',
        title: 'K',
        narrative: 'N',
      }),
    },
    {
      name: 'r2app',
      req: mapR2AppEventToEigen({
        event_id: 'e1',
        title: 'Chat',
        transcript: 'hello',
      }),
    },
    {
      name: 'health_supplement_tr',
      req: mapHealthSupplementTrendToEigen({
        trend_id: 't1',
        title: 'H',
        body: 'body',
      }),
    },
    {
      name: 'smartplrx',
      req: mapSmartplrxTrendToEigen({
        trend_id: 's1',
        title: 'S',
        body: 'body',
      }),
    },
    {
      name: 'oracle_operator',
      req: mapOracleOperatorEventToEigenDocument({
        decision_id: 'd1',
        title: 'Op',
        body: 'decision body',
      }),
    },
    {
      name: 'insr',
      req: mapInsrValidationCompleteToEigen({
        batch_id: 'b1',
        submission_id: 'sub1',
        summary: 'Validation complete',
        body: 'Findings…',
      }),
    },
  ];

  for (const { name, req } of cases) {
    it(`shape: ${name}`, () => assertEigenIngestShape(req, name));
  }

  it('maps lane slugs to R2 signal contract source_system where the lane participates in v1 signals', () => {
    const contract = new Set<string>(R2_SIGNAL_SOURCE_SYSTEMS);
    const expectContract = (req: EigenIngestRequest) => {
      expect(contract.has(req.source_system), req.source_system).toBe(true);
    };

    expectContract(mapRaysRetreatEventToEigen({ record_id: 'r', title: 't', body: 'b' }));
    expectContract(mapCentralR2EventToEigen({ asset_id: 'a', title: 't', narrative: 'n' }));
    expectContract(mapR2AppEventToEigen({ event_id: 'e', title: 't', transcript: 'x' }));
    expectContract(mapHealthSupplementTrendToEigen({ trend_id: 't', title: 't', body: 'b' }));
    expectContract(mapSmartplrxTrendToEigen({ trend_id: 't', title: 't', body: 'b' }));
    expectContract(
      mapOracleOperatorEventToEigenDocument({ decision_id: 'd', title: 't', body: 'b' }),
    );
    expectContract(
      mapInsrValidationCompleteToEigen({
        batch_id: 'b',
        submission_id: 's',
        summary: 's',
        body: 'b',
      }),
    );

    // IP lane maps to signal-contract literal `ip_pulse_point` (KB-four driver).
    const ip = mapIpEventToEigenDocument({
      analysis_run_id: 'a',
      analysis_title: 't',
      full_analysis_text: 'b',
    });
    expect(ip.source_system).toBe('ip_pulse_point');
    expect(contract.has(ip.source_system)).toBe(true);
  });
});
