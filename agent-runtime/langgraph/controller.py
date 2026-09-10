from __future__ import annotations

from langgraph.graph import END, START, StateGraph
from langgraph.types import RetryPolicy, interrupt

from .adapters import classify_reason, recovery_owner_for, worker_result_to_updates
from .checkpoint import build_checkpointer
from .ports import AgentOSPorts, fail_closed_ports
from .state import AgentOSState


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
        "recovery_owner": recovery_owner_for(failure_class, {"assigned_agent": state.get("current_agent")}),
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
    owner = state.get("failed_agent") or state.get("recovery_owner") or "selah"
    if owner == "tessa":
        owner = "selah"
    return {
        "current_agent": owner,
        "current_stage": "REPAIR",
        "status": "recovering",
        "reason_code": "",
        "qa_status": "not_run",
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


def route_runtime(state: AgentOSState):
    if state.get("reason_code"):
        return "classify_failure"
    if state.get("pending_branches"):
        return "join_next"
    return "tessa_evaluate"


def route_failure(state: AgentOSState):
    kind = state["failure_class"]
    if kind == "quality":
        return "refine"
    if kind in {"transient", "dependency"}:
        return "recover" if state["redrive_count"] < state["max_redrives"] else END
    if kind == "authorization":
        return "recover" if state["redrive_count"] < state["max_redrives"] else "human_gate"
    if kind == "human_input":
        return "human_gate"
    return END


def route_qa(state: AgentOSState):
    if state["qa_status"] == "pass":
        return "accept"
    if state["qa_status"] == "fail":
        return "refine"
    return "classify_failure"


def build_graph(checkpointer=None, ports: AgentOSPorts | None = None):
    active_ports = ports or fail_closed_ports()

    def execute(state: AgentOSState):
        active_ports.emit_event(_event(state, "execution.started"))
        result = active_ports.execute_agent(state)
        updates = worker_result_to_updates(result)
        updates.setdefault("attempt", state["attempt"] + 1)
        active_ports.emit_event(_event(state, "execution.finished", result_status=result.get("status"), reason_code=result.get("reason_code", "")))
        return updates

    def evaluate_runtime(state: AgentOSState):
        return {}

    def join_next(state: AgentOSState):
        pending = list(state.get("pending_branches", []))
        completed = list(state.get("completed_branches", []))
        current = str(state.get("current_agent") or "").lower()
        if current and current not in completed:
            completed.append(current)
        if not pending:
            return {"completed_branches": completed}
        next_agent = pending.pop(0)
        active_ports.emit_event(_event(state, "fanout.branch_joined", completed_agent=current, next_agent=next_agent))
        return {
            "completed_branches": completed,
            "pending_branches": pending,
            "current_agent": next_agent,
            "current_stage": "IMPLEMENTATION",
            "status": "executing",
            "reason_code": "",
            "attempt": 0,
        }

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
        return updates

    graph = StateGraph(AgentOSState)
    graph.add_node("execute", execute, retry_policy=RetryPolicy(max_attempts=3))
    graph.add_node("evaluate_runtime", evaluate_runtime)
    graph.add_node("classify_failure", classify_failure)
    graph.add_node("recover", recover)
    graph.add_node("join_next", join_next)
    graph.add_node("tessa_evaluate", tessa_evaluate)
    graph.add_node("refine", refine)
    graph.add_node("accept", accept)
    graph.add_node("human_gate", human_gate)

    graph.add_edge(START, "execute")
    graph.add_edge("execute", "evaluate_runtime")
    graph.add_conditional_edges("evaluate_runtime", route_runtime)
    graph.add_conditional_edges("classify_failure", route_failure)
    graph.add_edge("recover", "execute")
    graph.add_edge("join_next", "execute")
    graph.add_conditional_edges("tessa_evaluate", route_qa)
    graph.add_edge("refine", "execute")
    graph.add_edge("accept", END)
    graph.add_edge("human_gate", "execute")

    return graph.compile(checkpointer=checkpointer or build_checkpointer())
