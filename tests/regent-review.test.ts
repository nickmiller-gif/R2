import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyFinancials,
  buildExecutiveTeam,
  buildRegentReview,
  citeFramework,
  computeAges,
  diffAgendas,
  reconcileFleet,
  scoreOutcomes,
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
import { buildParalegalSchedule } from '../packages/r2-regent/src/paralegal.ts';

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

  it('grounds frameworks in real CMU corpus citations', () => {
    const cite = citeFramework(
      'Economic profit / EVA (Strategy, Performance Measurement & Corporate Governance)',
    );
    expect(cite.length).toBeGreaterThanOrEqual(1);
    expect(cite[0]!.course).toContain('Strategy');
    const team = buildExecutiveTeam(fixture(), 5);
    // Every agenda item carries citations; the acting exec has a corpus basis.
    for (const item of team.agenda) {
      expect(Array.isArray(item.citations)).toBe(true);
    }
    const gc = team.roles.find((r) => r.role === 'General Counsel')!;
    expect(Array.isArray(gc.corpus_basis)).toBe(true);
  });

  it('Paralegal builds a dated schedule with statuses', () => {
    const state: WorldState = {
      ...fixture(),
      as_of: '2026-05-30',
      treasury: {
        cash_on_hand: 215000,
        committed_inflows: [
          { source: 'Past-due grant tranche', amount: 50000, expected_date: '2026-05-01' },
          { source: 'Future grant tranche', amount: 150000, expected_date: '2026-08-15' },
        ],
      },
      repo_assets: [
        {
          repo: 'formahealth',
          domain_key: 'health_wellness',
          last_commit_days: 5,
          tracked_env_files: [],
        },
      ],
    };
    const sched = buildParalegalSchedule(state, '2026-05-30');
    expect(sched.items.length).toBeGreaterThan(3);
    for (const it of sched.items) {
      expect(it.due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(['overdue', 'due_soon', 'upcoming']).toContain(it.status);
      expect(it.owner.length).toBeGreaterThan(0);
    }
    // The past-due inflow is overdue; a regulatory review for a regulated domain exists.
    expect(sched.overdue).toBeGreaterThanOrEqual(1);
    expect(sched.items.some((i) => i.category === 'regulatory')).toBe(true);
    expect(sched.items.some((i) => i.owner === 'General Counsel')).toBe(true);
    // Sorted by urgency (overdue first).
    expect(sched.items[0]!.days_until).toBeLessThanOrEqual(
      sched.items[sched.items.length - 1]!.days_until,
    );
  });

  it('applyFinancials overlays attested figures and scores those domains', () => {
    // Start from an all-unsourced (stale) state, like the live-DB path.
    const unsourced: WorldState = {
      cost_of_capital_pct: 18,
      stale_after_days: 14,
      treasury: { cash_on_hand: 0 },
      domains: [
        {
          key: 'health_wellness',
          name: 'Health & Wellness',
          series: 'B',
          stage: 'revenue',
          strategic_role: 'bet',
          monthly_burn: 0,
          invested_capital: 0,
          data_freshness_days: 9999,
        },
        {
          key: 'ip_patent',
          name: 'IP & Patent Intelligence',
          series: 'C',
          stage: 'revenue',
          strategic_role: 'bet',
          monthly_burn: 0,
          invested_capital: 0,
          data_freshness_days: 9999,
        },
      ],
    };
    const merged = applyFinancials(unsourced, {
      as_of: '2026-05-30',
      cash_on_hand: 215000,
      domains: [
        {
          key: 'health_wellness',
          ttm_revenue: 145000,
          ttm_direct_cost: 95000,
          invested_capital: 210000,
          monthly_burn: 6000,
        },
        // ip_patent intentionally omitted — must remain unsourced/stale.
      ],
      source: 'principal',
    });
    expect(merged.treasury.cash_on_hand).toBe(215000);
    const health = merged.domains.find((d) => d.key === 'health_wellness')!;
    expect(health.ttm_revenue).toBe(145000);
    expect(health.data_freshness_days).toBe(0); // supplied ⇒ fresh ⇒ scored
    const ip = merged.domains.find((d) => d.key === 'ip_patent')!;
    expect(ip.data_freshness_days).toBe(9999); // not supplied ⇒ stays unsourced
    // The CFO now sees a scored, value-creating domain.
    const team = buildExecutiveTeam(merged, 5);
    const scoredHealth = team.scored.find((d) => d.key === 'health_wellness')!;
    expect(scoredHealth.flag).toBe('CREATING');
    expect(scoredHealth.stale).toBe(false);
    // Empty financials is a no-op (stays unsourced — never fabricated).
    expect(applyFinancials(unsourced, null)).toBe(unsourced);
  });

  it('overlaying offers lights up the CCO (unit economics)', () => {
    const base: WorldState = {
      cost_of_capital_pct: 18,
      treasury: { cash_on_hand: 0 },
      domains: [
        {
          key: 'ip_patent',
          name: 'IP & Patent Intelligence',
          series: 'C',
          stage: 'revenue',
          strategic_role: 'bet',
          monthly_burn: 0,
          invested_capital: 0,
          data_freshness_days: 9999,
        },
      ],
    };
    const merged = applyFinancials(base, {
      domains: [
        {
          key: 'ip_patent',
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
      ],
      source: 'principal',
    });
    expect(merged.domains[0]!.offers?.length).toBe(1);
    const team = buildExecutiveTeam(merged, 5);
    const cco = team.roles.find((r) => r.role === 'Chief Commercial Officer')!;
    expect(cco.posture).not.toBe('hold'); // CCO now has a unit-economics decision
    expect(cco.decisions.some((d) => d.title.includes('unit economics'))).toBe(true);
  });

  it('week-over-week diff classifies new/resolved/moved/carried', () => {
    const current = [
      { title: 'A', severity: 90 },
      { title: 'B', severity: 60 },
      { title: 'C', severity: 50 },
    ] as RegentDecision[];
    const previous = [
      { title: 'A', severity: 90 },
      { title: 'B', severity: 40 },
      { title: 'D', severity: 70 },
    ];
    const delta = diffAgendas(current, previous)!;
    expect(delta.new).toEqual(['C']);
    expect(delta.resolved).toEqual(['D']);
    expect(delta.moved).toEqual([{ title: 'B', from: 40, to: 60 }]);
    expect(delta.carried).toEqual(['A']);
    expect(diffAgendas(current, null)).toBeNull();
    const team = buildExecutiveTeam(fixture(), 5, [{ title: 'old item', severity: 50 }]);
    expect(team.delta).not.toBeNull();
    expect(team.chief_of_staff.synthesis).toContain('Since last week');
  });

  it('Chief of Staff reconciles peer-bot findings: covered vs net-new vs silent', () => {
    const agenda = [
      { title: 'Fix IP', domain_key: 'ip_patent' },
      { title: 'Restore reporting', domain_key: null },
    ] as RegentDecision[];
    const fleet = [
      {
        bot: 'autonomous-information-audit',
        last_seen_days: 2,
        recent_count: 5,
        domains: ['ip_patent', 'health_wellness'],
      },
      { bot: 'autonomous-news-rss-cron', last_seen_days: 21, recent_count: 0, domains: [] },
    ];
    const rec = reconcileFleet(agenda, fleet, 10);
    expect(rec.covered).toEqual([{ bot: 'autonomous-information-audit', domain: 'ip_patent' }]);
    expect(rec.net_new).toEqual([
      { bot: 'autonomous-information-audit', domain: 'health_wellness' },
    ]);
    expect(rec.silent).toEqual(['autonomous-news-rss-cron']);
    // Surfaced in the synthesis + chief_of_staff.fleet.
    const state = { ...fixture(), agent_activity: fleet };
    const team = buildExecutiveTeam(state, 5);
    expect(team.chief_of_staff.fleet).toBeTruthy();
    expect(team.chief_of_staff.synthesis).toContain('Fleet reconciliation');
  });

  it('outcome scoring: ages accumulate, resolution rate + stuck escalation', () => {
    expect(computeAges(['A', 'B'], { A: 2 })).toEqual({ A: 3, B: 1 });
    const delta = { new: ['B'], resolved: ['D'], moved: [], carried: ['A'] };
    const outcomes = scoreOutcomes(delta, { A: 3, B: 1 }, 2);
    expect(outcomes.resolution_rate).toBeCloseTo(0.5, 2); // 1 resolved of 2 open last week
    expect(outcomes.resolved_count).toBe(1);
    expect(outcomes.stuck).toEqual(['A']); // age >= 3
    expect(scoreOutcomes(null, { A: 1 }, 1).resolution_rate).toBeNull();
    // buildExecutiveTeam threads ages + escalates stuck items.
    const team = buildExecutiveTeam(fixture(), 5);
    expect(team.outcomes).toBeTruthy();
    expect(team.agenda_ages).toBeTruthy();
    // Re-run feeding the prior ages high enough to make an item stuck → severity bumped.
    const titles = team.agenda.map((d) => d.title);
    const priorAges: Record<string, number> = {};
    titles.forEach((t) => (priorAges[t] = 5));
    const team2 = buildExecutiveTeam(fixture(), 5, null, priorAges);
    const stuckItem = team2.agenda.find((d) => d.stuck_weeks);
    expect(stuckItem).toBeTruthy();
    expect(stuckItem!.stuck_weeks).toBeGreaterThanOrEqual(3);
  });

  it('INVARIANT: advisory-only — no transactional client imported in the engine', () => {
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
    for (const file of ['review.ts', 'corpus.ts', 'paralegal.ts']) {
      const src = readFileSync(join(HERE, `../packages/r2-regent/src/${file}`), 'utf8');
      const importLines = src.split('\n').filter((l) => /^\s*import\s/.test(l));
      for (const line of importLines) {
        for (const bad of forbidden) expect(line.toLowerCase()).not.toContain(bad);
      }
    }
  });
});
