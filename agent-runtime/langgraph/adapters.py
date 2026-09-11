from __future__ import annotations

from typing import Any

from state import AgentOSState


LEGACY_TERMINAL_LIKE = {"ORCHESTRATION_BLOCKED"}


def legacy_state_to_agent_os(issue_number: int, legacy: dict[str, Any]) -> AgentOSState:
    objective_id = f"github-issue-{issue_number}"
    legacy_status = str(legacy.get("status") or "PENDING")
    reason_code = _latest_reason_code(legacy)
    failure_class = classify_reason(reason_code) if legacy_status in LEGACY_TERMINAL_LIKE else "none"
    return AgentOSState(
        objective_id=objective_id,
        correlation_id=objective_id,
        current_agent=str(legacy.get("assigned_agent") or "nomy"),
        current_stage=str(legacy.get("current_stage") or "PRODUCT_COORDINATION"),
        status="recovery_required" if legacy_status in LEGACY_TERMINAL_LIKE else legacy_status.lower(),
        attempt=int(legacy.get("retry_count") or 0),
        max_attempts=int(legacy.get("max_retries") or 3),
        redrive_count=int(legacy.get("redrive_count") or 0),
        max_redrives=int(legacy.get("max_redrives") or 3),
        failed_stage=str(legacy.get("current_stage") or "PRODUCT_COORDINATION") if legacy_status in LEGACY_TERMINAL_LIKE else "",
        failed_agent=str(legacy.get("assigned_agent") or "nomy") if legacy_status in LEGACY_TERMINAL_LIKE else "",
        failure_class=failure_class,
        reason_code=reason_code or "",
        recovery_owner=recovery_owner_for(failure_class, legacy),
        resume_from=str(legacy.get("current_stage") or "PRODUCT_COORDINATION"),
        completed_branches=_completed_branches(legacy),
        pending_branches=_pending_branches(legacy),
        qa_status="not_run",
        qa_feedback="",
        human_gate=legacy.get("human_gate") or {},
        evidence_version=int(legacy.get("sequence_version") or 0),
    )


def worker_result_to_updates(result: dict[str, Any]) -> dict[str, Any]:
    updates: dict[str, Any] = {}
    status = str(result.get("status") or "")
    reason = str(result.get("reason_code") or "")
    if status:
        updates["status"] = status
    if reason:
        updates["reason_code"] = reason
        updates["failure_class"] = classify_reason(reason)
    if result.get("qa_status") in {"pass", "fail", "not_run"}:
        updates["qa_status"] = result["qa_status"]
    if isinstance(result.get("qa_feedback"), str):
        updates["qa_feedback"] = result["qa_feedback"]
    if isinstance(result.get("next_agents"), list):
        updates["pending_branches"] = _uniq(result["next_agents"])
    if isinstance(result.get("completed_branches"), list):
        updates["completed_branches"] = _uniq(result["completed_branches"])
    return updates


def classify_reason(reason_code: str) -> str:
    reason = str(reason_code or "").upper()
    if reason in {"RATE_LIMIT", "TIMEOUT", "TOOL_UNAVAILABLE", "NETWORK_ERROR"}:
        return "transient"
    if reason in {"DEPENDENCY_REQUIRED", "MISSING_EVIDENCE", "BUILD_EVIDENCE_REQUIRED", "LEGACY_ORCHESTRATION_BLOCKED_WITHOUT_RECOVERY_CHECKPOINT"}:
        return "dependency"
    if reason in {"QA_FAILED", "IMPLEMENTATION_DEFECT", "TEST_FAILED"}:
        return "quality"
    if reason in {"AUTHORIZATION_REQUIRED", "PROTECTED_WRITE", "EXECUTION_APPROVAL_REQUIRED"}:
        return "authorization"
    if reason in {"FOUNDER_INPUT_REQUIRED", "CREDENTIAL_REQUIRED", "DEVICE_ACTION_REQUIRED"}:
        return "human_input"
    if not reason:
        return "dependency"
    return "terminal"


def recovery_owner_for(failure_class: str, legacy: dict[str, Any] | None = None) -> str:
    if failure_class == "quality": return "selah"
    if failure_class == "dependency": return "nomy"
    if failure_class == "authorization": return "nomy"
    if failure_class == "transient": return str((legacy or {}).get("assigned_agent") or "nomy")
    return "nomy"


def _latest_reason_code(legacy: dict[str, Any]) -> str:
    history = legacy.get("history") if isinstance(legacy.get("history"), list) else []
    for item in reversed(history):
        if isinstance(item, dict) and item.get("reason_code"):
            return str(item["reason_code"])
        if isinstance(item, dict) and item.get("event") == "LIVELOCK_CIRCUIT_BREAKER":
            return str(item.get("reason_code") or "REPEATED_BLOCKED_NO_NEW_EVIDENCE")
    recovery = legacy.get("recovery") if isinstance(legacy.get("recovery"), dict) else {}
    return str(recovery.get("reason_code") or "")


def _completed_branches(legacy: dict[str, Any]) -> list[str]:
    fanout = legacy.get("fanout") if isinstance(legacy.get("fanout"), dict) else {}
    return _uniq(fanout.get("completed") or [])


def _pending_branches(legacy: dict[str, Any]) -> list[str]:
    fanout = legacy.get("fanout") if isinstance(legacy.get("fanout"), dict) else {}
    values = []
    if fanout.get("active_agent"): values.append(fanout["active_agent"])
    values.extend(fanout.get("pending") or [])
    return _uniq(values)


def _uniq(values: list[Any]) -> list[str]:
    out: list[str] = []
    for value in values:
        item = str(value or "").strip().lower()
        if item and item not in out: out.append(item)
    return out
