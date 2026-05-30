import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildExecutiveTeam,
  buildRegentReview,
  computeOffer,
  mergeByDomain,
  reviewAgentFleet,
  reviewProcessCapability,
  reviewRegulatoryFirstPass,
  reviewSecretExposure,
  scoreDomain,
  type RegentDecision,
  type WorldState,
} from '../packages/r2-regent/src/review.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

function fixture(): WorldState {
  return {
    cost_of_capital_pct: 18,
    runway_floor_months: 6,
    stale_after_days: 14,
    repo_stale_after_days: 45,
    ltv_cac_target: 3.0,
    churn_warn_pct: 6,
    treasury: { cash_on_hand: 215000 },
    funding: {
      active_phase: 1,
      phases: [
        {
          phase: 1,
          label: 'Formation & first proof',
          target_low: 250000,
          target_high: 750000,
          gate: 'g',
          gate_cleared: false,
        },
      ],
    },
    domains: [
      {
        key: 'platform_core',
        name: 'Platform Core',
        series: 'A',
        stage: 'build',
        strategic_role: 'core',
        monthly_burn: 9500,
        invested_capital: 180000,
        data_freshness_days: 3,
      },
      {
        key: 'health_wellness',
        name: 'Health & Wellness',
        series: 'B',
        stage: 'revenue',
        strategic_role: 'bet',
        ttm_revenue: 145000,
        ttm_direct_cost: 95000,
        monthly_burn: 6000,
        invested_capital: 210000,
        data_freshness_days: 4,
        offers: [
          {
            name: 'FormaHealth membership',
            model: 'subscription',
            price_monthly: 29,
            variable_cost_monthly: 6,
            monthly_churn_pct: 8,
            cac: 95,
          },
        ],
      },
      {
        key: 'ip_patent',
        name: 'IP & Patent Intelligence',
        series: 'C',
        stage: 'revenue',
        strategic_role: 'bet',
        ttm_revenue: 60000,
        ttm_direct_cost: 72000,
        monthly_burn: 5000,
        invested_capital: 140000,
        data_freshness_days: 6,
        offers: [
          {
            name: 'IP insights report',
            model: 'transaction',
            price: 300,
            variable_cost: 360,
            repeat_factor: 1.2,
            cac: 140,
          },
        ],
      },
      {
        key: 'retreat_commerce',
        name: 'Retreat & Commerce',
        series: 'D',
        stage: 'revenue',
        strategic_role: 'bet',
        ttm_revenue: 240000,
        ttm_direct_cost: 150000,
        monthly_burn: 7000,
        invested_capital: 120000,
        data_freshness_days: 2,
      },
      {
        key: 'autonomous_ops',
        name: 'Autonomous Ops',
        series: 'E',
        stage: 'pilot',
        strategic_role: 'core',
        monthly_burn: 8000,
        invested_capital: 95000,
        data_freshness_days: 5,
      },
      {
        key: 'productivity_memory',
        name: 'Productivity & Memory',
        series: 'foundation',
        stage: 'build',
        strategic_role: 'option',
        monthly_burn: 3000,
        invested_capital: 40000,
        data_freshness_days: 22,
      },
    ],
    repo_assets: [
      {
        repo: 'ip-pulse-point',
        domain_key: 'ip_patent',
        last_commit_days: 1,
        tracked_env_files: ['.env'],
      },
      {
        repo: 'formahealth',
        domain_key: 'health_wellness',
        last_commit_days: 90,
        tracked_env_files: [],
        has_tests: true,
        has_ci: true,
      },
    ],
  };
}

describe('REGENT faculties — metric layer', () => {
  it('scores a value-creating domain (matches reference engine)', () => {
    const s = scoreDomain(fixture().domains[1]!, 18, 14);
    expect(s.contribution).toBe(50000);
    expect(s.econ_profit).toBe(50000 - 0.18 * 210000); // 12200
    expect(s.flag).toBe('CREATING');
  });

  it('flags a domain selling below cost as DESTROYING', () => {
    const s = scoreDomain(fixture().domains[2]!, 18, 14);
    expect(s.contribution).toBe(-12000);
    expect(s.flag).toBe('DESTROYING');
  });

  it('excludes a stale domain from scoring', () => {
    const s = scoreDomain(fixture().domains[5]!, 18, 14);
    expect(s.stale).toBe(true);
    expect(s.flag).toBe('STALE');
  });

  it('computes subscription unit economics', () => {
    const m = computeOffer({
      name: 'F',
      model: 'subscription',
      price_monthly: 29,
      variable_cost_monthly: 6,
      monthly_churn_pct: 8,
      cac: 95,
    });
    expect(m.ltv).toBeCloseTo(287.5, 1);
    expect(m.ltv_cac).toBeCloseTo(3.03, 2);
  });

  it('computes negative transaction unit economics', () => {
    const m = computeOffer({
      name: 'IP',
      model: 'transaction',
      price: 300,
      variable_cost: 360,
      repeat_factor: 1.2,
      cac: 140,
    });
    expect(m.ltv).toBeCloseTo(-72, 5);
    expect(m.ltv_cac).toBeCloseTo(-0.51, 2);
    expect(m.payback).toBe(Infinity);
  });
});

