import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const registryPath = path.join(rootDir, "config", "eigen-sites.json");

const safeSiteId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const safeHost = /^(?:[a-z0-9-]+\.)+[a-z0-9-]+$/i;

function fail(message) {
  throw new Error(message);
}

function normalizeHost(value) {
  return value.toLowerCase();
}

function hostsOverlap(left, right) {
  return left === right || left.endsWith(`.${right}`) || right.endsWith(`.${left}`);
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    fail(`${label} must be a non-empty string.`);
  }
}

function assertStringArray(value, label) {
  if (!Array.isArray(value)) {
    fail(`${label} must be an array.`);
  }

  value.forEach((item, index) => {
    if (typeof item !== "string" || !item.trim()) {
      fail(`${label}[${index}] must be a non-empty string.`);
    }
  });
}

function assertUniqueEntries(values, label, normalize = (value) => value) {
  const seen = new Map();
  values.forEach((value) => {
    const normalizedValue = normalize(value);
    if (seen.has(normalizedValue)) {
      fail(`${label} contains duplicate value "${value}".`);
    }
    seen.set(normalizedValue, value);
  });
}

function assertHttpUrls(values, label) {
  values.forEach((value) => {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      fail(`${label} entry "${value}" must be a valid http(s) URL.`);
    }

    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || !parsed.hostname) {
      fail(`${label} entry "${value}" must be a valid http(s) URL.`);
    }
  });
}

function assertHosts(values, label) {
  values.forEach((value) => {
    if (value !== value.trim() || /\s/.test(value)) {
      fail(`${label} entry "${value}" must not include whitespace.`);
    }

    const normalizedValue = normalizeHost(value);
    if (
      !safeHost.test(normalizedValue) ||
      normalizedValue.includes("/") ||
      normalizedValue.includes(":")
    ) {
      fail(`${label} entry "${value}" must be a bare host without protocol, port, or path.`);
    }
  });
}

const rawRegistry = fs.readFileSync(registryPath, "utf8");
const parsedRegistry = JSON.parse(rawRegistry);

if (!parsedRegistry || typeof parsedRegistry !== "object" || Array.isArray(parsedRegistry)) {
  fail("config/eigen-sites.json must parse to an object.");
}

assertNonEmptyString(parsedRegistry._instructions, "config/eigen-sites.json _instructions");

const { sites } = parsedRegistry;
if (!sites || typeof sites !== "object" || Array.isArray(sites)) {
  fail("config/eigen-sites.json must expose a top-level sites object.");
}

const siteEntries = Object.entries(sites);
if (siteEntries.length === 0) {
  fail("config/eigen-sites.json must contain at least one site entry.");
}

const seenFilesDirs = new Map();
const seenAllowlistHosts = new Map();
let totalAllowlistHosts = 0;

for (const [siteId, siteConfig] of siteEntries) {
  if (!safeSiteId.test(siteId)) {
    fail(`Site id "${siteId}" must use lowercase letters, numbers, and single hyphens only.`);
  }

  if (!siteConfig || typeof siteConfig !== "object" || Array.isArray(siteConfig)) {
    fail(`Site config for "${siteId}" must be an object.`);
  }

  assertNonEmptyString(siteConfig.display_name, `${siteId}.display_name`);
  assertNonEmptyString(siteConfig.files_dir, `${siteId}.files_dir`);
  assertNonEmptyString(siteConfig.notes, `${siteId}.notes`);
  assertStringArray(siteConfig.sitemaps, `${siteId}.sitemaps`);
  assertStringArray(siteConfig.rss_feeds, `${siteId}.rss_feeds`);
  assertStringArray(siteConfig.fetch_allowlist, `${siteId}.fetch_allowlist`);
  assertUniqueEntries(siteConfig.sitemaps, `${siteId}.sitemaps`);
  assertUniqueEntries(siteConfig.rss_feeds, `${siteId}.rss_feeds`);
  assertUniqueEntries(siteConfig.fetch_allowlist, `${siteId}.fetch_allowlist`, normalizeHost);
  assertHttpUrls(siteConfig.sitemaps, `${siteId}.sitemaps`);
  assertHttpUrls(siteConfig.rss_feeds, `${siteId}.rss_feeds`);
  assertHosts(siteConfig.fetch_allowlist, `${siteId}.fetch_allowlist`);

  if (!siteConfig.files_dir.startsWith("knowledge/") || siteConfig.files_dir.includes("..") || siteConfig.files_dir.endsWith("/")) {
    fail(`${siteId}.files_dir must stay inside knowledge/ without parent traversal or a trailing slash.`);
  }

  if (seenFilesDirs.has(siteConfig.files_dir)) {
    fail(
      `${siteId}.files_dir duplicates ${seenFilesDirs.get(siteConfig.files_dir)}.files_dir (${siteConfig.files_dir}).`
    );
  }
  seenFilesDirs.set(siteConfig.files_dir, siteId);

  if (siteConfig.fetch_allowlist.length === 0) {
    fail(`${siteId}.fetch_allowlist must contain at least one allowed host.`);
  }

  for (const host of siteConfig.fetch_allowlist) {
    const normalizedHost = normalizeHost(host);

    for (const [claimedHost, claimedSiteId] of seenAllowlistHosts.entries()) {
      if (hostsOverlap(normalizedHost, claimedHost)) {
        fail(
          `${siteId}.fetch_allowlist host "${host}" overlaps "${claimedHost}" already claimed by ${claimedSiteId}.`
        );
      }
    }

    seenAllowlistHosts.set(normalizedHost, siteId);
    totalAllowlistHosts += 1;
  }
}

console.log(
  `Validated ${siteEntries.length} eigen site entries, ${seenFilesDirs.size} files_dir mapping(s), and ${totalAllowlistHosts} allowlisted host(s).`
);
