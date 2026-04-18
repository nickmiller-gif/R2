#!/usr/bin/env python3
"""
Usage:
  SUPABASE_URL=... python3 scripts/eigen-eval.py

Streaming mode:
  EIGEN_EVAL_STREAM=1 PUBLIC_BEARER=... AUTH_BEARER=... python3 scripts/eigen-eval.py

Notes:
  - PUBLIC_BEARER is required when public endpoint enforces bearer auth.
  - AUTH_BEARER is required for eigenx-tier tests.
"""
import json
import os
import subprocess
import sys


def read_json(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def post_json(url: str, payload: dict, token: str | None = None) -> dict:
    cmd = [
        "curl",
        "-sS",
        "-X",
        "POST",
        url,
        "-H",
        "Content-Type: application/json",
        "--data",
        json.dumps(payload),
    ]
    if token:
        cmd.extend(["-H", f"Authorization: Bearer {token}"])

    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60, check=False)
    if proc.returncode != 0:
        raise RuntimeError(f"curl failed ({proc.returncode}): {proc.stderr.strip()}")
    raw = proc.stdout.strip()
    try:
        return json.loads(raw)
    except Exception as exc:
        raise RuntimeError(f"Invalid JSON response: {raw}") from exc


def post_sse(url: str, payload: dict, token: str | None = None) -> dict:
    cmd = [
        "curl",
        "-sS",
        "-N",
        "-X",
        "POST",
        url,
        "-H",
        "Content-Type: application/json",
        "-H",
        "Accept: text/event-stream",
        "--data",
        json.dumps(payload),
    ]
    if token:
        cmd.extend(["-H", f"Authorization: Bearer {token}"])

    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=90, check=False)
    if proc.returncode != 0:
        raise RuntimeError(f"curl failed ({proc.returncode}): {proc.stderr.strip()}")

    raw_stdout = proc.stdout.strip()
    if raw_stdout.startswith("{"):
        maybe_json = json.loads(raw_stdout)
        if isinstance(maybe_json, dict) and maybe_json.get("error"):
            raise RuntimeError(str(maybe_json.get("error")))
        if isinstance(maybe_json, dict) and maybe_json.get("message"):
            raise RuntimeError(str(maybe_json.get("message")))
        return maybe_json

    event_name = None
    data_lines: list[str] = []
    final_payload = None
    for line in proc.stdout.splitlines():
        if line.startswith("event:"):
            event_name = line.split(":", 1)[1].strip()
            continue
        if line.startswith("data:"):
            data_lines.append(line.split(":", 1)[1].strip())
            continue
        if line.strip() == "":
            if event_name == "final":
                raw = "\n".join(data_lines).strip()
                if not raw:
                    raise RuntimeError("SSE final event had empty payload")
                final_payload = json.loads(raw)
                break
            event_name = None
            data_lines = []

    if final_payload is None:
        raise RuntimeError("SSE response did not include a final event payload")
    return final_payload


def ensure_contains(text: str, values: list[str]) -> list[str]:
    lower = text.lower()
    return [v for v in values if v.lower() not in lower]


def ensure_contains_any(text: str, values: list[str]) -> bool:
    lower = text.lower()
    return any(v.lower() in lower for v in values)


