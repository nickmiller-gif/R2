/**
 * REGENT — pure executive-review faculties.
 *
 * A faithful TypeScript port of the REGENT reference engine (Python, in the
 * `regent/` repo). Pure and dependency-free: world-state in, ranked agenda out.
 * No I/O, no Deno, no Supabase — so it is unit-testable in vitest and shared by
 * the autonomous-regent-review Edge function.
 *
 * Three invariants live here by construction:
 *   1. ADVISORY ONLY — this module computes; it cannot transact.
 *   2. NEVER FABRICATE — a domain older than `stale_after_days` is excluded from
 *      scoring and named, never estimated.
 *   3. PROVENANCE — every decision carries framework, assumptions, trade-off and
 *      counter-case.
 */

import { citeFramework, corpusBasis, type Citation } from './corpus.ts';
export type { Citation } from './corpus.ts';
export { citeFramework, corpusBasis } from './corpus.ts';

export type Confidence = 'high' | 'medium' | 'low';

export interface RegentDecision {
  severity: number;
  faculty: string;
  domain_key?: string | null;
  title: string;
  framework: string;
  observation: string;
  assumptions: string[];
  recommendation: string;
  tradeoff: string;
  counter_case: string;
  confidence: Confidence;
  /** Verifiable CMU-corpus sources backing the framework cited above. */
  citations?: Citation[];
  corroborated?: boolean;
  corroboration?: Array<{
    faculty: string;
    framework: string;
    observation: string;
    recommendation: string;
  }>;
}

export interface Offer {
  name: string;
  model?: 'subscription' | 'transaction';
  price_monthly?: number;
  variable_cost_monthly?: number;
  monthly_churn_pct?: number;
  price?: number;
  variable_cost?: number;
  repeat_factor?: number;
  cac?: number;
}

export interface FunnelStage {
  stage: string;
  count: number;
}

export interface Domain {
  key: string;
  name: string;
  series?: string;
  stage?: string;
  strategic_role?: string;
  ttm_revenue?: number;
  ttm_direct_cost?: number;
  monthly_burn?: number;
  invested_capital?: number;
  data_freshness_days?: number;
  notes?: string;
  offers?: Offer[];
  funnel?: FunnelStage[];
}

export interface RepoAsset {
  repo: string;
  domain_key?: string | null;
  series?: string;
  last_commit_days: number;
  file_count?: number;
  has_readme?: boolean;
  has_agents_md?: boolean;
  has_tests?: boolean;
  has_ci?: boolean;
  tracked_env_files?: string[];
}

/** One peer autonomous bot in the R2 fleet, as the Chief of Staff sees it. */
export interface AgentActivity {
  bot: string;
  last_seen_days: number;
  recent_count: number;
  domains?: string[];
}

export interface WorldState {
  _SYNTHETIC?: string;
  as_of?: string;
  principal?: string;
  cost_of_capital_pct: number;
  runway_floor_months?: number;
  stale_after_days?: number;
  repo_stale_after_days?: number;
  ltv_cac_target?: number;
  churn_warn_pct?: number;
  agent_silent_after_days?: number;
  treasury: { cash_on_hand: number; committed_inflows?: Array<Record<string, unknown>> };
  funding?: { active_phase?: number; phases?: Array<Record<string, unknown>> };
  domains: Domain[];
  repo_assets?: RepoAsset[];
  /** The other autonomous bots' recent activity — the Chief of Staff's purview. */
  agent_activity?: AgentActivity[];
}

export interface ScoredDomain extends Domain {
  contribution: number;
  roic: number | null;
  econ_profit: number;
  flag: 'STALE' | 'INVESTING' | 'UNFUNDED' | 'DESTROYING' | 'WATCH' | 'CREATING';
  flag_rationale: string;
  stale: boolean;
}

export interface OfferMetric {
  name: string;
  model?: string;
  unit_contribution: number;
  margin: number | null;
  ltv: number;
  cac: number;
  ltv_cac: number;
  payback: number;
  payback_unit: string;
  churn_pct?: number;
}

export interface RegentReview {
  agenda: RegentDecision[];
  deferred: RegentDecision[];
  scored: ScoredDomain[];
  treasury: { cash: number; totalMonthlyBurn: number; runwayMonths: number };
  staleDomains: string[];
}

const HEALTH_ADJACENT = new Set(['formahealth', 'smartplrx-trend-tracker', 'health-supplement-tr']);

export function fmtMoney(x: number): string {
  return `$${Math.round(x).toLocaleString('en-US')}`;
}

// --------------------------------------------------------------------------- //
// Metric layer                                                                 //
// --------------------------------------------------------------------------- //

export function scoreDomain(d: Domain, hurdlePct: number, staleAfterDays: number): ScoredDomain {
  const fresh = d.data_freshness_days ?? 0;
  const rev = d.ttm_revenue ?? 0;
  const dc = d.ttm_direct_cost ?? 0;
  const cap = d.invested_capital ?? 0;
  const contribution = rev - dc;
  const roic = cap ? contribution / cap : null;
  const hurdle = hurdlePct / 100;
  const econ_profit = contribution - hurdle * cap;

  let flag: ScoredDomain['flag'];
  let flag_rationale: string;
  if (fresh > staleAfterDays) {
    flag = 'STALE';
    flag_rationale = `data ${fresh}d old (> ${staleAfterDays}d) -- not scored`;
  } else if (d.stage === 'build' || d.stage === 'pilot') {
    flag = 'INVESTING';
    flag_rationale = `pre-revenue (${d.stage}) -- consuming capital as planned`;
  } else if (roic === null) {
    flag = 'UNFUNDED';
    flag_rationale = 'revenue stage but no invested capital recorded';
  } else if (roic < 0) {
    flag = 'DESTROYING';
    flag_rationale = `ROIC ${Math.round(roic * 100)}% < 0 -- selling below direct cost`;
  } else if (roic < hurdle) {
    flag = 'WATCH';
    flag_rationale = `ROIC ${Math.round(roic * 100)}% below ${Math.round(hurdlePct)}% hurdle`;
  } else {
    flag = 'CREATING';
    flag_rationale = `ROIC ${Math.round(roic * 100)}% clears ${Math.round(hurdlePct)}% hurdle`;
  }

  return {
    ...d,
    contribution,
    roic,
    econ_profit,
    flag,
    flag_rationale,
    stale: fresh > staleAfterDays,
  };
}

