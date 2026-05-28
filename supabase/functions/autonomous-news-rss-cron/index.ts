import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { withLogger } from '../_shared/log.ts';
import { timingSafeEqual } from '../_shared/signal-utils.ts';
import {
  listConfiguredDrivers,
  resolveDriverRuntime,
  type KbDriverId,
} from '../_shared/autonomous-scout-drivers.ts';

type RssEntry = {
  title: string;
  url?: string;
  snippet?: string;
  source?: string;
  published_at?: string;
};

function readBearer(req: Request): string | null {
  const value = req.headers.get('authorization');
  if (!value) return null;
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match ? (match[1] ?? null) : null;
}

function expectedCronToken(): string {
  return Deno.env.get('AUTONOMOUS_NEWS_CRON_TOKEN')?.trim() ?? '';
}

function decodeEntities(input: string): string {
  return input
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');
}

function stripTags(input: string): string {
  return decodeEntities(
    input
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function extractTag(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
  const value = match?.[1]?.trim();
  return value ? stripTags(value) : undefined;
}

function parseRss(xml: string, source: string): RssEntry[] {
  const itemBlocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((m) => m[1] ?? '');
  return itemBlocks
    .map((item) => ({
      title: extractTag(item, 'title') ?? '',
      url: extractTag(item, 'link'),
      snippet: extractTag(item, 'description'),
      published_at: extractTag(item, 'pubDate'),
      source,
    }))
    .filter((entry) => entry.title.length > 0);
}

async function fetchFeed(url: string): Promise<RssEntry[]> {
  const response = await fetch(url, {
    headers: { 'user-agent': 'r2-autonomous-news-rss-cron/1.0' },
  });
  if (!response.ok) {
    throw new Error(`Feed fetch failed (${response.status}) for ${url}`);
  }
  const xml = await response.text();
  return parseRss(xml, url).slice(0, 6);
}

async function triggerScout(
  driverId: KbDriverId,
  topic: string,
  context: string,
  entries: RssEntry[],
  idempotencyKey: string,
): Promise<{ status: number; body: unknown }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
  const scoutServiceToken = Deno.env.get('AUTONOMOUS_UPGRADE_SCOUT_SERVICE_TOKEN')?.trim();
  if (!supabaseUrl || !scoutServiceToken) {
    throw new Error('SUPABASE_URL and AUTONOMOUS_UPGRADE_SCOUT_SERVICE_TOKEN must be configured');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/autonomous-upgrade-scout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${scoutServiceToken}`,
      'Content-Type': 'application/json',
      'x-idempotency-key': idempotencyKey,
    },
    body: JSON.stringify({
      topic,
      context,
      target_kb_driver: driverId,
      articles: entries,
    }),
  });

  const body = await response.json().catch(() => ({ error: 'non-json response' }));
  if (!response.ok) {
    throw new Error(
      `autonomous-upgrade-scout failed (${response.status}): ${JSON.stringify(body)}`,
    );
  }
  return { status: response.status, body };
}

function cronContext(
  driverId: KbDriverId,
  feeds: string[],
  entries: RssEntry[],
  hint: string,
): string {
  return [
    `Cron-driven RSS scout for KB driver ${driverId}.`,
    `Feeds checked: ${feeds.length}. Entries used: ${entries.length}.`,
    hint,
    'Prioritize production-safe bot actions with confidence boundaries for operator review on /today.',
  ].join(' ');
}

function parseRequestedDrivers(req: Request): KbDriverId[] {
  const url = new URL(req.url);
  const single = url.searchParams.get('driver')?.trim();
  if (single) {
    const allowed = new Set(listConfiguredDrivers());
    if (!allowed.has(single as KbDriverId)) {
      throw new Error(`Unknown driver query param: ${single}`);
    }
    return [single as KbDriverId];
  }
  return listConfiguredDrivers();
}

async function runDriver(
  driverId: KbDriverId,
  hourBucket: string,
): Promise<Record<string, unknown>> {
  const { profile, topic, feeds } = resolveDriverRuntime(driverId);
  if (feeds.length === 0) {
    return { driver: driverId, status: 'skipped', reason: 'no_feeds_configured' };
  }

  const allEntries: RssEntry[] = [];
  const feedErrors: Array<{ feed: string; error: string }> = [];
  for (const feed of feeds) {
    try {
      const entries = await fetchFeed(feed);
      allEntries.push(...entries);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      feedErrors.push({ feed, error: message });
    }
  }

  const uniqueEntries = allEntries
    .filter((entry, index) => index === allEntries.findIndex((other) => other.url === entry.url))
    .slice(0, 12);

  if (uniqueEntries.length === 0) {
    return {
      driver: driverId,
      status: 'no_entries',
      feeds_checked: feeds.length,
      feed_errors: feedErrors,
    };
  }

  const idempotencyKey = `rss-cron:${driverId}:${hourBucket}`;
  const scout = await triggerScout(
    driverId,
    topic,
    cronContext(driverId, feeds, uniqueEntries, profile.contextHint),
    uniqueEntries,
    idempotencyKey,
  );

  return {
    driver: driverId,
    label: profile.label,
    stream: profile.stream,
    status: 'triggered',
    feeds_checked: feeds.length,
    entries_used: uniqueEntries.length,
    feed_errors: feedErrors,
    scout_status: scout.status,
    scout_response: scout.body,
  };
}

Deno.serve(
  withRequestMeta(async (req, meta) => {
    const log = withLogger(meta, 'autonomous-news-rss-cron');
    if (req.method === 'OPTIONS') return corsResponse();
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const expected = expectedCronToken();
    if (expected.length > 0) {
      const supplied = readBearer(req) ?? '';
      if (!supplied || !timingSafeEqual(supplied, expected)) {
        return errorResponse('Unauthorized cron token', 401);
      }
    }

    let drivers: KbDriverId[];
    try {
      drivers = parseRequestedDrivers(req);
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Invalid driver', 400);
    }

    const hourBucket = new Date().toISOString().slice(0, 13);
    const results: Record<string, unknown>[] = [];
    const errors: Array<{ driver: string; error: string }> = [];

    for (const driverId of drivers) {
      try {
        results.push(await runDriver(driverId, hourBucket));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ driver: driverId, error: message });
        log.error('rss_cron_driver_failed', { driver: driverId, message });
      }
    }

    if (results.length === 0 && errors.length > 0) {
      return errorResponse(errors[0]?.error ?? 'All drivers failed', 500);
    }

    return jsonResponse(
      {
        ok: true,
        hour_bucket: hourBucket,
        drivers_requested: drivers,
        results,
        errors,
      },
      202,
    );
  }),
);
