import { describe, expect, it } from 'vitest';
import {
  createOracleReadModelService,
  type OracleReadModelDb,
} from '../../src/services/oracle/oracle-read-model.service.js';

function makeMockDb(): OracleReadModelDb {
  return {
    async queryBriefings() {
      return [
        {
          thesis_id: 'thesis-1',
          title: 'Demand inflecting in micro markets',
          thesis_statement: 'Demand is accelerating in focused local niches.',
          confidence: 76,
          evidence_strength: 62,
          published_at: '2026-04-09T00:00:00.000Z',
          published_by: 'user-1',
          topic_tags: ['demand', 'local'],
        },
      ];
    },
    async queryThemeMap() {
      return [
        {
          theme: 'pricing_power',
          thesis_count: 3,
          avg_confidence: 71.5,
          latest_published_at: '2026-04-09T00:00:00.000Z',
        },
      ];
    },
    async queryFeedHistory() {
      return [
        {
          item_type: 'thesis',
          item_id: 'thesis-1',
          published_at: '2026-04-09T00:00:00.000Z',
          title: 'Demand inflecting',
          summary: 'Condensed summary',
          metadata: '{"channel":"operator"}',
        },
      ];
    },
  };
}

describe('OracleReadModelService', () => {
  it('maps briefing rows', async () => {
    const service = createOracleReadModelService(makeMockDb());
    const rows = await service.listBriefings({ limit: 10 });
    expect(rows).toHaveLength(1);
    expect(rows[0].thesisId).toBe('thesis-1');
    expect(rows[0].publishedAt).toBeInstanceOf(Date);
  });

  it('maps theme map rows', async () => {
    const service = createOracleReadModelService(makeMockDb());
    const rows = await service.listThemeMap({ minThesisCount: 1 });
    expect(rows[0].theme).toBe('pricing_power');
    expect(rows[0].latestPublishedAt).toBeInstanceOf(Date);
  });

  it('maps feed rows', async () => {
    const service = createOracleReadModelService(makeMockDb());
    const rows = await service.listFeedHistory({ limit: 10 });
    expect(rows[0].itemType).toBe('thesis');
    expect(rows[0].metadata).toEqual({ channel: 'operator' });
  });
});