export function treasuryView(state: WorldState, scored: ScoredDomain[]) {
  const totalMonthlyBurn = scored.reduce((s, d) => s + (d.monthly_burn ?? 0), 0);
  const cash = state.treasury.cash_on_hand;
  const runwayMonths = totalMonthlyBurn ? cash / totalMonthlyBurn : Infinity;
  return { cash, totalMonthlyBurn, runwayMonths };
}

export function computeOffer(offer: Offer): OfferMetric {
  const cac = offer.cac ?? 0;
  let unit_contribution: number;
  let ltv: number;
  let payback: number;
  let margin: number | null;
  let unit_label: string;
  if (offer.model === 'subscription') {
    unit_contribution = (offer.price_monthly ?? 0) - (offer.variable_cost_monthly ?? 0);
    const churn = (offer.monthly_churn_pct ?? 0) / 100;
    const lifetime = churn ? 1 / churn : Infinity;
    ltv = lifetime === Infinity ? Infinity : unit_contribution * lifetime;
    payback = unit_contribution > 0 ? cac / unit_contribution : Infinity;
    margin = offer.price_monthly ? unit_contribution / offer.price_monthly : null;
    unit_label = 'mo';
  } else {
    unit_contribution = (offer.price ?? 0) - (offer.variable_cost ?? 0);
    const repeat = offer.repeat_factor ?? 1;
    ltv = unit_contribution * repeat;
    payback = unit_contribution > 0 ? cac / unit_contribution : Infinity;
    margin = offer.price ? unit_contribution / offer.price : null;
    unit_label = 'purchase';
  }
  const ltv_cac = cac ? ltv / cac : Infinity;
  return {
    name: offer.name,
    model: offer.model,
    unit_contribution,
    margin,
    ltv,
    cac,
    ltv_cac,
    payback,
    payback_unit: unit_label,
    churn_pct: offer.monthly_churn_pct,
  };
}

export function funnelLeak(funnel: FunnelStage[]): [string, string, number] | null {
  let worst: [string, string, number] | null = null;
  for (let i = 0; i < funnel.length - 1; i += 1) {
    const a = funnel[i]!;
    const b = funnel[i + 1]!;
    const rate = a.count ? b.count / a.count : 0;
    if (worst === null || rate < worst[2]) worst = [a.stage, b.stage, rate];
  }
  return worst;
}

// --------------------------------------------------------------------------- //
// Capital + Strategy                                                           //
// --------------------------------------------------------------------------- //

export function decisionRunway(
  state: WorldState,
  tre: ReturnType<typeof treasuryView>,
): RegentDecision | null {
  const floor = state.runway_floor_months ?? 6;
  const rm = tre.runwayMonths;
  if (rm >= floor * 1.5) return null;
  return {
    severity: rm < floor ? 100 : 70,
    faculty: 'Capital',
    title: 'Extend runway before the liquidity floor is breached',
    framework: 'Runway & burn management (Finance I; Funding Early-Stage Ventures)',
    observation: `Runway is ${rm.toFixed(1)} months against a ${floor}-month floor; net burn ${fmtMoney(tre.totalMonthlyBurn)}/mo on ${fmtMoney(tre.cash)} cash.`,
    assumptions: [
      'Burn holds at the current rate (no new hires or domain launches).',
      'Committed inflows land as recorded.',
    ],
    recommendation:
      'Open the Phase-1 raise now and/or cut the lowest-return burn this week. Do not let runway fall below the floor before action.',
    tradeoff:
      'Raising now is dilutive/effortful ahead of the gate; waiting risks a forced, weaker raise.',
    counter_case:
      'If a grant tranche is high-confidence and near, a bridge may suffice without a full raise -- confirm the probability before committing.',
    confidence: rm < floor ? 'high' : 'medium',
  };
}

export function decisionValueDestruction(scored: ScoredDomain[]): RegentDecision | null {
  const cand = scored.filter((d) => d.flag === 'DESTROYING');
  if (cand.length === 0) return null;
  const d = cand.reduce((a, b) => (a.econ_profit <= b.econ_profit ? a : b));
  return {
    severity: 90,
    domain_key: d.key,
    faculty: 'Capital',
    title: `Fix or sunset ${d.name} -- it is destroying capital`,
    framework: 'Economic profit / EVA (Strategy, Performance Measurement & Corporate Governance)',
    observation: `${d.name} (Series ${d.series}) ran ${fmtMoney(d.contribution)} contribution on ${fmtMoney(d.invested_capital ?? 0)} capital -- economic profit ${fmtMoney(d.econ_profit)}. ${d.flag_rationale}.`,
    assumptions: [
      'Trailing-twelve-month figures represent the steady state, not a one-off bad year.',
      'Direct costs are correctly attributed to the domain.',
    ],
    recommendation: `Set a 90-day repricing/cost target for ${d.name}; if economic profit does not turn, sunset or fold it into a stronger domain.`,
    tradeoff:
      'Sunsetting forfeits optionality and strategic-role intent; persisting subsidizes a loss from scarce cash.',
    counter_case: `If ${d.name} is a deliberate loss-leader feeding a domain that does create value, the loss may be rational -- name that linkage explicitly or treat the loss as real.`,
    confidence: 'high',
  };
}

