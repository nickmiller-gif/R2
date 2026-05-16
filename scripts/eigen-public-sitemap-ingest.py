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

Atlas (--write-atlas-links):
  - SUPABASE_SERVICE_ROLE_KEY: PostgREST writes to atlas_* (service_role only).
  - Inserts atlas_crawls, atlas_urls, atlas_links (link_kind=sitemap_parent: parent sitemap XML URL -> page loc).
  - After each eigen-fetch-ingest, PATCH atlas_urls.ingest_ok / last_error for that crawl.

Usage:
  python3 scripts/eigen-public-sitemap-ingest.py https://example.com/sitemap.xml
  python3 scripts/eigen-public-sitemap-ingest.py --write-atlas-links --atlas-brand-key centralr2-core https://example.com/sitemap.xml
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
    atlas_bulk_insert_links,
    atlas_bulk_insert_urls,
    atlas_create_crawl,
    atlas_finish_crawl,
    atlas_patch_url_ingest_result,
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


def collect_page_urls_with_provenance(
    seeds: Iterable[str],
    *,
    max_depth: int,
    max_response_bytes: int | None,
    seen_sitemaps: set[str] | None = None,
    depth: int = 0,
) -> list[tuple[str, str]]:
    """
    Returns (page_url, parent_sitemap_xml_url) for each loc in a urlset;
    parent_sitemap_xml_url is the sitemap document URL that contained the loc.
    """
    seen_sitemaps = seen_sitemaps if seen_sitemaps is not None else set()
    out: list[tuple[str, str]] = []
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
        out.extend((p, seed) for p in pages)
        if depth < max_depth and nested:
            out.extend(
                collect_page_urls_with_provenance(
                    nested,
                    max_depth=max_depth,
                    max_response_bytes=max_response_bytes,
                    seen_sitemaps=seen_sitemaps,
                    depth=depth + 1,
                ),
            )
    return out


def collect_page_urls(
    seeds: Iterable[str],
    *,
    max_depth: int,
    max_response_bytes: int | None,
    seen_sitemaps: set[str] | None = None,
    depth: int = 0,
) -> list[str]:
    pairs = collect_page_urls_with_provenance(
        seeds,
        max_depth=max_depth,
        max_response_bytes=max_response_bytes,
        seen_sitemaps=seen_sitemaps,
        depth=depth,
    )
    uniq: list[str] = []
    seen: set[str] = set()
    for page, _parent in pairs:
        if page not in seen:
            seen.add(page)
            uniq.append(page)
    return uniq


def _parse_cli(argv: list[str]) -> tuple[list[str], bool, str]:
    write_atlas = False
    brand = "centralr2-core"
    rest: list[str] = []
    i = 0
    while i < len(argv):
        a = argv[i].strip()
        if not a:
            i += 1
            continue
        if a == "--write-atlas-links":
            write_atlas = True
        elif a == "--atlas-brand-key" and i + 1 < len(argv):
            brand = argv[i + 1].strip() or brand
            i += 1
        elif a.startswith("--atlas-brand-key="):
            brand = a.split("=", 1)[1].strip() or brand
        else:
            rest.append(a)
        i += 1
    return rest, write_atlas, brand


def _dedupe_pairs(pairs: list[tuple[str, str]]) -> list[tuple[str, str]]:
    seen: set[str] = set()
    out: list[tuple[str, str]] = []
    for page, parent in pairs:
        if page in seen:
            continue
        seen.add(page)
        out.append((page, parent))
    return out


def _chunked(items: list[dict], size: int) -> list[list[dict]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def main() -> int:
    raw_cli = [a for a in sys.argv[1:] if a.strip()]
    cli, write_atlas, atlas_brand_key = _parse_cli(raw_cli)

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
    page_pairs = collect_page_urls_with_provenance(seeds, max_depth=max_depth, max_response_bytes=max_fetch)
    if not page_pairs and len(seeds) == 1:
        u = urlparse(seeds[0])
        if u.scheme in ("http", "https") and u.path and not u.path.lower().endswith(".xml"):
            page_pairs = [(seeds[0], seeds[0])]
            print("Interpreting single non-XML URL as one page to ingest.", file=sys.stderr)

    page_pairs = _dedupe_pairs(page_pairs)
    if len(page_pairs) > max_urls:
        print(f"[warn] truncating from {len(page_pairs)} to {max_urls} URLs", file=sys.stderr)
        page_pairs = page_pairs[:max_urls]

    page_to_parent = {p: par for p, par in page_pairs}

    to_ingest: list[str] = []
    for url, _parent in page_pairs:
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
                    "skipped_scheme": len(page_pairs),
                    "total": 0,
                },
            ),
        )
        return 0

    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    crawl_id: str | None = None
    if write_atlas:
        if not service_key:
            print(
                "Set SUPABASE_SERVICE_ROLE_KEY when using --write-atlas-links.",
                file=sys.stderr,
            )
            return 1
        ok, msg, cid = atlas_create_crawl(supabase, service_key, atlas_brand_key)
        if not ok or not cid:
            print(f"[atlas] failed to create crawl: {msg[:1200]}", file=sys.stderr)
            return 1
        crawl_id = cid
        url_rows = [{"crawl_id": crawl_id, "url": u} for u in to_ingest]
        for chunk in _chunked(url_rows, 400):
            uok, ubody = atlas_bulk_insert_urls(supabase, service_key, chunk)
            if not uok:
                print(f"[atlas] atlas_urls insert failed: {ubody[:1200]}", file=sys.stderr)
                atlas_finish_crawl(supabase, service_key, crawl_id, status="failed")
                return 1
        link_rows = [
            {
                "crawl_id": crawl_id,
                "from_url": page_to_parent[u],
                "to_url": u,
                "link_kind": "sitemap_parent",
            }
            for u in to_ingest
        ]
        for chunk in _chunked(link_rows, 400):
            lok, lbody = atlas_bulk_insert_links(supabase, service_key, chunk)
            if not lok:
                print(f"[atlas] atlas_links insert failed: {lbody[:1200]}", file=sys.stderr)
                atlas_finish_crawl(supabase, service_key, crawl_id, status="failed")
                return 1
        print(f"[atlas] crawl {crawl_id} created for brand_key={atlas_brand_key!r}", file=sys.stderr)

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
        if write_atlas and crawl_id and service_key:
            pok, pmsg = atlas_patch_url_ingest_result(
                supabase,
                service_key,
                crawl_id,
                url,
                ingest_ok=success,
                last_error=None if success else msg,
            )
            if not pok:
                print(f"[atlas] patch atlas_urls failed for {url!r}: {pmsg[:400]}", file=sys.stderr)

    ok_n, fail_n = 0, 0
    crawl_exception = False
    try:
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
    except Exception:
        crawl_exception = True
        raise
    finally:
        if write_atlas and crawl_id and service_key:
            fin_status = "failed" if crawl_exception else "completed"
            fin_ok, fin_body = atlas_finish_crawl(
                supabase,
                service_key,
                crawl_id,
                status=fin_status,
            )
            if not fin_ok:
                print(f"[atlas] finish crawl failed: {fin_body[:800]}", file=sys.stderr)

    skipped = len(page_pairs) - len(to_ingest)
    summary = {
        "ok": ok_n,
        "failed": fail_n,
        "skipped_scheme": skipped,
        "total": len(to_ingest),
        "concurrency": concurrency,
        "atlas_crawl_id": crawl_id,
        "atlas_brand_key": atlas_brand_key if write_atlas else None,
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
