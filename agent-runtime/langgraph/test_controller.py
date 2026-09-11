from langgraph.checkpoint.memory import InMemorySaver

from adapters import legacy_state_to_agent_os
from controller import build_graph
from ports import ScriptedPorts, fail_closed_ports


def base_state():
    return legacy_state_to_agent_os(
        318,
        {
            "status": "PENDING",
            "current_stage": "IMPLEMENTATION",
            "assigned_agent": "selah",
            "retry_count": 0,
            "sequence_version": 21,
        },
    )


def invoke(graph, state):
    return graph.invoke(state, config={"configurable": {"thread_id": state["correlation_id"]}})


def test_missing_adapter_fails_closed():
    state = base_state()
    graph = build_graph(checkpointer=InMemorySaver(), ports=fail_closed_ports())
    result = invoke(graph, state)
    assert result["status"] == "recovery_required"
    assert result["reason_code"] == "EXECUTION_ADAPTER_NOT_CONFIGURED"
    assert result["failure_class"] == "terminal"


def test_fanout_uses_send_and_joins_all_branches_before_tessa():
    state = base_state()
    scripted = ScriptedPorts(
        execution_results={
            "selah": [{"status": "completed", "next_agents": ["vera", "aiden"]}],
            "vera": [{"status": "completed"}],
            "aiden": [{"status": "completed"}],
        },
        qa_results=[{"qa_status": "pass", "qa_feedback": "Conformant"}],
    )
    graph = build_graph(checkpointer=InMemorySaver(), ports=scripted.as_ports())
    result = invoke(graph, state)

    assert result["status"] == "completed"
    assert result["qa_status"] == "pass"
    assert result["completed_branches"] == ["selah", "vera", "aiden"]
    assert result["pending_branches"] == []

    event_types = [event["event_type"] for event in scripted.events]
    assert "fanout.dispatched" in event_types
    assert event_types.count("fanout.branch_started") == 2
    assert event_types.count("fanout.branch_finished") == 2
    assert "fanout.join_complete" in event_types

    join_index = event_types.index("fanout.join_complete")
    qa_index = event_types.index("qa.started")
    branch_finish_indexes = [
        index for index, event_type in enumerate(event_types) if event_type == "fanout.branch_finished"
    ]
    assert branch_finish_indexes
    assert max(branch_finish_indexes) < join_index < qa_index


def test_fanout_branch_failure_blocks_join_and_skips_tessa():
    state = base_state()
    state["max_redrives"] = 0
    scripted = ScriptedPorts(
        execution_results={
            "selah": [{"status": "completed", "next_agents": ["vera", "aiden"]}],
            "vera": [{"status": "completed"}],
            "aiden": [{"status": "blocked", "reason_code": "DEPENDENCY_REQUIRED"}],
        },
        qa_results=[{"qa_status": "pass", "qa_feedback": "Must not run"}],
    )
    graph = build_graph(checkpointer=InMemorySaver(), ports=scripted.as_ports())
    result = invoke(graph, state)

    assert result["status"] == "recovery_required"
    assert result["reason_code"] == "DEPENDENCY_REQUIRED"
    assert result["failed_agent"] == "aiden"
    assert result["failed_stage"] == "IMPLEMENTATION"
    assert "vera" in result["completed_branches"]
    assert "aiden" not in result["completed_branches"]
    assert any(event["event_type"] == "fanout.join_failed" for event in scripted.events)
    assert not any(event["event_type"] == "qa.started" for event in scripted.events)


def test_tessa_failure_routes_back_to_selah_then_retests():
    state = base_state()
    scripted = ScriptedPorts(
        execution_results={"selah": [{"status": "completed"}, {"status": "completed"}]},
        qa_results=[
            {"qa_status": "fail", "qa_feedback": "Repair required"},
            {"qa_status": "pass", "qa_feedback": "Repair verified"},
        ],
    )
    graph = build_graph(checkpointer=InMemorySaver(), ports=scripted.as_ports())
    result = invoke(graph, state)
    assert result["status"] == "completed"
    assert result["qa_status"] == "pass"
    assert result["qa_feedback"] == "Repair verified"
    qa_finished = [event for event in scripted.events if event["event_type"] == "qa.finished"]
    assert [event["qa_status"] for event in qa_finished] == ["fail", "pass"]


def test_tessa_refinement_stops_at_redrive_budget():
    state = base_state()
    state["max_redrives"] = 1
    scripted = ScriptedPorts(
        execution_results={"selah": [{"status": "completed"}, {"status": "completed"}]},
        qa_results=[
            {"qa_status": "fail", "qa_feedback": "First failure", "reason_code": "QA_FAILED"},
            {"qa_status": "fail", "qa_feedback": "Still failing", "reason_code": "QA_FAILED"},
        ],
    )
    graph = build_graph(checkpointer=InMemorySaver(), ports=scripted.as_ports())
    result = invoke(graph, state)
    assert result["status"] == "blocked"
    assert result["reason_code"] == "MAX_REDRIVE_EXCEEDED"
    assert result["failure_class"] == "terminal"
    assert result["recovery_owner"] == "nomy"
    assert result["redrive_count"] == 1