export function decisionDoubleDown(scored: ScoredDomain[]): RegentDecision | null {
  const pool = scored.filter(
    (d) => d.flag === 'CREATING' && (d.strategic_role === 'core' || d.strategic_role === 'bet'),
  );
  if (pool.length === 0) return null;
  const best = pool.reduce((a, b) => ((a.roic ?? 0) >= (b.roic ?? 0) ? a : b));
  const avgCap =
    scored.reduce((s, d) => s + (d.invested_capital ?? 0), 0) / Math.max(scored.length, 1);
  if ((best.invested_capital ?? 0) >= avgCap) return null;
  return {
    severity: 65,
    domain_key: best.key,
    faculty: 'Capital',
    title: `Reallocate capital toward ${best.name}`,
    framework: 'Capital budgeting / portfolio reallocation (Finance I/II; Investment Analysis)',
    observation: `${best.name} earns ROIC ${Math.round((best.roic ?? 0) * 100)}% (economic profit ${fmtMoney(best.econ_profit)}) on only ${fmtMoney(best.invested_capital ?? 0)} -- below the ${fmtMoney(avgCap)} portfolio average.`,
    assumptions: [
      'Returns do not collapse at higher scale (no near-term capacity ceiling).',
      'Incremental capital is available without breaching the runway floor.',
    ],
    recommendation: `Shift marginal capital from the lowest-return domain into ${best.name} up to the point its returns begin to compress.`,
    tradeoff: 'Concentrates the portfolio and raises single-domain dependence.',
    counter_case:
      'High ROIC on a thin base can mask a small, capacity-limited market -- size the headroom before adding capital.',
    confidence: 'medium',
  };
}

export function decisionStaleData(scored: ScoredDomain[]): RegentDecision | null {
  const stale = scored.filter((d) => d.stale);
  if (stale.length === 0) return null;
  const names = stale.map((d) => `${d.name} (${d.data_freshness_days}d)`).join(', ');
  return {
    severity: 55,
    faculty: 'Strategy',
    title: 'Restore reporting on unmeasured domains',
    framework:
      'Management control -- you cannot allocate against what you do not measure (Accounting; Governance)',
    observation: `Stale feeds: ${names}. These domains were excluded from the value scoring.`,
    assumptions: ['The staleness is a reporting-pipeline gap, not a wound-down domain.'],
    recommendation:
      'Re-establish the data feed before the next weekly run so these domains re-enter the allocation decision.',
    tradeoff: 'Engineering time to fix the feed vs. continuing to fly blind on these domains.',
    counter_case: 'If a domain is genuinely dormant, retire its line rather than repair the feed.',
    confidence: 'high',
  };
}

export function decisionGate(state: WorldState): RegentDecision | null {
  const phases = state.funding?.phases ?? [];
  const cur = phases.find((p) => p.phase === state.funding?.active_phase) as
    | Record<string, unknown>
    | undefined;
  if (!cur || cur.gate_cleared) return null;
  return {
    severity: 50,
    faculty: 'Strategy',
    title: `Drive the Phase-${cur.phase} gate: ${cur.gate}`,
    framework: 'Milestone-gated financing (Funding Early-Stage Ventures)',
    observation: `Active phase ${cur.phase} (${cur.label}); target ${fmtMoney(Number(cur.target_low))}-${fmtMoney(Number(cur.target_high))}. Gate not yet cleared.`,
    assumptions: ['The gate as written is the true unlock for the next tranche of capital.'],
    recommendation:
      "Sequence this week's work to clear the gate items; the next funding tier is blocked until they are done.",
    tradeoff: 'Gate work competes with revenue work for the same scarce hours.',
    counter_case:
      'If a funder will commit pre-gate, the gate is not strictly blocking -- verify before deprioritizing revenue.',
    confidence: 'medium',
  };
}

// --------------------------------------------------------------------------- //
// Commercial                                                                   //
// --------------------------------------------------------------------------- //

export function decisionUnitEconomics(state: WorldState, domains: Domain[]): RegentDecision | null {
  const target = state.ltv_cac_target ?? 3.0;
  let worst: { d: Domain; m: OfferMetric } | null = null;
  for (const d of domains) {
    for (const off of d.offers ?? []) {
      const m = computeOffer(off);
      if (m.ltv_cac < target && (worst === null || m.ltv_cac < worst.m.ltv_cac)) worst = { d, m };
    }
  }
  if (!worst) return null;
  const { d, m } = worst;
  const broken = m.ltv_cac < 1 || m.unit_contribution <= 0;
  const pay =
    m.payback === Infinity
      ? 'never (contribution <= 0)'
      : `${m.payback.toFixed(1)} ${m.payback_unit}s`;
  const ltvStr = m.ltv === Infinity ? 'inf' : fmtMoney(m.ltv);
  return {
    severity: broken ? 85 : 60,
    domain_key: d.key,
    faculty: 'Commercial',
    title: `Fix unit economics on ${m.name} (${d.name})`,
    framework: 'LTV:CAC and CAC payback (Marketing Management; Pricing Strategy)',
    observation: `${m.name}: LTV ${ltvStr}, CAC ${fmtMoney(m.cac)}, LTV:CAC ${m.ltv_cac.toFixed(2)} vs ${target.toFixed(1)} target; payback ${pay}; unit contribution ${fmtMoney(m.unit_contribution)}.`,
    assumptions: ['CAC and variable cost are fully loaded.', 'Repeat/churn behavior holds.'],
    recommendation: broken
      ? 'Stop acquiring at a loss: reprice up, cut variable cost, or pause paid acquisition until contribution is positive.'
      : 'Raise price or lower CAC until LTV:CAC clears the target before scaling spend.',
    tradeoff: 'Repricing may reduce volume; pausing acquisition slows growth.',
    counter_case:
      'If this offer is a deliberate funnel entry to a profitable upsell, the loss can be rational -- prove the upsell path or treat the loss as real.',
    confidence: broken ? 'high' : 'medium',
  };
}

