import { corsResponse, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { withRequestMeta } from '../_shared/correlation.ts';
import { withLogger } from '../_shared/log.ts';
import { timingSafeEqual } from '../_shared/signal-utils.ts';

type RssEntry = {
  title: string;
  url?: string;
  snippet?: string;
  source?: string;
  published_at?: string;
};

const DEFAULT_TOPIC = 'R2 futuristic automation upgrades';

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

function cronContext(feeds: string[], entries: RssEntry[]): string {
  return [
    `Cron-driven RSS scout run for ${feeds.length} feeds.`,
    `Collected ${entries.length} recent entries.`,
    'Prioritize actions that can be deployed in R2Works and operator mesh with confidence boundaries.',
  ].join(' ');
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

    const feedsEnv = Deno.env.get('AUTONOMOUS_NEWS_RSS_FEEDS')?.trim() ?? '';
    const feeds = feedsEnv
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    if (feeds.length === 0) {
      return errorResponse('AUTONOMOUS_NEWS_RSS_FEEDS is not configured', 503);
    }

    const topic = Deno.env.get('AUTONOMOUS_UPGRADE_SCOUT_TOPIC')?.trim() || DEFAULT_TOPIC;
    const idempotencyKey = `rss-cron:${new Date().toISOString().slice(0, 13)}`;

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
      log.warn('rss_cron_no_entries', { feeds: feeds.length, feed_errors: feedErrors.length });
      return jsonResponse(
        {
          ok: true,
          status: 'no_entries',
          feeds,
          feed_errors: feedErrors,
        },
        202,
      );
    }

    try {
      const scout = await triggerScout(
        topic,
        cronContext(feeds, uniqueEntries),
        uniqueEntries,
        idempotencyKey,
      );
      return jsonResponse(
        {
          ok: true,
          status: 'triggered',
          feeds_checked: feeds.length,
          entries_used: uniqueEntries.length,
          feed_errors: feedErrors,
          scout_status: scout.status,
          scout_response: scout.body,
        },
        202,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error('rss_cron_trigger_failed', { message, feed_errors: feedErrors });
      return errorResponse(message, 500);
    }
  }),
);
