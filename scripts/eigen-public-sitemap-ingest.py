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
  - EIGEN_FETCH_INGEST_DELAY_SEC: min seconds between starting each ingest request (default 0.35)
  - EIGEN_PUBLIC_FETCH_CONCURRENCY: parallel in-flight ingests, 1–16 (default 1). With >1, delay still
    spaces *starts* globally so you do not hammer the edge function.
  - EIGEN_PUBLIC_SITEMAP_MAX_URLS: cap after dedupe (default 500)
  - EIGEN_PUBLIC_SITEMAP_MAX_DEPTH: max nested sitemap index depth (default 4)
  - EIGEN_PUBLIC_FETCH_MAX_BYTES: max sitemap XML response size (default 25MiB; 0 = unlimited, capped at 100MiB)
  - EIGEN_PUBLIC_INGEST_STRICT_EXIT: if 0/false, exit 0 even when some URLs fail (still prints errors)

Usage:
  python3 scripts/eigen-public-sitemap-ingest.py https://example.com/sitemap.xml
  EIGEN_PUBLIC_SITEMAP_URLS=https://a.com/sitemap.xml,https://b.com/page python3 scripts/eigen-public-sitemap-ingest.py

For sitemap + RSS + a public file folder in one run, see scripts/eigen-public-corpus-ingest.sh
and docs/eigen-public-corpus.md.

Oracle outbox: when the server has EIGEN_ORACLE_OUTBOX_ENABLED=true, bulk ingests enqueue
signal_candidate rows — drain with eigen-oracle-outbox-drain (service_role JWT), e.g. via
EIGEN_OUTBOX_DRAIN_BEARER in eigen-public-corpus-ingest.sh. Older documents may need
scripts/backfill-eigen-document-assets.sql so document-anchored signals can resolve.
"""

from __future__ import annotations

import json
import os
import sys
import xml.etree.ElementTree as ET
from collections.abc import Iterable
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


def _parse_sitemap_xml(data: bytes) -> tuple[list[str], list[str]]:
    """Returns (page_locs, nested_sitemap_locs)."""
    try:
        root = ET.fromstring(data)
    except ET.ParseError as e:
        raise ValueError(f"invalid XML: {e}") from e
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
    max_response_bytes: int | None,
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
            raw = fetch_bytes(
                seed,
                user_agent="EigenPublicSitemapIngest/1.1",
                timeout=90.0,
                max_response_bytes=max_response_bytes,
            )
        except (OSError, ValueError) as e:
            print(f"[warn] sitemap fetch failed {seed!r}: {e}", file=sys.stderr)
            continue
        try:
            pages, nested = _parse_sitemap_xml(raw)
        except ValueError as e:
            print(f"[warn] sitemap parse failed {seed!r}: {e}", file=sys.stderr)
            continue
        out.extend(pages)
        if depth < max_depth and nested:
            out.extend(
                collect_page_urls(
                    nested,
                    max_depth=max_depth,
                    max_response_bytes=max_response_bytes,
                    seen_sitemaps=seen_sitemaps,
                    depth=depth + 1,
                )
            )
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
    max_urls = read_int_env("EIGEN_PUBLIC_SITEMAP_MAX_URLS", 500, min_v=1, max_v=500_000)
    max_depth = read_int_env("EIGEN_PUBLIC_SITEMAP_MAX_DEPTH", 4, min_v=0, max_v=32)
    concurrency = read_int_env("EIGEN_PUBLIC_FETCH_CONCURRENCY", 1, min_v=1, max_v=16)
    max_fetch = read_optional_max_fetch_bytes()

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
    pages = collect_page_urls(seeds, max_depth=max_depth, max_response_bytes=max_fetch)
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
                },
            ),
        )
        return 0

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
        idem_fragment="sitemap",
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