export function decisionChurn(state: WorldState, domains: Domain[]): RegentDecision | null {
  const warn = state.churn_warn_pct ?? 6;
  let worst: { d: Domain; c: number; name: string } | null = null;
  for (const d of domains) {
    for (const off of d.offers ?? []) {
      if (off.model === 'subscription') {
        const c = off.monthly_churn_pct ?? 0;
        if (c > warn && (worst === null || c > worst.c)) worst = { d, c, name: off.name };
      }
    }
  }
  if (!worst) return null;
  const { d, c, name } = worst;
  return {
    severity: 50,
    domain_key: d.key,
    faculty: 'Commercial',
    title: `Address churn on ${name} (${d.name})`,
    framework: 'Retention / churn economics (Marketing Management)',
    observation: `${name} churns ${c.toFixed(0)}%/mo (above the ${warn.toFixed(0)}% warning line) -- average customer life ~${Math.round(100 / c)} months.`,
    assumptions: ['Churn is voluntary, not a billing artifact.'],
    recommendation:
      'Instrument cancellation reasons and run one retention intervention (onboarding or save-offer) before spending more on acquisition.',
    tradeoff: 'Retention work competes with acquisition for the same effort.',
    counter_case:
      'High churn on a low-commitment tier may be acceptable if LTV:CAC still clears -- weigh against the unit economics.',
    confidence: 'medium',
  };
}

export function decisionFunnel(_state: WorldState, domains: Domain[]): RegentDecision | null {
  let worst: { d: Domain; leak: [string, string, number] } | null = null;
  for (const d of domains) {
    const f = d.funnel;
    if (!f || f.length < 2) continue;
    const leak = funnelLeak(f);
    if (leak && (worst === null || leak[2] < worst.leak[2])) worst = { d, leak };
  }
  if (!worst || worst.leak[2] >= 0.35) return null;
  const { d } = worst;
  const [a, b, rate] = worst.leak;
  return {
    severity: 55,
    domain_key: d.key,
    faculty: 'Commercial',
    title: `Attack the ${a}→${b} conversion leak (${d.name})`,
    framework: 'Funnel conversion analysis (Analytical Marketing)',
    observation: `${d.name} converts ${a}→${b} at only ${Math.round(rate * 100)}% -- the weakest step in the funnel.`,
    assumptions: ['Funnel counts are same-cohort and correctly attributed.'],
    recommendation: `Run one focused A/B test on the ${a}→${b} step; a few points here compound through every downstream stage.`,
    tradeoff: 'Test cycles cost time; over-optimizing one step can mask a weaker offer.',
    counter_case: `A low ${a}→${b} rate may be healthy qualification, not a leak -- check downstream value of the survivors first.`,
    confidence: 'medium',
  };
}

export function decisionPricingPower(state: WorldState, domains: Domain[]): RegentDecision | null {
  let best: { d: Domain; m: OfferMetric } | null = null;
  for (const d of domains) {
    for (const off of d.offers ?? []) {
      const m = computeOffer(off);
      const healthy = (m.margin ?? 0) >= 0.55 && m.ltv_cac >= 4 && m.unit_contribution > 0;
      if (healthy && (best === null || (m.margin ?? 0) > (best.m.margin ?? 0))) best = { d, m };
    }
  }
  if (!best) return null;
  const { d, m } = best;
  return {
    severity: 45,
    domain_key: d.key,
    faculty: 'Commercial',
    title: `Test a price increase on ${m.name} (${d.name})`,
    framework: 'Value-based pricing (Pricing Strategy)',
    observation: `${m.name} runs ${Math.round((m.margin ?? 0) * 100)}% margin at LTV:CAC ${m.ltv_cac.toFixed(1)} -- strong demand signal and pricing headroom.`,
    assumptions: ['Demand is not at a known price ceiling.', 'No contractual price locks.'],
    recommendation:
      'Test a 10-15% increase on new customers; measure conversion and churn before a full rollout.',
    tradeoff: 'A price test risks conversion on the segment tested.',
    counter_case:
      'If the offer is a strategic loss-leader or community good, holding price may be intentional -- confirm the role.',
    confidence: 'medium',
  };
}

// --------------------------------------------------------------------------- //
// Asset Review — the executive team reviewing the repo constellation           //
// --------------------------------------------------------------------------- //

export function reviewSecretExposure(state: WorldState): RegentDecision | null {
  const exposed = (state.repo_assets ?? []).filter((a) => (a.tracked_env_files ?? []).length > 0);
  if (exposed.length === 0) return null;
  exposed.sort((a, b) => (b.tracked_env_files?.length ?? 0) - (a.tracked_env_files?.length ?? 0));
  const worst = exposed[0]!;
  const files = (worst.tracked_env_files ?? []).slice(0, 5).join(', ');
  const more = exposed.length > 1 ? ` (+${exposed.length - 1} other repo(s))` : '';
  return {
    severity: 88,
    domain_key: worst.domain_key && worst.domain_key !== 'uncategorized' ? worst.domain_key : null,
    faculty: 'Risk',
    title: `Verify no live secrets are committed in ${worst.repo}${more}`,
    framework: 'Operational risk control (Ethics & Leadership; Governance)',
    observation: `${worst.repo} tracks env-style file(s) in version control: ${files}. Committed secrets are an exposure even after rotation, because history retains them.`,
    assumptions: ['The tracked file may be a real .env rather than a .env.example template.'],
    recommendation:
      'Confirm the file is an example/template; if it ever held live keys, rotate them and purge from history. Move real secrets to the documented .env pattern (gitignored).',
    tradeoff: 'History rewrite is disruptive; leaving an exposed secret is a standing breach risk.',
    counter_case:
      'If the file is demonstrably a committed-by-design template with no live values, no action is needed -- verify, do not assume.',
    confidence: 'high',
  };
}

