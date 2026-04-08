#!/usr/bin/env python3
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
    public_url = os.environ.get(
        "PUBLIC_URL",
        f"{supabase_url.rstrip('/')}/functions/v1/eigen-chat-public",
    )
    eigenx_url = os.environ.get(
        "EIGENX_URL",
        f"{supabase_url.rstrip('/')}/functions/v1/eigen-chat",
    )

    passed = 0
    failed = 0
    skipped = 0

    for test in tests:
        name = str(test.get("name", "unnamed"))
        tier = str(test.get("tier", "public")).lower()
        question = str(test.get("question", "")).strip()
        if not question:
            print(f"[SKIP] {name}: empty question")
            skipped += 1
            continue

        url = public_url if tier == "public" else eigenx_url
        token = None
        payload: dict = {"message": question, "response_format": "structured"}
        if tier == "eigenx":
            if not auth_bearer:
                print(f"[SKIP] {name}: AUTH_BEARER not set")
                skipped += 1
                continue
            token = auth_bearer
            payload["policy_scope"] = ["eigenx"]

        try:
            response = post_json(url, payload, token)
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

    print(
        f"\nResult: passed={passed}, failed={failed}, skipped={skipped}, total={len(tests)}"
    )
    return 1 if failed > 0 else 0


if __name__ == "__main__":
    sys.exit(run())
