/**
 * REGENT — fleet health assessor (operational observability).
 *
 * Pure, deterministic watchdog logic for the autonomous-bot fleet: given each
 * bot's recent activity plus processing-failure/deadletter counts, it classifies
 * every bot active / quiet / silent, flags expected bots that have gone missing,
 * and raises alerts on failed or deadlettered signals. Advisory only — it
 * reports; it does not restart or mutate anything.
 */

import type { AgentActivity } from './review.ts';

export type BotHealth = 'active' | 'quiet' | 'silent';

export interface FleetBotStatus {
  bot: string;
  last_seen_days: number;
  recent_count: number;
  status: BotHealth;
}

export interface FleetHealthReport {
  healthy: boolean;
  bots: FleetBotStatus[];
  missing: string[];
  failed_signals: number;
  deadletter_backlog: number;
  alerts: string[];
}

/** The bots that should be emitting on a regular cadence. A long silence is an alert. */
export const EXPECTED_FLEET_BOTS = [
  'autonomous-upgrade-scout',
  'autonomous-information-audit',
  'autonomous-revolutionary-mesh',
  'autonomous-steward-cycle',
  'autonomous-regent-review',
  'autonomous-paralegal-schedule',
];

export function assessFleetHealth(input: {
  bots: AgentActivity[];
  failedSignals?: number;
  deadletterBacklog?: number;
  expectedBots?: string[];
  quietAfterDays?: number;
  silentAfterDays?: number;
}): FleetHealthReport {
  const quietAfter = input.quietAfterDays ?? 3;
  const silentAfter = input.silentAfterDays ?? 10;
  const failed = input.failedSignals ?? 0;
  const deadletter = input.deadletterBacklog ?? 0;
  const expected = input.expectedBots ?? EXPECTED_FLEET_BOTS;

  const bots: FleetBotStatus[] = input.bots.map((b) => ({
    bot: b.bot,
    last_seen_days: b.last_seen_days,
    recent_count: b.recent_count,
    status:
      b.last_seen_days > silentAfter
        ? 'silent'
        : b.last_seen_days > quietAfter
          ? 'quiet'
          : 'active',
  }));

  const present = new Set(input.bots.map((b) => b.bot));
  const missing = expected.filter((e) => !present.has(e));

  const alerts: string[] = [];
  for (const b of bots) {
    if (b.status === 'silent')
      alerts.push(`${b.bot} silent ${b.last_seen_days}d — re-trigger or retire`);
  }
  for (const m of missing)
    alerts.push(`${m} has no recent activity at all — verify it is deployed/scheduled`);
  if (failed > 0) alerts.push(`${failed} signal(s) failed processing — inspect and replay`);
  if (deadletter > 0) alerts.push(`${deadletter} signal(s) in the deadletter backlog — drain`);

  return {
    healthy: alerts.length === 0,
    bots: bots.sort((a, b) => b.last_seen_days - a.last_seen_days),
    missing,
    failed_signals: failed,
    deadletter_backlog: deadletter,
    alerts,
  };
}