export function reviewRepoDrift(state: WorldState): RegentDecision | null {
  const threshold = state.repo_stale_after_days ?? 45;
  const drifting = (state.repo_assets ?? [])
    .filter((a) => a.last_commit_days > threshold)
    .sort((a, b) => b.last_commit_days - a.last_commit_days);
  if (drifting.length === 0) return null;
  const worst = drifting[0]!;
  const others = drifting
    .slice(1, 6)
    .map((a) => `${a.repo} (${a.last_commit_days}d)`)
    .join(', ');
  return {
    severity: worst.last_commit_days > threshold * 2 ? 60 : 48,
    domain_key: worst.domain_key && worst.domain_key !== 'uncategorized' ? worst.domain_key : null,
    faculty: 'Strategy',
    title: `Reconcile drift on ${worst.repo} (${worst.last_commit_days}d since last commit)`,
    framework:
      'Management control — steer only what you measure (Strategy, Performance Measurement & Corporate Governance)',
    observation: `${worst.repo} has not been committed in ${worst.last_commit_days} days (drift line ${threshold}d)${others ? `; also drifting: ${others}.` : '.'}`,
    assumptions: ['Commit recency proxies for active maintenance, not a frozen-by-design asset.'],
    recommendation:
      'Decide each drifting repo explicitly: resume, archive, or fold into a live domain. An undeclared dormant repo is unmanaged surface area, not optionality.',
    tradeoff:
      'Archiving forfeits latent optionality; carrying it dilutes attention across the portfolio.',
    counter_case:
      'A repo can be deliberately stable (a finished library); confirm it is dormant-by-neglect before acting.',
    confidence: 'medium',
  };
}

export function reviewProcessCapability(state: WorldState): RegentDecision | null {
  // Only flag a KNOWN gap (fact explicitly false). Unknown (undefined) means the
  // source could not observe it — e.g. the live-DB-derived path inventories feed
  // source-systems, not real repos — so it must not read as a defect.
  const gaps = (state.repo_assets ?? []).filter((a) => a.has_tests === false || a.has_ci === false);
  if (gaps.length === 0) return null;
  const noTests = gaps.filter((a) => a.has_tests === false).map((a) => a.repo);
  const noCi = gaps.filter((a) => a.has_ci === false).map((a) => a.repo);
  const bits: string[] = [];
  if (noTests.length)
    bits.push(`no test signal: ${noTests.slice(0, 6).join(', ')}${noTests.length > 6 ? ' …' : ''}`);
  if (noCi.length)
    bits.push(`no CI workflow: ${noCi.slice(0, 6).join(', ')}${noCi.length > 6 ? ' …' : ''}`);
  return {
    severity: 50,
    faculty: 'Operations',
    title: `Raise process capability across ${gaps.length} repo(s)`,
    framework:
      'Quality at source / process capability (Operations Management; Sustainable Operations)',
    observation: `Repos missing a quality gate — ${bits.join('; ')}. Defects in these ship without an automatic catch.`,
    assumptions: [
      'Absence of a tests directory / CI workflow proxies for absence of an automated gate.',
    ],
    recommendation:
      'Add at least a smoke test and a minimal CI run to the revenue-bearing and shared-contract repos first; defer scratch repos.',
    tradeoff: 'CI setup is upfront effort; without it every change is an unhedged release.',
    counter_case:
      'A tiny static asset repo may not warrant CI — prioritize by blast radius, not uniformly.',
    confidence: 'medium',
  };
}

export function reviewHealthRegister(state: WorldState): RegentDecision | null {
  const present = (state.repo_assets ?? []).filter((a) => HEALTH_ADJACENT.has(a.repo));
  if (present.length === 0) return null;
  const names = present.map((a) => a.repo).join(', ');
  return {
    severity: 42,
    faculty: 'Risk',
    title: 'Keep the health-adjacent regulatory register current',
    framework: 'Standing regulatory register (Ethics & Leadership; Governance)',
    observation: `${present.length} health-adjacent repo(s) are in the estate: ${names}. These carry FDA/FTC claims posture and retention obligations distinct from the rest of the portfolio.`,
    assumptions: ['These surfaces make, or could make, health-adjacent claims to end users.'],
    recommendation:
      'Re-affirm the claims/retention controls on these repos this cycle and flag any new user-facing copy for first-pass review before counsel.',
    tradeoff:
      'Review cadence costs time; lapsing it concentrates regulatory risk on the most sensitive surfaces.',
    counter_case:
      'If a repo is purely internal tooling with no user claims, its register entry can be light — scope to actual exposure.',
    confidence: 'medium',
  };
}

// --------------------------------------------------------------------------- //
// General Counsel — standing regulatory first-pass (by domain present)         //
// --------------------------------------------------------------------------- //

const DOMAIN_REGULATORY: Record<string, string> = {
  health_wellness: 'FDA/FTC (health claims, substantiation)',
  retreat_commerce: 'FHA (real-estate intelligence, disparate impact)',
  ip_patent: 'UPL (unauthorized practice of law)',
  productivity_memory: '501(c)(3) private-benefit (Foundation editorial boundary)',
};

export function reviewRegulatoryFirstPass(state: WorldState): RegentDecision | null {
  const present = state.domains
    .filter((d) => DOMAIN_REGULATORY[d.key])
    .map((d) => `${d.name} → ${DOMAIN_REGULATORY[d.key]}`);
  if (present.length === 0) return null;
  return {
    severity: 40,
    faculty: 'Risk',
    title: `General Counsel first-pass: ${present.length} regulated boundary(ies) in scope`,
    framework: 'Standing regulatory register (Ethics & Leadership; Governance)',
    observation: `Boundaries the portfolio touches this cycle: ${present.join('; ')}.`,
    assumptions: ['Each listed domain is live or producing user-facing surfaces this cycle.'],
    recommendation:
      'Hold the line on each boundary: no health/efficacy claim without substantiation, no real-estate output without a disparate-impact check, no IP output that reads as legal advice, no Foundation activity conferring private benefit. Flag any new surface to counsel before launch.',
    tradeoff:
      'A standing register costs review time; skipping it concentrates regulatory risk at launch.',
    counter_case:
      'A domain with no user-facing claims this cycle can carry a light register entry — scope to actual exposure.',
    confidence: 'medium',
  };
}

