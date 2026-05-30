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
  treasury: { cash_on_hand: number; committed_inflows?: Array<Record<string, unknown>> };
  funding?: { active_phase?: number; phases?: Array<Record<string, unknown>> };
  domains: Domain[];
  repo_assets?: RepoAsset[];
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

export function buildRegentReview(state: WorldState, topN = 5): RegentReview {
  const hurdle = state.cost_of_capital_pct;
  const staleAfter = state.stale_after_days ?? 14;
  const scored = state.domains.map((d) => scoreDomain(d, hurdle, staleAfter));
  const tre = treasuryView(state, scored);

  const cands: Array<RegentDecision | null> = [
    decisionRunway(state, tre),
    decisionValueDestruction(scored),
    decisionDoubleDown(scored),
    decisionStaleData(scored),
    decisionGate(state),
    decisionUnitEconomics(state, state.domains),
    decisionChurn(state, state.domains),
    reviewSecretExposure(state),
    reviewRepoDrift(state),
    reviewProcessCapability(state),
    reviewHealthRegister(state),
  ];

  const decisions = mergeByDomain(cands.filter((c): c is RegentDecision => !!c));
  decisions.sort((a, b) => b.severity - a.severity);
  return {
    agenda: decisions.slice(0, topN),
    deferred: decisions.slice(topN),
    scored,
    treasury: tre,
    staleDomains: scored.filter((d) => d.stale).map((d) => d.name),
  };
}
