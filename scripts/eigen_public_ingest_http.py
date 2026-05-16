"""
Shared helpers for eigen-public-sitemap-ingest.py and eigen-public-rss-ingest.py.

Rate limiting: minimum interval between *starting* fetch-ingest requests (global),
with optional parallel in-flight requests so slow responses do not block the pipeline.
"""

from __future__ import annotations

import hashlib
import json
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import Future, ThreadPoolExecutor, as_completed
from datetime import UTC, datetime
from typing import Any, Callable

# Sitemaps/feeds larger than this are rejected before XML parse (DoS / accidental huge HTML).
DEFAULT_MAX_FETCH_BYTES = 25 * 1024 * 1024


def fetch_bytes(
    url: str,
    *,
    user_agent: str,
    timeout: float = 60.0,
    max_response_bytes: int | None = DEFAULT_MAX_FETCH_BYTES,
) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": user_agent,
            "Accept": "application/xml,text/xml,application/rss+xml,application/atom+xml,*/*;q=0.8",
            "Accept-Encoding": "gzip, deflate",
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        if max_response_bytes is not None:
            # Read one byte beyond the cap so we can detect oversized responses without
            # pulling the full payload into memory first.
            data = resp.read(max_response_bytes + 1)
            if len(data) > max_response_bytes:
                raise ValueError(
                    f"response too large (exceeds {max_response_bytes} byte limit)",
                )
        else:
            data = resp.read()
    return data


def normalize_supabase_base_url(base_url: str) -> str:
    b = base_url.strip().rstrip("/")
    low = b.lower()
    if not low.startswith("https://") and not low.startswith("http://"):
        raise ValueError("SUPABASE_URL must start with https:// or http://")
    return b