// --------------------------------------------------------------------------- //
// Chief of Staff — orchestrate the other autonomous bots                       //
// --------------------------------------------------------------------------- //

export function reviewAgentFleet(state: WorldState): RegentDecision | null {
  const fleet = state.agent_activity ?? [];
  if (fleet.length === 0) return null;
  const silentAfter = state.agent_silent_after_days ?? 10;
  const silent = fleet
    .filter((a) => a.last_seen_days > silentAfter)
    .sort((a, b) => b.last_seen_days - a.last_seen_days);
  if (silent.length === 0) return null;
  const names = silent.map((a) => `${a.bot} (${a.last_seen_days}d)`).join(', ');
  return {
    severity: 47,
    faculty: 'People & Orchestration',
    title: `Re-trigger or retire ${silent.length} quiet bot(s) in the fleet`,
    framework: 'Orchestration & span of control (Managing Networks and Organizations)',
    observation: `Autonomous bots silent beyond ${silentAfter}d: ${names}. A bot that has stopped emitting is either blocked or done — neither should sit undeclared.`,
    assumptions: [
      'Emission recency proxies for a working bot; some bots are event-driven and legitimately quiet.',
    ],
    recommendation:
      'Re-trigger each quiet bot once; if it stays silent, mark it event-driven (expected) or schedule a fix. Keep the fleet either running or explicitly parked.',
    tradeoff:
      'Chasing event-driven bots wastes cycles; ignoring a blocked bot loses an intelligence stream.',
    counter_case:
      'A bot designed to fire only on a rare trigger is healthy when quiet — confirm cadence before acting.',
    confidence: 'medium',
  };
}

// --------------------------------------------------------------------------- //
// Merge + agenda                                                               //
// --------------------------------------------------------------------------- //

export function mergeByDomain(cands: RegentDecision[]): RegentDecision[] {
  const groups = new Map<string, RegentDecision[]>();
  const singles: RegentDecision[] = [];
  for (const c of cands) {
    const k = c.domain_key;
    if (k) {
      const g = groups.get(k) ?? [];
      g.push(c);
      groups.set(k, g);
    } else {
      singles.push(c);
    }
  }
  const out: RegentDecision[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      out.push(group[0]!);
      continue;
    }
    group.sort((a, b) => b.severity - a.severity);
    const base: RegentDecision = { ...group[0]! };
    const faculties = new Set(group.map((g) => g.faculty));
    base.corroboration = group.slice(1).map((g) => ({
      faculty: g.faculty,
      framework: g.framework,
      observation: g.observation,
      recommendation: g.recommendation,
    }));
    if (faculties.size > 1) {
      base.severity = Math.min(100, base.severity + 5);
      base.corroborated = true;
    }
    out.push(base);
  }
  return [...out, ...singles];
}

// --------------------------------------------------------------------------- //
// Financial inputs — overlay real, principal-attested figures onto the state.  //
// --------------------------------------------------------------------------- //

export interface DomainFinancials {
  key: string;
  ttm_revenue?: number;
  ttm_direct_cost?: number;
  invested_capital?: number;
  monthly_burn?: number;
  data_freshness_days?: number;
  /** Commercial inputs — light up the CCO (unit economics, churn, pricing). */
  offers?: Offer[];
  /** Acquisition funnel — light up the funnel-leak read. */
  funnel?: FunnelStage[];
}

export interface RegentFinancials {
  as_of?: string;
  cash_on_hand?: number;
  cost_of_capital_pct?: number;
  runway_floor_months?: number;
  committed_inflows?: Array<Record<string, unknown>>;
  domains?: DomainFinancials[];
  funding?: { active_phase?: number; phases?: Array<Record<string, unknown>> };
  /** Provenance. When it contains "illustrative"/"example", the state stays banner-flagged. */
  source?: string;
}

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

/**
 * Overlay real financial figures onto a world-state. Only fields actually
 * supplied take effect; a domain with no supplied figures keeps its unsourced,
 * stale default (so it is excluded from scoring and NAMED — invariant #2 holds).
 * Supplying a domain's figures marks it fresh (scored) unless an explicit
 * freshness is given. Never invents a number.
 */
export function applyFinancials(
  state: WorldState,
  fin: RegentFinancials | null | undefined,
): WorldState {
  if (!fin) return state;
  const byKey = new Map<string, DomainFinancials>();
  for (const d of fin.domains ?? []) byKey.set(d.key, d);

  const domains: Domain[] = state.domains.map((d) => {
    const f = byKey.get(d.key);
    if (!f) return d;
    const supplied =
      num(f.ttm_revenue) !== undefined ||
      num(f.ttm_direct_cost) !== undefined ||
      num(f.invested_capital) !== undefined ||
      num(f.monthly_burn) !== undefined;
    return {
      ...d,
      ttm_revenue: num(f.ttm_revenue) ?? d.ttm_revenue,
      ttm_direct_cost: num(f.ttm_direct_cost) ?? d.ttm_direct_cost,
      invested_capital: num(f.invested_capital) ?? d.invested_capital,
      monthly_burn: num(f.monthly_burn) ?? d.monthly_burn,
      data_freshness_days: num(f.data_freshness_days) ?? (supplied ? 0 : d.data_freshness_days),
      offers: Array.isArray(f.offers) ? f.offers : d.offers,
      funnel: Array.isArray(f.funnel) ? f.funnel : d.funnel,
    };
  });

  const illustrative = /illustrative|example|synthetic|placeholder/i.test(fin.source ?? '');
  return {
    ...state,
    domains,
    as_of: fin.as_of ?? state.as_of,
    cost_of_capital_pct: num(fin.cost_of_capital_pct) ?? state.cost_of_capital_pct,
    runway_floor_months: num(fin.runway_floor_months) ?? state.runway_floor_months,
    treasury: {
      cash_on_hand: num(fin.cash_on_hand) ?? state.treasury.cash_on_hand,
      committed_inflows: fin.committed_inflows ?? state.treasury.committed_inflows,
    },
    funding: fin.funding ?? state.funding,
    _SYNTHETIC: illustrative
      ? (state._SYNTHETIC ?? 'ILLUSTRATIVE financial inputs — not attested actuals.')
      : undefined,
  };
}

