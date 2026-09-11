from __future__ import annotations

from langgraph.graph import END, START, StateGraph
from langgraph.types import RetryPolicy, Send, interrupt

from adapters import classify_reason, recovery_owner_for, worker_result_to_updates
from checkpoint import build_checkpointer
from ports import AgentOSPorts, fail_closed_ports
from state import AgentOSState


def _event(state: AgentOSState, event_type: str, **payload):
    return {
        "event_type": event_type,
        "objective_id": state["objective_id"],
        "correlation_id": state["correlation_id"],
        "agent": state["current_agent"],
        "stage": state["current_stage"],
        "evidence_version": state["evidence_version"],
        **payload,
    }


def classify_failure(state: AgentOSState):
    failure_class = classify_reason(state.get("reason_code", ""))
    return {
        "failure_class": failure_class,
        "recovery_owner": recovery_owner_for(
            failure_class, {"assigned_agent": state.get("current_agent")}
        ),
        "failed_stage": state.get("failed_stage") or state["current_stage"],
        "failed_agent": state.get("failed_agent") or state["current_agent"],
        "status": "recovery_required",
    }


def recover(state: AgentOSState):
    return {
        "attempt": 0,
        "redrive_count": state["redrive_count"] + 1,
        "current_agent": state.get("recovery_owner", state["current_agent"]),
        "status": "recovering",
        "resume_from": state.get("failed_stage", state["current_stage"]),
        "reason_code": "",
    }


def refine(state: AgentOSState):
    owner = state.get("recovery_owner") or state.get("failed_agent") or "selah"
    if owner in {"tessa", "nomy"}:
        owner = "selah"
    return {
        "current_agent": owner,
        "current_stage": "REPAIR",
        "status": "recovering",
        "reason_code": "",
        "qa_status": "not_run",
        "redrive_count": state["redrive_count"] + 1,
        "attempt": 0,
    }


def refinement_exhausted(state: AgentOSState):
    return {
        "status": "blocked",
        "reason_code": "MAX_REDRIVE_EXCEEDED",
        "failure_class": "terminal",
        "recovery_owner": "nomy",
        "failed_stage": "QA",
        "failed_agent": "tessa",
    }


def accept(state: AgentOSState):
    return {
        "status": "completed",
        "current_agent": "nomy",
        "current_stage": "ACCEPTANCE",
        "reason_code": "",
    }


def human_gate(state: AgentOSState):
    request = state.get("human_gate") or {
        "reason_code": state.get("reason_code", "INPUT_REQUIRED"),
        "failed_stage": state.get("failed_stage", state["current_stage"]),
        "failed_agent": state.get("failed_agent", state["current_agent"]),
    }
    response = interrupt(request)
    return {
        "status": "recovery_required",
        "human_gate": {},
        "reason_code": "",
        "qa_feedback": f"Human gate resumed: {response}",
    }


def route_entry(state: AgentOSState):
    return (
        "classify_failure"
        if state.get("status") == "recovery_required" and state.get("reason_code")
        else "execute"
    )


def route_runtime(state: AgentOSState):
    if state.get("reason_code"):
        return "classify_failure"
    if state.get("pending_branches"):
        return "prepare_fanout"
    return "finalize_branch"


def route_after_join(state: AgentOSState):
    return "classify_failure" if state.get("reason_code") else "finalize_branch"


def route_failure(state: AgentOSState):
    kind = state["failure_class"]
    if kind == "quality":
        return (
            "refine"
            if state["redrive_count"] < state["max_redrives"]
            else "refinement_exhausted"
        )
    if kind in {"transient", "dependency"}:
        return "recover" if state["redrive_count"] < state["max_redrives"] else END
    if kind == "authorization":
        return (
            "recover"
            if state["redrive_count"] < state["max_redrives"]
            else "human_gate"
        )
    if kind == "human_input":
        return "human_gate"
    return END