describe('REGENT — agenda, merge, asset review', () => {
  it('merges same-domain findings into one corroborated item', () => {
    const review = buildRegentReview(fixture(), 5);
    const ip = review.agenda.find((d) => d.domain_key === 'ip_patent');
    expect(ip).toBeTruthy();
    expect(ip!.corroborated).toBe(true); // Capital (EVA) + Commercial (LTV:CAC)
    expect(ip!.corroboration?.length).toBeGreaterThanOrEqual(1);
  });

  it('process-capability flags only KNOWN gaps (explicit false), never unknown', () => {
    const base = { cost_of_capital_pct: 18, treasury: { cash_on_hand: 0 }, domains: [] };
    // Unknown tests/CI (undefined) — must NOT flag (e.g. live-DB-derived sources).
    expect(
      reviewProcessCapability({
        ...base,
        repo_assets: [{ repo: 'centralr2', last_commit_days: 0 }],
      }),
    ).toBeNull();
    // Explicitly false — a known gap, should flag.
    const d = reviewProcessCapability({
      ...base,
      repo_assets: [{ repo: 'x', last_commit_days: 0, has_tests: false, has_ci: false }],
    });
    expect(d).toBeTruthy();
    expect(d!.faculty).toBe('Operations');
  });

  it('flags committed env files as a high-severity Risk decision', () => {
    const d = reviewSecretExposure(fixture());
    expect(d).toBeTruthy();
    expect(d!.faculty).toBe('Risk');
    expect(d!.severity).toBeGreaterThanOrEqual(80);
  });

  it('INVARIANT: stale domains never enter the scored agenda', () => {
    const review = buildRegentReview(fixture(), 5);
    const staleKeys = new Set(review.scored.filter((d) => d.stale).map((d) => d.key));
    expect(staleKeys.size).toBeGreaterThan(0);
    for (const item of [...review.agenda, ...review.deferred]) {
      if (item.domain_key) expect(staleKeys.has(item.domain_key)).toBe(false);
    }
  });

  it('INVARIANT: every agenda item carries full provenance', () => {
    const review = buildRegentReview(fixture(), 5);
    const fields: (keyof RegentDecision)[] = [
      'severity',
      'faculty',
      'title',
      'framework',
      'observation',
      'assumptions',
      'recommendation',
      'tradeoff',
      'counter_case',
      'confidence',
    ];
    for (const item of review.agenda) {
      for (const f of fields) expect(item[f]).not.toBeUndefined();
      expect(item.assumptions.length).toBeGreaterThan(0);
      expect(['high', 'medium', 'low']).toContain(item.confidence);
    }
  });

  it('builds a full executive team with named roles and a Chief of Staff synthesis', () => {
    const team = buildExecutiveTeam(fixture(), 5);
    const titles = team.roles.map((r) => r.role);
    expect(titles).toEqual([
      'Chief Financial Officer',
      'Chief Strategy Officer',
      'Chief Commercial Officer',
      'Chief Operating Officer',
      'General Counsel',
      'Chief of Staff',
    ]);
    // Each member has a posture and a stance.
    for (const r of team.roles) {
      expect(['act', 'watch', 'hold']).toContain(r.posture);
      expect(r.stance.length).toBeGreaterThan(0);
      expect(r.headline.length).toBeGreaterThan(0);
    }
    expect(team.chief_of_staff.synthesis).toContain('executive team');
    expect(team.chief_of_staff.sequencing.length).toBe(team.agenda.length);
  });

  it('General Counsel files a regulatory first-pass for regulated domains', () => {
    const d = reviewRegulatoryFirstPass(fixture());
    expect(d).toBeTruthy();
    expect(d!.faculty).toBe('Risk');
    expect(d!.observation).toMatch(/FDA\/FTC|FHA|UPL|501/);
  });

  it('Chief of Staff flags a silent peer bot (orchestration)', () => {
    const state = {
      ...fixture(),
      agent_activity: [{ bot: 'autonomous-news-rss-cron', last_seen_days: 21, recent_count: 0 }],
    };
    const d = reviewAgentFleet(state);
    expect(d).toBeTruthy();
    expect(d!.faculty).toBe('People & Orchestration');
    expect(d!.title).toContain('quiet bot');
  });

  it('detects a cross-desk tension between CFO and another exec', () => {
    // Fixture runway 5.6mo < 6 floor (burn 38.5k on 215k) + open gate ⇒ liquidity vs growth.
    const team = buildExecutiveTeam(fixture(), 5);
    expect(team.tensions.length).toBeGreaterThanOrEqual(1);
    expect(team.tensions[0]!.between).toContain('Chief Financial Officer');
    expect(team.tensions[0]!.resolution.length).toBeGreaterThan(0);
  });

  it('INVARIANT: advisory-only — no transactional client imported in the engine', () => {
    const src = readFileSync(join(HERE, '../packages/r2-regent/src/review.ts'), 'utf8');
    const forbidden = [
      'stripe',
      'paypal',
      'plaid',
      'docusign',
      'web3',
      'ethers',
      'coinbase',
      'send_payment',
      'wire_transfer',
    ];
    const importLines = src.split('\n').filter((l) => /^\s*import\s/.test(l));
    for (const line of importLines) {
      for (const bad of forbidden) expect(line.toLowerCase()).not.toContain(bad);
    }
  });
});
