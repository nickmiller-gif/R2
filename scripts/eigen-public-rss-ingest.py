#!/usr/bin/env python3
"""
Fetch RSS or Atom feeds and POST each item link to eigen-fetch-ingest (eigen_public).

Use for /news, /blog, or any feed that lists recent public HTML pages.

Requirements:
  - SUPABASE_URL, AUTH_BEARER (member JWT)

Optional env:
  - EIGEN_PUBLIC_RSS_URLS: comma-separated feed URLs (if no CLI args)
  - EIGEN_FETCH_INGEST_DELAY_SEC (default 0.35)
  - EIGEN_PUBLIC_RSS_MAX_ITEMS_PER_FEED (default 80, cap per feed before dedupe)
  - EIGEN_PUBLIC_RSS_MAX_URLS: global cap after dedupe (default 300)

Usage:
  python3 scripts/eigen-public-rss-ingest.py https://example.com/feed.xml

Oracle outbox: see eigen-public-sitemap-ingest.py module docstring (drain + backfill notes).
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from typing import Iterable
from urllib.parse import urlparse


def _local(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[-1]
    return tag


def _fetch_bytes(url: str, timeout: float = 60.0) -> bytes:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "EigenPublicRssIngest/1.0"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def extract_item_links_from_feed(data: bytes) -> list[str]:
    """Parse RSS 2.0 or Atom and return article/page URLs in order."""
    root = ET.fromstring(data)
    root_name = _local(root.tag)
    out: list[str] = []

    if root_name == "rss":
        channel = root.find("channel")
        if channel is None:
            return out
        for item in channel.findall("item"):
            link_el = item.find("link")
            if link_el is not None and (link_el.text or "").strip():
                out.append(link_el.text.strip())
                continue
            guid_el = item.find("guid")
            if guid_el is not None and (guid_el.text or "").strip():
                t = guid_el.text.strip()
                if t.startswith("http://") or t.startswith("https://"):
                    out.append(t)

    elif root_name == "feed":
        for entry in root:
            if _local(entry.tag) != "entry":
                continue
            alternate: list[tuple[str, str]] = []
            for child in entry:
                if _local(child.tag) != "link":
                    continue
                href = (child.get("href") or "").strip()
                if not href:
                    continue
                rel = (child.get("rel") or "alternate").lower()
                typ = (child.get("type") or "").lower()
                if rel in ("alternate", "self"):
                    alternate.append((href, typ))
            chosen: str | None = None
            for href, typ in alternate:
                if "html" in typ or "xhtml" in typ:
                    chosen = href
                    break
            if not chosen and alternate:
                chosen = alternate[0][0]
            if not chosen:
                for child in entry:
                    if _local(child.tag) != "link":
                        continue
                    href = (child.get("href") or "").strip()
                    if href:
                        chosen = href
                        break
            if not chosen:
                id_el = next((c for c in entry if _local(c.tag) == "id"), None)
                if id_el is not None and (id_el.text or "").strip():
                    t = id_el.text.strip()
                    if t.startswith("http://") or t.startswith("https://"):
                        chosen = t
            if chosen:
                out.append(chosen)

    return out


def post_fetch_ingest(
    base_url: str,
    bearer: str,
    page_url: str,
    delay_sec: float,
    idem_prefix: str,
) -> tuple[bool, str]:
    time.sleep(delay_sec)
    payload = json.dumps({"url": page_url}).encode("utf-8")
    idem = hashlib.sha256(f"{idem_prefix}|{page_url}".encode()).hexdigest()[:48]
    req = urllib.request.Request(
        f"{base_url.rstrip('/')}/functions/v1/eigen-fetch-ingest",
        data=payload,
        headers={
            "Authorization": f"Bearer {bearer}",
            "Content-Type": "application/json",
            "x-idempotency-key": f"{idem_prefix}:{idem}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            if 200 <= resp.status < 300:
                return True, body
            return False, f"HTTP {resp.status} {body}"
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        return False, f"HTTP {e.code} {err}"
    except (urllib.error.URLError, OSError) as e:
        return False, str(e)


def main() -> int:
    supabase = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    bearer = os.environ.get("AUTH_BEARER", "").strip()
    if not supabase or not bearer:
        print("Set SUPABASE_URL and AUTH_BEARER (member JWT).", file=sys.stderr)
        return 1

    delay = float(os.environ.get("EIGEN_FETCH_INGEST_DELAY_SEC") or "0.35")
    max_per_feed = int(os.environ.get("EIGEN_PUBLIC_RSS_MAX_ITEMS_PER_FEED") or "80")
    max_urls = int(os.environ.get("EIGEN_PUBLIC_RSS_MAX_URLS") or "300")

    cli = [a.strip() for a in sys.argv[1:] if a.strip()]
    env_feeds = [
        s.strip()
        for s in (os.environ.get("EIGEN_PUBLIC_RSS_URLS") or "").split(",")
        if s.strip()
    ]
    feeds: list[str] = cli if cli else env_feeds
    if not feeds:
        print(
            "Provide feed URL(s) as arguments or set EIGEN_PUBLIC_RSS_URLS.",
            file=sys.stderr,
        )
        return 1

    all_links: list[str] = []
    for feed_url in feeds:
        try:
            raw = _fetch_bytes(feed_url)
        except (urllib.error.URLError, OSError) as e:
            print(f"[warn] feed fetch failed {feed_url!r}: {e}", file=sys.stderr)
            continue
        try:
            links = extract_item_links_from_feed(raw)
        except ET.ParseError as e:
            print(f"[warn] feed parse failed {feed_url!r}: {e}", file=sys.stderr)
            continue
        if len(links) > max_per_feed:
            print(
                f"[warn] truncating feed {feed_url!r} from {len(links)} to {max_per_feed} items",
                file=sys.stderr,
            )
            links = links[:max_per_feed]
        all_links.extend(links)

    uniq: list[str] = []
    seen: set[str] = set()
    for p in all_links:
        if p not in seen:
            seen.add(p)
            uniq.append(p)
    if len(uniq) > max_urls:
        print(f"[warn] truncating global list from {len(uniq)} to {max_urls}", file=sys.stderr)
        uniq = uniq[:max_urls]

    ok_n = 0
    fail_n = 0
    feed_hash = hashlib.sha256(",".join(sorted(feeds)).encode()).hexdigest()[:16]
    for i, url in enumerate(uniq, 1):
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            print(f"[skip] non-http(s) {url!r}", file=sys.stderr)
            continue
        print(f"[{i}/{len(uniq)}] {url}", file=sys.stderr)
        ok, msg = post_fetch_ingest(
            supabase,
            bearer,
            url,
            delay_sec=delay,
            idem_prefix=f"rss:{feed_hash}",
        )
        if ok:
            ok_n += 1
        else:
            fail_n += 1
            print(f"  FAIL: {msg[:500]}", file=sys.stderr)

    print(json.dumps({"ok": ok_n, "failed": fail_n, "total": len(uniq), "feeds": len(feeds)}))
    return 0 if fail_n == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