def route_qa(state: AgentOSState):
    if state["qa_status"] == "pass":
        return "accept"
    if state["qa_status"] == "fail":
        failure_class = classify_reason(state.get("reason_code", "QA_FAILED"))
        if failure_class != "quality":
            return "classify_failure"
        return (
            "refine"
            if state["redrive_count"] < state["max_redrives"]
            else "refinement_exhausted"
        )
    return "classify_failure"


def build_graph(checkpointer=None, ports: AgentOSPorts | None = None):
    active_ports = ports or fail_closed_ports()

    def execute(state: AgentOSState):
        active_ports.emit_event(_event(state, "execution.started"))
        result = active_ports.execute_agent(state)
        updates = worker_result_to_updates(result)
        updates.setdefault("attempt", state["attempt"] + 1)
        active_ports.emit_event(
            _event(
                state,
                "execution.finished",
                result_status=result.get("status"),
                reason_code=result.get("reason_code", ""),
            )
        )
        return updates

    def evaluate_runtime(state: AgentOSState):
        return {}

    def _complete_current(state: AgentOSState):
        completed = list(state.get("completed_branches", []))
        current = str(state.get("current_agent") or "").lower()
        if current and current not in completed:
            completed.append(current)
        return completed, current

    def prepare_fanout(state: AgentOSState):
        completed, current = _complete_current(state)
        pending = list(dict.fromkeys(state.get("pending_branches", [])))
        active_ports.emit_event(
            _event(
                state,
                "fanout.dispatched",
                source_agent=current,
                branch_agents=pending,
                branch_count=len(pending),
            )
        )
        return {
            "completed_branches": completed,
            "status": "fanout",
        }

    def fanout_sends(state: AgentOSState):
        sends = []
        for agent in list(dict.fromkeys(state.get("pending_branches", []))):
            branch_state = {
                **state,
                "current_agent": agent,
                "current_stage": "IMPLEMENTATION",
                "status": "executing",
                "attempt": 0,
                "reason_code": "",
                "pending_branches": [],
            }
            sends.append(Send("fanout_execute", branch_state))
        return sends

    def fanout_execute(state: AgentOSState):
        agent = str(state.get("current_agent") or "").lower()
        active_ports.emit_event(_event(state, "fanout.branch_started"))
        result = active_ports.execute_agent(state)
        updates = worker_result_to_updates(result)
        branch_result = {
            "agent": agent,
            "status": str(result.get("status") or ""),
            "reason_code": str(result.get("reason_code") or ""),
            "updates": updates,
        }
        active_ports.emit_event(
            _event(
                state,
                "fanout.branch_finished",
                result_status=branch_result["status"],
                reason_code=branch_result["reason_code"],
            )
        )
        return {"branch_results": [branch_result]}

    def fanout_join(state: AgentOSState):
        pending = list(dict.fromkeys(state.get("pending_branches", [])))
        pending_set = set(pending)
        latest_by_agent = {}
        for result in state.get("branch_results", []):
            agent = str(result.get("agent") or "").lower()
            if agent in pending_set:
                latest_by_agent[agent] = result

        completed = list(state.get("completed_branches", []))
        first_failure = None
        for agent in pending:
            result = latest_by_agent.get(agent)
            if result is None:
                first_failure = {
                    "agent": agent,
                    "status": "blocked",
                    "reason_code": "MISSING_EVIDENCE",
                }
                break
            reason_code = str(result.get("reason_code") or "")
            status = str(result.get("status") or "").lower()
            if reason_code or status in {"blocked", "changes_requested"}:
                first_failure = {
                    "agent": agent,
                    "status": status or "blocked",
                    "reason_code": reason_code or "DEPENDENCY_REQUIRED",
                }
                break
            if agent not in completed:
                completed.append(agent)

        if first_failure:
            failed_agent = first_failure["agent"]
            active_ports.emit_event(
                _event(
                    state,
                    "fanout.join_failed",
                    failed_agent=failed_agent,
                    reason_code=first_failure["reason_code"],
                    completed_branches=completed,
                )
            )
            return {
                "completed_branches": completed,
                "pending_branches": [],
                "current_agent": failed_agent,
                "current_stage": "IMPLEMENTATION",
                "status": "recovery_required",
                "reason_code": first_failure["reason_code"],
                "failed_agent": failed_agent,
                "failed_stage": "IMPLEMENTATION",
            }

        active_ports.emit_event(
            _event(
                state,
                "fanout.join_complete",
                completed_branches=completed,
                branch_count=len(pending),
            )
        )
        return {
            "completed_branches": completed,
            "pending_branches": [],
            "status": "completed",
            "reason_code": "",
        }

    def finalize_branch(state: AgentOSState):
        completed, current = _complete_current(state)
        active_ports.emit_event(
            _event(
                state,
                "fanout.finalized",
                completed_agent=current,
                completed_branches=completed,
            )
        )
        return {"completed_branches": completed}

    def tessa_evaluate(state: AgentOSState):
        qa_state = {**state, "current_agent": "tessa", "current_stage": "QA"}
        active_ports.emit_event(_event(qa_state, "qa.started"))
        result = active_ports.evaluate_qa(qa_state)
        qa_status = result.get("qa_status", "fail")
        feedback = str(result.get("qa_feedback") or "")
        active_ports.emit_event(_event(qa_state, "qa.finished", qa_status=qa_status))
        updates = {
            "current_agent": "tessa",
            "current_stage": "QA",
            "qa_status": qa_status if qa_status in {"pass", "fail", "not_run"} else "fail",
            "qa_feedback": feedback,
        }
        if result.get("reason_code"):
            updates["reason_code"] = str(result["reason_code"])
        elif qa_status == "fail":
            updates["reason_code"] = "QA_FAILED"
        else:
            updates["reason_code"] = ""
        if qa_status == "fail" and classify_reason(updates["reason_code"]) == "quality":
            updates.update(
                {
                    "failed_agent": "selah",
                    "failed_stage": "IMPLEMENTATION",
                    "recovery_owner": "selah",
                }
            )
        return updates

    graph = StateGraph(AgentOSState)
    graph.add_node("execute", execute, retry_policy=RetryPolicy(max_attempts=3))
    graph.add_node("evaluate_runtime", evaluate_runtime)
    graph.add_node("classify_failure", classify_failure)
    graph.add_node("recover", recover)
    graph.add_node("prepare_fanout", prepare_fanout)
    graph.add_node("fanout_execute", fanout_execute, retry_policy=RetryPolicy(max_attempts=3))
    graph.add_node("fanout_join", fanout_join)
    graph.add_node("finalize_branch", finalize_branch)
    graph.add_node("tessa_evaluate", tessa_evaluate)
    graph.add_node("refine", refine)
    graph.add_node("refinement_exhausted", refinement_exhausted)
    graph.add_node("accept", accept)
    graph.add_node("human_gate", human_gate)

    graph.add_conditional_edges(START, route_entry)
    graph.add_edge("execute", "evaluate_runtime")
    graph.add_conditional_edges("evaluate_runtime", route_runtime)
    graph.add_conditional_edges("classify_failure", route_failure)
    graph.add_edge("recover", "execute")
    graph.add_conditional_edges("prepare_fanout", fanout_sends)
    graph.add_edge("fanout_execute", "fanout_join")
    graph.add_conditional_edges("fanout_join", route_after_join)
    graph.add_edge("finalize_branch", "tessa_evaluate")
    graph.add_conditional_edges("tessa_evaluate", route_qa)
    graph.add_edge("refine", "execute")
    graph.add_edge("refinement_exhausted", END)
    graph.add_edge("accept", END)
    graph.add_edge("human_gate", "execute")
    return graph.compile(checkpointer=checkpointer or build_checkpointer())