def post_fetch_ingest(
    base_url: str,
    bearer: str,
    page_url: str,
    *,
    idem_fragment: str,
    timeout: float = 120.0,
) -> tuple[bool, str]:
    """POST one URL to eigen-fetch-ingest. Caller handles rate limiting."""
    try:
        base = normalize_supabase_base_url(base_url)
    except ValueError as e:
        return False, str(e)

    try:
        payload = json.dumps({"url": page_url}, ensure_ascii=False).encode("utf-8")
    except (TypeError, ValueError) as e:
        return False, f"invalid url for JSON payload: {e}"

    idem = hashlib.sha256(f"{idem_fragment}|{page_url}".encode("utf-8")).hexdigest()[:48]
    prefix = idem_fragment.split("|", 1)[0]
    req = urllib.request.Request(
        f"{base}/functions/v1/eigen-fetch-ingest",
        data=payload,
        headers={
            "Authorization": f"Bearer {bearer}",
            "Content-Type": "application/json",
            "x-idempotency-key": f"{prefix}:{idem}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            if 200 <= resp.status < 300:
                return True, body
            return False, f"HTTP {resp.status} {body}"
    except urllib.error.HTTPError as e:
        try:
            err = e.read().decode("utf-8", errors="replace")
        except OSError:
            err = "(could not read error body)"
        return False, f"HTTP {e.code} {err}"
    except (urllib.error.URLError, OSError) as e:
        return False, str(e)


class IntervalRateLimiter:
    """Enforce a minimum wall-clock gap between acquire() calls (thread-safe)."""

    def __init__(self, min_interval_sec: float) -> None:
        self._min = max(0.0, float(min_interval_sec))
        self._lock = threading.Lock()
        self._next_eligible = 0.0

    def acquire(self) -> None:
        if self._min <= 0:
            return
        with self._lock:
            now = time.monotonic()
            if now < self._next_eligible:
                time.sleep(self._next_eligible - now)
            self._next_eligible = time.monotonic() + self._min


def read_non_negative_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or not str(raw).strip():
        return default
    try:
        return max(0.0, float(str(raw).strip()))
    except ValueError:
        return default


def read_optional_max_fetch_bytes() -> int | None:
    """0 or negative env means unlimited; unset uses DEFAULT_MAX_FETCH_BYTES."""
    raw = os.environ.get("EIGEN_PUBLIC_FETCH_MAX_BYTES")
    if raw is None or not str(raw).strip():
        return DEFAULT_MAX_FETCH_BYTES
    try:
        v = int(str(raw).strip(), 10)
        if v <= 0:
            return None
        return min(v, 100 * 1024 * 1024)
    except ValueError:
        return DEFAULT_MAX_FETCH_BYTES


def read_int_env(name: str, default: int, *, min_v: int = 1, max_v: int = 10_000) -> int:
    raw = os.environ.get(name)
    if raw is None or not str(raw).strip():
        return default
    try:
        v = int(str(raw).strip(), 10)
        return max(min_v, min(v, max_v))
    except ValueError:
        return default


def strict_exit_enabled() -> bool:
    v = (os.environ.get("EIGEN_PUBLIC_INGEST_STRICT_EXIT") or "1").strip().lower()
    return v not in ("0", "false", "no", "off")


def run_fetch_ingest_batch(
    urls: list[str],
    *,
    base_url: str,
    bearer: str,
    idem_fragment: str,
    delay_sec: float,
    concurrency: int,
    on_progress: Callable[[int, int, str], None],
    on_result: Callable[[str, bool, str], None],
) -> tuple[int, int]:
    """
    Ingest URLs with global rate limiting between request starts and up to `concurrency`
    simultaneous HTTP calls. Returns (ok_count, fail_count).
    """
    limiter = IntervalRateLimiter(delay_sec)
    ok_n = 0
    fail_n = 0
    lock = threading.Lock()

    def one(url: str) -> tuple[str, bool, str]:
        try:
            limiter.acquire()
            success, msg = post_fetch_ingest(
                base_url,
                bearer,
                url,
                idem_fragment=idem_fragment,
            )
            return url, success, msg
        except Exception as e:
            return url, False, f"ingest worker error: {e}"

    if concurrency <= 1:
        for i, url in enumerate(urls, 1):
            on_progress(i, len(urls), url)
            _, success, msg = one(url)
            on_result(url, success, msg)
            if success:
                ok_n += 1
            else:
                fail_n += 1
        return ok_n, fail_n

    futures: dict[Future, str] = {}
    with ThreadPoolExecutor(max_workers=concurrency) as ex:
        for i, url in enumerate(urls, 1):
            on_progress(i, len(urls), url)
            futures[ex.submit(one, url)] = url
        for fut in as_completed(futures):
            url = futures[fut]
            try:
                u2, success, msg = fut.result()
                if u2 != url:
                    success, msg = False, "internal error: url mismatch"
            except Exception as e:
                success, msg = False, f"future error: {e}"
            on_result(url, success, msg)
            with lock:
                if success:
                    ok_n += 1
                else:
                    fail_n += 1
    return ok_n, fail_n


def _service_rest_request(
    base_url: str,
    service_key: str,
    method: str,
    path_query: str,
    *,
    body: bytes | None = None,
    prefer: str | None = None,
    timeout: float = 120.0,
) -> tuple[int, str]:
    """Low-level PostgREST call with service_role JWT."""
    base = normalize_supabase_base_url(base_url)
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Accept": "application/json",
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
    if prefer:
        headers["Prefer"] = prefer
    req = urllib.request.Request(
        f"{base}{path_query}",
        data=body,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return resp.status, raw
    except urllib.error.HTTPError as e:
        try:
            err = e.read().decode("utf-8", errors="replace")
        except OSError:
            err = "(could not read error body)"
        return e.code, err
    except (urllib.error.URLError, OSError) as e:
        return 0, str(e)


def atlas_create_crawl(
    base_url: str,
    service_key: str,
    brand_key: str,
    *,
    source: str = "sitemap",
    timeout: float = 60.0,
) -> tuple[bool, str, str | None]:
    """
    Insert atlas_crawls row (status running). Returns (ok, message_or_body, crawl_id).
    """
    payload = json.dumps(
        {"brand_key": brand_key, "source": source, "status": "running"},
        ensure_ascii=False,
    ).encode("utf-8")
    status, body = _service_rest_request(
        base_url,
        service_key,
        "POST",
        "/rest/v1/atlas_crawls",
        body=payload,
        prefer="return=representation",
        timeout=timeout,
    )
    if not (200 <= status < 300):
        return False, body, None
    try:
        rows = json.loads(body)
    except json.JSONDecodeError:
        return False, f"invalid JSON from atlas_crawls insert: {body[:500]}", None
    if not isinstance(rows, list) or not rows:
        return False, f"unexpected atlas_crawls response: {body[:500]}", None
    cid = rows[0].get("id") if isinstance(rows[0], dict) else None
    if not cid:
        return False, f"missing id in atlas_crawls response: {body[:500]}", None
    return True, body, str(cid)


def atlas_finish_crawl(
    base_url: str,
    service_key: str,
    crawl_id: str,
    *,
    status: str,
    timeout: float = 60.0,
) -> tuple[bool, str]:
    """Patch atlas_crawls status to completed or failed."""
    completed_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    payload = json.dumps(
        {"status": status, "completed_at": completed_at},
        ensure_ascii=False,
    ).encode("utf-8")
    q = urllib.parse.quote(crawl_id, safe="")
    st, body = _service_rest_request(
        base_url,
        service_key,
        "PATCH",
        f"/rest/v1/atlas_crawls?id=eq.{q}",
        body=payload,
        prefer="return=minimal",
        timeout=timeout,
    )
    if 200 <= st < 300:
        return True, body
    return False, body


def atlas_bulk_insert_urls(
    base_url: str,
    service_key: str,
    rows: list[dict[str, Any]],
    *,
    timeout: float = 120.0,
) -> tuple[bool, str]:
    if not rows:
        return True, ""
    payload = json.dumps(rows, ensure_ascii=False).encode("utf-8")
    st, body = _service_rest_request(
        base_url,
        service_key,
        "POST",
        "/rest/v1/atlas_urls",
        body=payload,
        prefer="return=minimal",
        timeout=timeout,
    )
    if 200 <= st < 300:
        return True, body
    return False, body


def atlas_bulk_insert_links(
    base_url: str,
    service_key: str,
    rows: list[dict[str, Any]],
    *,
    timeout: float = 120.0,
) -> tuple[bool, str]:
    if not rows:
        return True, ""
    payload = json.dumps(rows, ensure_ascii=False).encode("utf-8")
    st, body = _service_rest_request(
        base_url,
        service_key,
        "POST",
        "/rest/v1/atlas_links",
        body=payload,
        prefer="return=minimal",
        timeout=timeout,
    )
    if 200 <= st < 300:
        return True, body
    return False, body


def atlas_patch_url_ingest_result(
    base_url: str,
    service_key: str,
    crawl_id: str,
    page_url: str,
    *,
    ingest_ok: bool,
    last_error: str | None,
    timeout: float = 60.0,
) -> tuple[bool, str]:
    """PATCH single atlas_urls row by crawl_id + url."""
    err = (last_error or "")[:2000] if not ingest_ok else None
    body_obj: dict[str, Any] = {"ingest_ok": ingest_ok, "last_error": err}
    payload = json.dumps(body_obj, ensure_ascii=False).encode("utf-8")
    cq = urllib.parse.quote(crawl_id, safe="")
    uq = urllib.parse.quote(page_url, safe="")
    st, body = _service_rest_request(
        base_url,
        service_key,
        "PATCH",
        f"/rest/v1/atlas_urls?crawl_id=eq.{cq}&url=eq.{uq}",
        body=payload,
        prefer="return=minimal",
        timeout=timeout,
    )
    if 200 <= st < 300:
        return True, body
    return False, body
