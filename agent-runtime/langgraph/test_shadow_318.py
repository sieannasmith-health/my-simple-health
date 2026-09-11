from shadow import run_shadow


def test_issue_318_blocked_snapshot_recovers_without_false_siea_gate():
    snapshot = {
        "version": 1,
        "sequence_version": 21,
        "current_stage": "PRODUCT_COORDINATION",
        "assigned_agent": "nomy",
        "status": "ORCHESTRATION_BLOCKED",
        "retry_count": 3,
        "max_retries": 3,
        "history": [
            {
                "event": "LIVELOCK_CIRCUIT_BREAKER",
                "agent": "nomy",
                "stage": "PRODUCT_COORDINATION",
                "result_status": "blocked",
                "reason_code": "MISSING_EVIDENCE",
            }
        ],
    }
    result = run_shadow(
        318,
        snapshot,
        execution_results={
            "nomy": [{"status": "completed", "next_agents": ["selah"]}],
            "selah": [{"status": "completed"}],
        },
        qa_results=[{"qa_status": "pass", "qa_feedback": "Tessa shadow conformance passed"}],
    )
    state = result["state"]
    assert state["objective_id"] == "github-issue-318"
    assert state["status"] == "completed"
    assert state["qa_status"] == "pass"
    assert state["human_gate"] == {}
    assert state["redrive_count"] == 1
    assert state["completed_branches"] == ["nomy", "selah"]
    event_types = [event["event_type"] for event in result["events"]]
    assert "fanout.dispatched" in event_types
    assert "fanout.branch_started" in event_types
    assert "fanout.branch_finished" in event_types
    assert "fanout.join_complete" in event_types
    assert "fanout.branch_joined" not in event_types
    assert event_types.count("qa.finished") == 1
