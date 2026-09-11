from __future__ import annotations

import json
import os
import re
import urllib.request

from adapters import legacy_state_to_agent_os

STATE_START = "<!-- MSH_STATE_LOCK -->"
STATE_END = "<!-- MSH_STATE_LOCK_END -->"


def _load_issue(issue_number: int) -> dict:
    repository = os.environ["GITHUB_REPOSITORY"]
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    request = urllib.request.Request(
        f"https://api.github.com/repos/{repository}/issues/{issue_number}",
        headers={
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def _extract_state(body: str) -> dict:
    pattern = re.compile(
        re.escape(STATE_START) + r"\s*```json\s*([\s\S]*?)\s*```\s*" + re.escape(STATE_END)
    )
    match = pattern.search(body or "")
    if not match:
        raise RuntimeError("Durable MSH state block not found")
    return json.loads(match.group(1))


def main() -> int:
    issue_number = int(os.getenv("SHADOW_ISSUE_NUMBER", "318"))
    issue = _load_issue(issue_number)
    legacy = _extract_state(str(issue.get("body") or ""))
    translated = legacy_state_to_agent_os(issue_number, legacy)

    if translated["objective_id"] != f"github-issue-{issue_number}":
        raise AssertionError("objective identity did not survive translation")
    if translated["correlation_id"] != translated["objective_id"]:
        raise AssertionError("correlation identity diverged from objective identity")
    if translated["evidence_version"] != int(legacy.get("sequence_version") or 0):
        raise AssertionError("evidence version did not preserve durable sequence version")
    if str(legacy.get("status") or "").upper() == "ORCHESTRATION_BLOCKED":
        if translated["status"] != "recovery_required":
            raise AssertionError("legacy blocked state was parked instead of routed to recovery")
        if translated.get("human_gate"):
            raise AssertionError("legacy blocked state manufactured a false human gate")

    report = {
        "issue": issue_number,
        "legacy_status": legacy.get("status"),
        "legacy_stage": legacy.get("current_stage"),
        "legacy_owner": legacy.get("assigned_agent"),
        "sequence_version": legacy.get("sequence_version"),
        "translated_status": translated.get("status"),
        "failure_class": translated.get("failure_class"),
        "recovery_owner": translated.get("recovery_owner"),
        "human_gate": translated.get("human_gate") or {},
        "conformance": "pass",
    }
    print(json.dumps(report, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