/** Every faculty's raw candidate decisions (pre-merge), in deterministic order.
 * Each decision is grounded with the CMU-corpus sources behind its framework. */
export function collectCandidates(state: WorldState, scored: ScoredDomain[]): RegentDecision[] {
  const tre = treasuryView(state, scored);
  const cands: Array<RegentDecision | null> = [
    decisionRunway(state, tre),
    decisionValueDestruction(scored),
    decisionDoubleDown(scored),
    decisionStaleData(scored),
    decisionGate(state),
    decisionUnitEconomics(state, state.domains),
    decisionChurn(state, state.domains),
    decisionFunnel(state, state.domains),
    decisionPricingPower(state, state.domains),
    reviewSecretExposure(state),
    reviewRepoDrift(state),
    reviewProcessCapability(state),
    reviewHealthRegister(state),
    reviewRegulatoryFirstPass(state),
    reviewAgentFleet(state),
  ];
  return cands
    .filter((c): c is RegentDecision => !!c)
    .map((c) => ({ ...c, citations: citeFramework(c.framework) }));
}

export function buildRegentReview(state: WorldState, topN = 5): RegentReview {
  const hurdle = state.cost_of_capital_pct;
  const staleAfter = state.stale_after_days ?? 14;
  const scored = state.domains.map((d) => scoreDomain(d, hurdle, staleAfter));
  const tre = treasuryView(state, scored);

  const decisions = mergeByDomain(collectCandidates(state, scored));
  decisions.sort((a, b) => b.severity - a.severity);
  return {
    agenda: decisions.slice(0, topN),
    deferred: decisions.slice(topN),
    scored,
    treasury: tre,
    staleDomains: scored.filter((d) => d.stale).map((d) => d.name),
  };
}

// --------------------------------------------------------------------------- //
// The executive team — named roles, per-member memos, tensions, Chief of Staff //
// --------------------------------------------------------------------------- //

export const ROLE_BY_FACULTY: Record<string, { title: string; mandate: string }> = {
  Capital: { title: 'Chief Financial Officer', mandate: 'capital, runway, value creation' },
  Strategy: { title: 'Chief Strategy Officer', mandate: 'portfolio, governance, funding gates' },
  Commercial: { title: 'Chief Commercial Officer', mandate: 'pricing, growth, unit economics' },
  Operations: { title: 'Chief Operating Officer', mandate: 'throughput, quality, capacity' },
  Risk: {
    title: 'General Counsel',
    mandate: 'regulatory posture, entity shielding, first-pass legal',
  },
  'People & Orchestration': {
    title: 'Chief of Staff',
    mandate: 'agent orchestration, reconciliation, sequencing',
  },
};

const FACULTY_ORDER = [
  'Capital',
  'Strategy',
  'Commercial',
  'Operations',
  'Risk',
  'People & Orchestration',
];

export type Posture = 'act' | 'watch' | 'hold';

export interface ExecutiveMemo {
  role: string;
  faculty: string;
  mandate: string;
  posture: Posture;
  headline: string;
  stance: string;
  decisions: RegentDecision[];
  /** The CMU courses this executive's reasoning draws on this cycle. */
  corpus_basis: string[];
}

export interface Tension {
  between: [string, string];
  over: string;
  resolution: string;
}

/** A prior agenda item, as recorded in the last decision-log entry. */
export interface PriorAgendaItem {
  title: string;
  severity: number;
}

export interface AgendaDelta {
  new: string[];
  resolved: string[];
  moved: Array<{ title: string; from: number; to: number }>;
  carried: string[];
}

/**
 * Week-over-week diff: compare this week's agenda to the previous logged one.
 * NEW = not present last week; RESOLVED = was present, now gone; MOVED = same
 * title, changed severity; CARRIED = present both weeks, unchanged severity.
 * This is REGENT's institutional memory — a decision that keeps carrying is a
 * stuck decision and deserves escalation.
 */
export function diffAgendas(
  current: RegentDecision[],
  previous: PriorAgendaItem[] | null | undefined,
): AgendaDelta | null {
  if (!previous) return null;
  const prev = new Map(previous.map((p) => [p.title, p.severity]));
  const cur = new Map(current.map((c) => [c.title, c.severity]));
  const delta: AgendaDelta = { new: [], resolved: [], moved: [], carried: [] };
  for (const [title, sev] of cur) {
    if (!prev.has(title)) delta.new.push(title);
    else if (prev.get(title) !== sev) delta.moved.push({ title, from: prev.get(title)!, to: sev });
    else delta.carried.push(title);
  }
  for (const title of prev.keys()) {
    if (!cur.has(title)) delta.resolved.push(title);
  }
  return delta;
}

export interface ExecutiveTeamReview extends RegentReview {
  roles: ExecutiveMemo[];
  tensions: Tension[];
  chief_of_staff: { synthesis: string; sequencing: string[] };
  delta?: AgendaDelta | null;
}

function postureFor(maxSeverity: number): Posture {
  if (maxSeverity >= 70) return 'act';
  if (maxSeverity >= 40) return 'watch';
  return 'hold';
}

