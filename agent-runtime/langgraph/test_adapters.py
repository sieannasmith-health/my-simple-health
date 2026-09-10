from .adapters import classify_reason, legacy_state_to_agent_os, worker_result_to_updates


def test_orchestration_blocked_becomes_recovery_required():
    legacy = {
        "status": "ORCHESTRATION_BLOCKED",
        "current_stage": "PRODUCT_COORDINATION",
        "assigned_agent": "nomy",
        "retry_count": 3,
        "sequence_version": 12,
        "history": [{"event": "LIVELOCK_CIRCUIT_BREAKER", "reason_code": "MISSING_EVIDENCE"}],
    }
    state = legacy_state_to_agent_os(318, legacy)
    assert state["status"] == "recovery_required"
    assert state["failure_class"] == "dependency"
    assert state["resume_from"] == "PRODUCT_COORDINATION"
    assert state["evidence_version"] == 12


def test_worker_result_preserves_fanout_evidence():
    updates = worker_result_to_updates({
        "status": "completed",
        "next_agents": ["iris", "atlas", "iris"],
        "completed_branches": ["vera"],
    })
    assert updates["pending_branches"] == ["iris", "atlas"]
    assert updates["completed_branches"] == ["vera"]


def test_reason_classification():
    assert classify_reason("TIMEOUT") == "transient"
    assert classify_reason("QA_FAILED") == "quality"
    assert classify_reason("CREDENTIAL_REQUIRED") == "human_input"
