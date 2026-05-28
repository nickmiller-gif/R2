/**
 * KB-four autonomous upgrade-scout driver profiles.
 * Env overrides: AUTONOMOUS_NEWS_RSS_FEEDS_<DRIVER>, AUTONOMOUS_UPGRADE_SCOUT_TOPIC_<DRIVER>
 * Global fallback: AUTONOMOUS_NEWS_RSS_FEEDS, AUTONOMOUS_UPGRADE_SCOUT_TOPIC
 */

export type KbDriverId = 'centralr2' | 'operator_workbench' | 'r2chart' | 'ip_pulse_point';

export type ScoutDriverProfile = {
  id: KbDriverId;
  label: string;
  stream: string;
  defaultTopic: string;
  defaultFeeds: string[];
  contextHint: string;
};

export const SCOUT_DRIVER_PROFILES: ScoutDriverProfile[] = [
  {
    id: 'centralr2',
    label: 'CentralR2',
    stream: 'Stream A',
    defaultTopic: 'CentralR2 producer automation and real-estate intelligence upgrades',
    defaultFeeds: [
      'https://www.costar.com/rss/news',
      'https://techcrunch.com/category/real-estate/feed/',
    ],
    contextHint:
      'Prioritize rental-analysis, property-lookup, valuation scenarios, and mesh_signal_correlated freshness on Eigen.',
  },
  {
    id: 'operator_workbench',
    label: 'R2Works',
    stream: 'Stream D',
    defaultTopic: 'R2Works operator mesh upgrades for Today, Convergence, and Friction Zero',
    defaultFeeds: [
      'https://techcrunch.com/category/artificial-intelligence/feed/',
      'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    ],
    contextHint:
      'Prioritize operator triage UX, autonomy confidence boundaries, Truth Market promotion, and Friction Zero emit flows.',
  },
  {
    id: 'r2chart',
    label: 'R2Chart',
    stream: 'Truth Market',
    defaultTopic: 'R2Chart continuity and charter governance upgrade opportunities',
    defaultFeeds: ['https://feeds.feedburner.com/oreilly/radar/atom'],
    contextHint:
      'Prioritize continuity-ingest-signal hardening, charter operator gates, and governance gap promotion.',
  },
  {
    id: 'ip_pulse_point',
    label: 'R2-IP',
    stream: 'Stream E',
    defaultTopic: 'R2-IP patent intelligence and ip_matter_event producer upgrades',
    defaultFeeds: [
      'https://www.uspto.gov/rss/patents.xml',
      'https://techcrunch.com/category/artificial-intelligence/feed/',
    ],
    contextHint:
      'Prioritize ip-router redeploy, patent_analysis_complete emits, UPL-safe copy, and commons publication paths.',
  },
];

function envKey(driver: KbDriverId, suffix: string): string {
  return `AUTONOMOUS_${suffix}_${driver.toUpperCase()}`;
}

function parseFeedList(raw: string | undefined, fallback: string[]): string[] {
  if (!raw?.trim()) return fallback;
  const parsed = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return parsed.length > 0 ? parsed : fallback;
}

export function listConfiguredDrivers(): KbDriverId[] {
  const raw = Deno.env.get('AUTONOMOUS_NEWS_DRIVERS')?.trim();
  if (!raw) return SCOUT_DRIVER_PROFILES.map((p) => p.id);
  const allowed = new Set(SCOUT_DRIVER_PROFILES.map((p) => p.id));
  const selected = raw
    .split(',')
    .map((entry) => entry.trim() as KbDriverId)
    .filter((entry) => allowed.has(entry));
  return selected.length > 0 ? selected : SCOUT_DRIVER_PROFILES.map((p) => p.id);
}

export function resolveDriverProfile(driverId: KbDriverId): ScoutDriverProfile {
  const profile = SCOUT_DRIVER_PROFILES.find((p) => p.id === driverId);
  if (!profile) throw new Error(`Unknown scout driver: ${driverId}`);
  return profile;
}

export function resolveDriverRuntime(driverId: KbDriverId): {
  profile: ScoutDriverProfile;
  topic: string;
  feeds: string[];
} {
  const profile = resolveDriverProfile(driverId);
  const globalFeeds = Deno.env.get('AUTONOMOUS_NEWS_RSS_FEEDS')?.trim();
  const driverFeeds = Deno.env.get(envKey(driverId, 'NEWS_RSS_FEEDS'))?.trim();
  const globalTopic = Deno.env.get('AUTONOMOUS_UPGRADE_SCOUT_TOPIC')?.trim();
  const driverTopic = Deno.env.get(envKey(driverId, 'UPGRADE_SCOUT_TOPIC'))?.trim();

  const feeds = parseFeedList(driverFeeds ?? globalFeeds, profile.defaultFeeds);
  const topic = driverTopic || globalTopic || profile.defaultTopic;

  return { profile, topic, feeds };
}

export function parseKbDriverId(value: unknown): KbDriverId | null {
  if (
    value === 'centralr2' ||
    value === 'operator_workbench' ||
    value === 'r2chart' ||
    value === 'ip_pulse_point'
  ) {
    return value;
  }
  return null;
}
