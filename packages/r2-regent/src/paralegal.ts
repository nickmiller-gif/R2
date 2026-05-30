/**
 * REGENT — Paralegal scheduler.
 *
 * Staff to the General Counsel and the Chief of Staff: it keeps the calendar of
 * recurring obligations and deadlines so nothing time-bound slips. Given the
 * world-state and an as-of date it computes a dated schedule — regulatory review
 * cadences, the funding-gate checkpoint, the quarterly cost-of-capital revisit,
 * committed-inflow deadlines, and the weekly executive review.
 *
 * Pure + deterministic (date math takes an explicit as-of, no clock reads).
 * Advisory only: it proposes a schedule; it books nothing.
 */

import type { WorldState } from './review.ts';

export type ScheduleStatus = 'overdue' | 'due_soon' | 'upcoming';

export interface ScheduleItem {
  id: string;
  title: string;
  category: 'governance' | 'regulatory' | 'capital' | 'funding' | 'orchestration' | 'cadence';
  owner: string;
  cadence: string;
  due_date: string; // ISO date
  days_until: number; // negative = overdue
  status: ScheduleStatus;
  source: string;
}

const HEALTH_ADJACENT = new Set(['formahealth', 'smartplrx-trend-tracker', 'health-supplement-tr']);
const DAY_MS = 86_400_000;

function parseDate(iso: string): Date {
  // Treat as UTC midnight to keep day math stable across timezones.
  const d = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/** Next occurrence of a weekday (0=Sun..6=Sat) on or after `asOf`+1. */
function nextWeekday(asOf: Date, weekday: number): Date {
  const d = new Date(asOf.getTime());
  do {
    d.setUTCDate(d.getUTCDate() + 1);
  } while (d.getUTCDay() !== weekday);
  return d;
}

function endOfMonth(asOf: Date): Date {
  return new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + 1, 0));
}

function nextQuarterStart(asOf: Date): Date {
  const q = Math.floor(asOf.getUTCMonth() / 3);
  return new Date(Date.UTC(asOf.getUTCFullYear(), (q + 1) * 3, 1));
}

function statusOf(daysUntil: number, dueSoonWindow = 7): ScheduleStatus {
  if (daysUntil < 0) return 'overdue';
  if (daysUntil <= dueSoonWindow) return 'due_soon';
  return 'upcoming';
}

const DOMAIN_REG_LABEL: Record<string, string> = {
  health_wellness: 'FDA/FTC health-claims',
  retreat_commerce: 'FHA real-estate disparate-impact',
  ip_patent: 'UPL (unauthorized practice of law)',
  productivity_memory: '501(c)(3) private-benefit',
};

export function buildSchedule(state: WorldState, asOfIso?: string): ScheduleItem[] {
  const asOf = parseDate(asOfIso ?? state.as_of ?? new Date().toISOString());
  const items: Omit<ScheduleItem, 'days_until' | 'status'>[] = [];

  // 1. Weekly executive review (REGENT runs Mondays).
  items.push({
    id: 'exec-review-weekly',
    title: 'Weekly executive review (REGENT board agenda)',
    category: 'cadence',
    owner: 'Chief of Staff',
    cadence: 'weekly (Mon)',
    due_date: toIso(nextWeekday(asOf, 1)),
    source: 'REGENT operating cadence',
  });

  // 2. Quarterly cost-of-capital revisit.
  items.push({
    id: 'cost-of-capital-revisit',
    title: 'Revisit the cost-of-capital hurdle and runway floor',
    category: 'capital',
    owner: 'Chief Financial Officer',
    cadence: 'quarterly',
    due_date: toIso(nextQuarterStart(asOf)),
    source: 'principal-set config (revisit quarterly)',
  });

  // 3. Regulatory register review per regulated domain present (month-end).
  const eom = toIso(endOfMonth(asOf));
  for (const d of state.domains) {
    const label = DOMAIN_REG_LABEL[d.key];
    if (!label) continue;
    items.push({
      id: `reg-review-${d.key}`,
      title: `Regulatory register review — ${d.name} (${label})`,
      category: 'regulatory',
      owner: 'General Counsel',
      cadence: 'monthly',
      due_date: eom,
      source: 'standing regulatory register',
    });
  }

  // 4. Health-adjacent claims/retention review (month-end) when a health repo is live.
  const healthRepos = (state.repo_assets ?? []).filter((a) => HEALTH_ADJACENT.has(a.repo));
  if (healthRepos.length > 0) {
    items.push({
      id: 'health-retention-review',
      title: `Health-adjacent claims & 90-day retention review (${healthRepos.map((r) => r.repo).join(', ')})`,
      category: 'regulatory',
      owner: 'General Counsel',
      cadence: 'monthly',
      due_date: eom,
      source: 'health-adjacent retention policy (ADR-0001)',
    });
  }

  // 5. Funding-gate checkpoint (month-end) for the active, uncleared phase.
  const phases = state.funding?.phases ?? [];
  const cur = phases.find((p) => p.phase === state.funding?.active_phase) as
    | Record<string, unknown>
    | undefined;
  if (cur && !cur.gate_cleared) {
    items.push({
      id: `funding-gate-phase-${cur.phase}`,
      title: `Funding-gate checkpoint — Phase ${cur.phase}: ${cur.gate}`,
      category: 'funding',
      owner: 'Chief Strategy Officer',
      cadence: 'monthly',
      due_date: eom,
      source: 'milestone-gated financing',
    });
  }

  // 6. Committed-inflow deadlines (real dates from the treasury).
  for (const inflow of state.treasury.committed_inflows ?? []) {
    const date = typeof inflow.expected_date === 'string' ? inflow.expected_date : null;
    if (!date) continue;
    const source = typeof inflow.source === 'string' ? inflow.source : 'committed inflow';
    items.push({
      id: `inflow-${toIso(parseDate(date))}-${source.slice(0, 16)}`,
      title: `Expected inflow lands: ${source}`,
      category: 'capital',
      owner: 'Chief Financial Officer',
      cadence: 'one-time',
      due_date: toIso(parseDate(date)),
      source: 'treasury committed inflows',
    });
  }

  // 7. Monthly bot-fleet health review (Chief of Staff orchestration).
  if ((state.agent_activity ?? []).length > 0) {
    items.push({
      id: 'fleet-health-review',
      title: `Autonomous bot-fleet health review (${state.agent_activity!.length} bots)`,
      category: 'orchestration',
      owner: 'Chief of Staff',
      cadence: 'monthly',
      due_date: eom,
      source: 'fleet orchestration',
    });
  }

  return items
    .map((it) => {
      const days = daysBetween(asOf, parseDate(it.due_date));
      return { ...it, days_until: days, status: statusOf(days) };
    })
    .sort((a, b) => a.days_until - b.days_until);
}

export interface ParalegalSchedule {
  as_of: string;
  items: ScheduleItem[];
  overdue: number;
  due_soon: number;
  upcoming: number;
}

export function buildParalegalSchedule(state: WorldState, asOfIso?: string): ParalegalSchedule {
  const asOf = asOfIso ?? state.as_of ?? new Date().toISOString().slice(0, 10);
  const items = buildSchedule(state, asOf);
  return {
    as_of: asOf.slice(0, 10),
    items,
    overdue: items.filter((i) => i.status === 'overdue').length,
    due_soon: items.filter((i) => i.status === 'due_soon').length,
    upcoming: items.filter((i) => i.status === 'upcoming').length,
  };
}