function buildMemo(faculty: string, cands: RegentDecision[], state: WorldState): ExecutiveMemo {
  const role = ROLE_BY_FACULTY[faculty]!;
  const mine = cands.filter((c) => c.faculty === faculty).sort((a, b) => b.severity - a.severity);
  const top = mine[0];
  const maxSev = top?.severity ?? 0;
  const posture = postureFor(maxSev);

  let headline: string;
  let stance: string;
  if (top) {
    headline = top.title;
    stance = `${posture.toUpperCase()} — ${top.recommendation}`;
  } else if (faculty === 'People & Orchestration') {
    const fleet = state.agent_activity ?? [];
    headline = fleet.length
      ? `Reconciling ${fleet.length} autonomous bot(s) into one agenda`
      : 'No fleet activity to reconcile this cycle';
    stance = fleet.length
      ? 'HOLD — the fleet is emitting and reconciled; no orchestration action needed.'
      : 'HOLD — no peer bot activity in view.';
  } else {
    headline = `No action required from the ${role.title} this week`;
    stance = 'HOLD — nothing crosses this desk this cycle.';
  }
  return {
    role: role.title,
    faculty,
    mandate: role.mandate,
    posture,
    headline,
    stance,
    decisions: mine,
    corpus_basis: corpusBasis(mine.map((d) => d.framework)),
  };
}

function detectTensions(cands: RegentDecision[], state: WorldState): Tension[] {
  const tensions: Tension[] = [];
  const has = (pred: (c: RegentDecision) => boolean) => cands.some(pred);
  const cfo = ROLE_BY_FACULTY.Capital!.title;
  const cso = ROLE_BY_FACULTY.Strategy!.title;
  const cco = ROLE_BY_FACULTY.Commercial!.title;
  const coo = ROLE_BY_FACULTY.Operations!.title;

  const hasRunway = has((c) => c.faculty === 'Capital' && c.title.toLowerCase().includes('runway'));
  const hasGrowthPush =
    has((c) => c.faculty === 'Capital' && c.title.startsWith('Reallocate')) ||
    has((c) => c.faculty === 'Commercial');
  const hasGate = has((c) => c.title.toLowerCase().includes('gate'));
  const hasProcessSpend = has((c) => c.faculty === 'Operations');

  if (hasRunway && (hasGrowthPush || hasGate)) {
    tensions.push({
      between: [cfo, hasGrowthPush ? cco : cso],
      over: 'liquidity discipline vs. investing for growth/gate progress',
      resolution:
        'Sequence liquidity first: protect the runway floor this week; stage the growth/gate spend behind the next confirmed inflow.',
    });
  }

  const destroyBet = cands.find((c) => {
    if (!(c.faculty === 'Capital' && c.title.startsWith('Fix or sunset'))) return false;
    const dom = state.domains.find((d) => d.key === c.domain_key);
    return dom?.strategic_role === 'bet';
  });
  if (destroyBet) {
    tensions.push({
      between: [cfo, cso],
      over: `whether to sunset a value-destroying domain that Strategy holds as a bet`,
      resolution:
        'Put it on a 90-day turnaround clock with an explicit economic-profit target; sunset only if the clock expires unmet.',
    });
  }

  if (hasRunway && hasProcessSpend) {
    tensions.push({
      between: [cfo, coo],
      over: 'operational investment vs. no runway to fund it',
      resolution:
        'Fund process improvements by reallocation from the lowest-return line, not new burn, until runway clears the floor.',
    });
  }

  return tensions;
}

export function buildExecutiveTeam(
  state: WorldState,
  topN = 5,
  previousAgenda?: PriorAgendaItem[] | null,
): ExecutiveTeamReview {
  const hurdle = state.cost_of_capital_pct;
  const staleAfter = state.stale_after_days ?? 14;
  const scored = state.domains.map((d) => scoreDomain(d, hurdle, staleAfter));
  const tre = treasuryView(state, scored);

  const cands = collectCandidates(state, scored);
  const merged = mergeByDomain(cands);
  merged.sort((a, b) => b.severity - a.severity);
  const agenda = merged.slice(0, topN);
  const deferred = merged.slice(topN);

  const roles = FACULTY_ORDER.map((f) => buildMemo(f, cands, state));
  const tensions = detectTensions(cands, state);

  const high = agenda.filter((d) => d.severity >= 80).length;
  const corr = agenda.filter((d) => d.corroborated).length;
  const actingRoles = roles.filter((r) => r.posture === 'act').map((r) => r.role);
  const lead = agenda[0];
  const delta = diffAgendas(agenda, previousAgenda);
  const deltaLine = delta
    ? ` Since last week: ${delta.new.length} new, ${delta.resolved.length} resolved, ` +
      `${delta.moved.length} moved, ${delta.carried.length} carried` +
      (delta.carried.length
        ? ` (carrying: ${delta.carried.slice(0, 3).join('; ')}${delta.carried.length > 3 ? ' …' : ''} — stuck items deserve escalation).`
        : '.')
    : '';
  const synthesis =
    (agenda.length === 0
      ? 'The executive team reviewed the estate and brings no decision over the action threshold this week — hold course.'
      : `The executive team brings ${agenda.length} decision(s) to the board this week` +
        ` (${high} urgent, ${corr} corroborated across desks)` +
        (tensions.length ? `, with ${tensions.length} cross-desk tension(s) to resolve` : '') +
        `. ${actingRoles.length ? `${actingRoles.join(', ')} ${actingRoles.length === 1 ? 'is' : 'are'} acting; ` : ''}` +
        (lead ? `the board's first call is "${lead.title}" (${lead.faculty}).` : '')) +
    deltaLine +
    ' REGENT advises; the principal decides; counsel confirms legal and tax moves.';
  const sequencing = agenda.map((d) => `${d.faculty}: ${d.title}`);

  return {
    agenda,
    deferred,
    scored,
    treasury: tre,
    staleDomains: scored.filter((d) => d.stale).map((d) => d.name),
    roles,
    tensions,
    chief_of_staff: { synthesis, sequencing },
    delta,
  };
}
