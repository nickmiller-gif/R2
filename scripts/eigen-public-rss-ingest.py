#!/usr/bin/env python3
"""
Fetch RSS or Atom feeds and POST each item link to eigen-fetch-ingest (eigen_public).

Use for /news, /blog, or any feed that lists recent public HTML pages.

Requirements:
  - SUPABASE_URL, AUTH_BEARER (member JWT)

Optional env:
  - EIGEN_PUBLIC_RSS_URLS: comma-separated feed URLs (if no CLI args)
  - EIGEN_FETCH_INGEST_DELAY_SEC (default 0.35)
  - EIGEN_PUBLIC_FETCH_CONCURRENCY: parallel in-flight ingests, 1–16 (default 1)
  - EIGEN_PUBLIC_FETCH_MAX_BYTES: max feed XML size (default 25MiB; 0 = unlimited, capped at 100MiB)
  - EIGEN_PUBLIC_RSS_MAX_ITEMS_PER_FEED (default 80, cap per feed before dedupe)
  - EIGEN_PUBLIC_RSS_MAX_URLS: global cap after dedupe (default 300)
  - EIGEN_PUBLIC_INGEST_STRICT_EXIT: if 0/false, exit 0 when some URLs fail

Usage:
  python3 scripts/eigen-public-rss-ingest.py https://example.com/feed.xml

Oracle outbox: see eigen-public-sitemap-ingest.py module docstring (drain + backfill notes).
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlparse

_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from eigen_public_ingest_http import (  # noqa: E402
    fetch_bytes,
    normalize_supabase_base_url,
    read_int_env,
    read_non_negative_float,
    read_optional_max_fetch_bytes,
    run_fetch_ingest_batch,
    strict_exit_enabled,
)


def _local(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[-1]
    return tag


def extract_item_links_from_feed(data: bytes) -> list[str]:
    """Parse RSS 2.0 or Atom and return article/page URLs in order.

    RSS uses local tag names so default xmlns feeds (WordPress, etc.) still match.
    """
    root = ET.fromstring(data)
    root_name = _local(root.tag)
    out: list[str] = []

    if root_name == "rss":
        channel = None
        for child in root:
            if _local(child.tag) == "channel":
                channel = child
                break
        if channel is None:
            return out
        for item in channel:
            if _local(item.tag) != "item":
                continue
            link_text: str | None = None
            for el in item:
                if _local(el.tag) == "link" and (el.text or "").strip():
                    link_text = el.text.strip()
                    break
            if link_text:
                out.append(link_text)
                continue
            for el in item:
                if _local(el.tag) != "guid":
                    continue
                if (el.text or "").strip():
                    t = el.text.strip()
                    if t.startswith("http://") or t.startswith("https://"):
                        out.append(t)
                break

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


def main() -> int:
    bearer = os.environ.get("AUTH_BEARER", "").strip()
    if not bearer:
        print("Set AUTH_BEARER (member JWT).", file=sys.stderr)
        return 1
    try:
        supabase = normalize_supabase_base_url(os.environ.get("SUPABASE_URL", ""))
    except ValueError as e:
        print(str(e), file=sys.stderr)
        return 1

    delay = read_non_negative_float("EIGEN_FETCH_INGEST_DELAY_SEC", 0.35)
    max_per_feed = read_int_env("EIGEN_PUBLIC_RSS_MAX_ITEMS_PER_FEED", 80, min_v=1, max_v=10_000)
    max_urls = read_int_env("EIGEN_PUBLIC_RSS_MAX_URLS", 300, min_v=1, max_v=50_000)
    concurrency = read_int_env("EIGEN_PUBLIC_FETCH_CONCURRENCY", 1, min_v=1, max_v=16)
    max_fetch = read_optional_max_fetch_bytes()

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
            raw = fetch_bytes(
                feed_url,
                user_agent="EigenPublicRssIngest/1.1",
                timeout=90.0,
                max_response_bytes=max_fetch,
            )
        except (OSError, ValueError) as e:
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

    to_ingest: list[str] = []
    for url in uniq:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            print(f"[skip] non-http(s) {url!r}", file=sys.stderr)
            continue
        to_ingest.append(url)

    if not to_ingest:
        print(
            json.dumps(
                {
                    "ok": 0,
                    "failed": 0,
                    "skipped_scheme": len(uniq),
                    "total": 0,
                    "feeds": len(feeds),
                },
            ),
        )
        return 0

    feed_hash = hashlib.sha256(",".join(sorted(feeds)).encode()).hexdigest()[:16]
    idem_fragment = f"rss:{feed_hash}"

    if concurrency > 1:
        print(
            f"Ingesting {len(to_ingest)} URL(s), concurrency={concurrency}, "
            f"min interval between starts={delay}s",
            file=sys.stderr,
        )

    def on_progress(i: int, total: int, url: str) -> None:
        print(f"[{i}/{total}] {url}", file=sys.stderr)

    def on_result(url: str, success: bool, msg: str) -> None:
        if not success:
            print(f"  FAIL: {url}\n    {msg[:800]}", file=sys.stderr)

    ok_n, fail_n = run_fetch_ingest_batch(
        to_ingest,
        base_url=supabase,
        bearer=bearer,
        idem_fragment=idem_fragment,
        delay_sec=delay,
        concurrency=concurrency,
        on_progress=on_progress,
        on_result=on_result,
    )

    skipped = len(uniq) - len(to_ingest)
    summary = {
        "ok": ok_n,
        "failed": fail_n,
        "skipped_scheme": skipped,
        "total": len(to_ingest),
        "feeds": len(feeds),
        "concurrency": concurrency,
    }
    print(json.dumps(summary))
    if fail_n == 0:
        return 0
    if strict_exit_enabled():
        return 2
    print(
        f"[warn] {fail_n} failure(s); exiting 0 because EIGEN_PUBLIC_INGEST_STRICT_EXIT is off",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
