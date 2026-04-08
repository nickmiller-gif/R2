#!/usr/bin/env python3
"""
Discover page URLs from public sitemap(s) and POST each to eigen-fetch-ingest.

Security model:
  - Only URLs whose host is allowed by EIGEN_FETCH_ALLOWLIST on the server will ingest (403 otherwise).
  - eigen-fetch-ingest indexes only the eigen_public corpus.

Requirements:
  - SUPABASE_URL
  - AUTH_BEARER: Supabase JWT for a user with member role (same as other ingest scripts)

Optional env:
  - EIGEN_PUBLIC_SITEMAP_URLS: comma-separated sitemap URLs (used if no CLI args)
  - EIGEN_FETCH_INGEST_DELAY_SEC: sleep between requests (default 0.35)
  - EIGEN_PUBLIC_SITEMAP_MAX_URLS: cap after dedupe (default 500)
  - EIGEN_PUBLIC_SITEMAP_MAX_DEPTH: max nested sitemap index depth (default 4)

Usage:
  python3 scripts/eigen-public-sitemap-ingest.py https://example.com/sitemap.xml
  EIGEN_PUBLIC_SITEMAP_URLS=https://a.com/sitemap.xml,https://b.com/page python3 scripts/eigen-public-sitemap-ingest.py

For sitemap + RSS + a public file folder in one run, see scripts/eigen-public-corpus-ingest.sh
and docs/eigen-public-corpus.md.
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
        headers={"User-Agent": "EigenPublicSitemapIngest/1.0"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _parse_sitemap_xml(data: bytes) -> tuple[list[str], list[str]]:
    """Returns (page_locs, nested_sitemap_locs)."""
    root = ET.fromstring(data)
    root_name = _local(root.tag)
    pages: list[str] = []
    nested: list[str] = []
    if root_name == "sitemapindex":
        for el in root:
            if _local(el.tag) != "sitemap":
                continue
            for child in el:
                if _local(child.tag) == "loc" and (child.text or "").strip():
                    nested.append(child.text.strip())
    elif root_name == "urlset":
        for el in root:
            if _local(el.tag) != "url":
                continue
            for child in el:
                if _local(child.tag) == "loc" and (child.text or "").strip():
                    pages.append(child.text.strip())
    return pages, nested


def collect_page_urls(
    seeds: Iterable[str],
    *,
    max_depth: int,
    seen_sitemaps: set[str] | None = None,
    depth: int = 0,
) -> list[str]:
    seen_sitemaps = seen_sitemaps if seen_sitemaps is not None else set()
    out: list[str] = []
    for seed in seeds:
        seed = seed.strip()
        if not seed or seed in seen_sitemaps:
            continue
        seen_sitemaps.add(seed)
        try:
            raw = _fetch_bytes(seed)
        except (urllib.error.URLError, OSError) as e:
            print(f"[warn] sitemap fetch failed {seed!r}: {e}", file=sys.stderr)
            continue
        pages, nested = _parse_sitemap_xml(raw)
        out.extend(pages)
        if depth < max_depth and nested:
            out.extend(
                collect_page_urls(
                    nested,
                    max_depth=max_depth,
                    seen_sitemaps=seen_sitemaps,
                    depth=depth + 1,
                )
            )
    return out


def post_fetch_ingest(
    base_url: str,
    bearer: str,
    page_url: str,
    delay_sec: float,
) -> tuple[bool, str]:
    time.sleep(delay_sec)
    payload = json.dumps({"url": page_url}).encode("utf-8")
    idem = hashlib.sha256(f"sitemap|{page_url}".encode()).hexdigest()[:48]
    req = urllib.request.Request(
        f"{base_url.rstrip('/')}/functions/v1/eigen-fetch-ingest",
        data=payload,
        headers={
            "Authorization": f"Bearer {bearer}",
            "Content-Type": "application/json",
            "x-idempotency-key": f"sitemap:{idem}",
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
    max_urls = int(os.environ.get("EIGEN_PUBLIC_SITEMAP_MAX_URLS") or "500")
    max_depth = int(os.environ.get("EIGEN_PUBLIC_SITEMAP_MAX_DEPTH") or "4")

    cli = [a.strip() for a in sys.argv[1:] if a.strip()]
    env_seeds = [
        s.strip()
        for s in (os.environ.get("EIGEN_PUBLIC_SITEMAP_URLS") or "").split(",")
        if s.strip()
    ]
    seeds = cli if cli else env_seeds
    if not seeds:
        print(
            "Provide sitemap URL(s) as arguments or set EIGEN_PUBLIC_SITEMAP_URLS.",
            file=sys.stderr,
        )
        return 1

    print("Collecting page URLs from sitemap(s)...", file=sys.stderr)
    pages = collect_page_urls(seeds, max_depth=max_depth)
    # Single URL that is an HTML page (not a sitemap) — allow passing a direct page list via one "sitemap" that 404s as xml? Skip.
    # If user passes a normal page URL as only seed, try treating as single page.
    if not pages and len(seeds) == 1:
        u = urlparse(seeds[0])
        if u.scheme in ("http", "https") and u.path and not u.path.lower().endswith(".xml"):
            pages = [seeds[0]]
            print("Interpreting single non-XML URL as one page to ingest.", file=sys.stderr)

    uniq: list[str] = []
    seen: set[str] = set()
    for p in pages:
        if p not in seen:
            seen.add(p)
            uniq.append(p)
    if len(uniq) > max_urls:
        print(f"[warn] truncating from {len(uniq)} to {max_urls} URLs", file=sys.stderr)
        uniq = uniq[:max_urls]

    ok_n = 0
    fail_n = 0
    for i, url in enumerate(uniq, 1):
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            print(f"[skip] non-http(s) {url!r}", file=sys.stderr)
            continue
        print(f"[{i}/{len(uniq)}] {url}", file=sys.stderr)
        ok, msg = post_fetch_ingest(supabase, bearer, url, delay_sec=delay)
        if ok:
            ok_n += 1
        else:
            fail_n += 1
            print(f"  FAIL: {msg[:500]}", file=sys.stderr)

    print(json.dumps({"ok": ok_n, "failed": fail_n, "total": len(uniq)}))
    return 0 if fail_n == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