def run():
    supabase_url = os.environ.get("SUPABASE_URL", "").strip()
    if not supabase_url:
        print("Missing SUPABASE_URL", file=sys.stderr)
        return 2

    prompts_file = os.environ.get(
        "EIGEN_EVAL_PROMPTS_FILE",
        os.path.join(os.path.dirname(__file__), "eigen-eval-prompts.json"),
    )
    data = read_json(prompts_file)
    tests = data.get("tests", [])
    if not isinstance(tests, list) or not tests:
        print("No tests found in prompts file", file=sys.stderr)
        return 2

    auth_bearer = os.environ.get("AUTH_BEARER", "").strip()
    public_bearer = os.environ.get("PUBLIC_BEARER", "").strip()
    eval_group = os.environ.get("EIGEN_EVAL_GROUP", "").strip()
    public_url = os.environ.get(
        "PUBLIC_URL",
        f"{supabase_url.rstrip('/')}/functions/v1/eigen-chat-public",
    )
    eigenx_url = os.environ.get(
        "EIGENX_URL",
        f"{supabase_url.rstrip('/')}/functions/v1/eigen-chat",
    )
    stream_mode = os.environ.get("EIGEN_EVAL_STREAM", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }

    passed = 0
    failed = 0
    skipped = 0

    for test in tests:
        if eval_group and str(test.get("group", "")).strip() != eval_group:
            continue
        name = str(test.get("name", "unnamed"))
        tier = str(test.get("tier", "public")).lower()
        question = str(test.get("question", "")).strip()
        if not question:
            print(f"[SKIP] {name}: empty question")
            skipped += 1
            continue

        url = public_url if tier == "public" else eigenx_url
        token = None
        payload: dict = {
            "message": question,
            "response_format": "structured",
        }
        if stream_mode:
            payload["stream"] = True
        if isinstance(test.get("site_id"), str) and test.get("site_id"):
            payload["site_id"] = str(test.get("site_id"))
        if isinstance(test.get("site_source_systems"), list):
            payload["site_source_systems"] = [str(x) for x in test["site_source_systems"]]
        if tier == "public" and public_bearer:
            token = public_bearer
        if tier == "eigenx":
            if not auth_bearer:
                print(f"[SKIP] {name}: AUTH_BEARER not set")
                skipped += 1
                continue
            token = auth_bearer
            payload["policy_scope"] = ["eigenx"]

        try:
            response = post_sse(url, payload, token) if stream_mode else post_json(url, payload, token)
        except Exception as exc:
            print(f"[FAIL] {name}: request error: {exc}")
            failed += 1
            continue

        text = str(response.get("response", "")).strip()
        citations = response.get("citations", [])
        if not text:
            print(f"[FAIL] {name}: missing response text")
            failed += 1
            continue
        if not isinstance(citations, list):
            print(f"[FAIL] {name}: citations is not a list")
            failed += 1
            continue
        if not isinstance(response.get("retrieval_plan"), dict):
            print(f"[FAIL] {name}: retrieval_plan missing or invalid")
            failed += 1
            continue
        bad_tiers = [
            c.get("evidence_tier") if isinstance(c, dict) else "__non_object_citation__"
            for c in citations
            if not isinstance(c, dict) or c.get("evidence_tier") not in {"A", "B", "C", "D"}
        ]
        if bad_tiers:
            print(f"[FAIL] {name}: invalid evidence_tier values: {bad_tiers}")
            failed += 1
            continue

        min_citations = int(test.get("min_citations", 0))
        if len(citations) < min_citations:
            print(
                f"[FAIL] {name}: expected >= {min_citations} citations, got {len(citations)}"
            )
            failed += 1
            continue

        must_include = test.get("must_include", [])
        if isinstance(must_include, list):
            missing = ensure_contains(text, [str(v) for v in must_include])
            if missing:
                print(f"[FAIL] {name}: missing expected text: {missing}")
                failed += 1
                continue

        must_include_any = test.get("must_include_any", [])
        if isinstance(must_include_any, list) and must_include_any:
            if not ensure_contains_any(text, [str(v) for v in must_include_any]):
                print(
                    f"[FAIL] {name}: expected at least one of {must_include_any}, got: {text}"
                )
                failed += 1
                continue

        must_not_include = test.get("must_not_include", [])
        if isinstance(must_not_include, list):
            bad = [v for v in must_not_include if str(v).lower() in text.lower()]
            if bad:
                print(f"[FAIL] {name}: contained forbidden text: {bad}")
                failed += 1
                continue

        print(
            f"[PASS] {name}: tier={tier}, citations={len(citations)}, retrieval_run_id={response.get('retrieval_run_id')}"
        )
        passed += 1

    selected_total = passed + failed + skipped
    print(
        f"\nResult: passed={passed}, failed={failed}, skipped={skipped}, total={selected_total}"
    )
    return 1 if failed > 0 else 0


if __name__ == "__main__":
    sys.exit(run())
