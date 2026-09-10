from __future__ import annotations

from langgraph.graph import END, START, StateGraph
from langgraph.types import RetryPolicy, interrupt

from .adapters import classify_reason, recovery_owner_for
from .checkpoint import build_checkpointer
from .state import AgentOSState


def execute(state: AgentOSState):
    return {"status": "executing"}


def evaluate_runtime(state: AgentOSState):
    # Runtime adapter will replace this placeholder with deterministic execution evidence.
    return {}


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
        # Redrive is a new local attempt from the failed checkpoint, while redrive_count
        # tracks bounded objective-level recovery cycles.
        "attempt": 0,
        "redrive_count": state["redrive_count"] + 1,
        "current_agent": state.get("recovery_owner", state["current_agent"]),
        "status": "recovering",
        "resume_from": state.get("failed_stage", state["current_stage"]),
        "reason_code": "",
    }


def tessa_evaluate(state: AgentOSState):
    return {"current_agent": "tessa", "current_stage": "QA"}


def refine(state: AgentOSState):
    return {
        "current_agent": state.get("recovery_owner", "selah"),
        "current_stage": "REPAIR",
        "status": "recovering",
        "reason_code": "",
    }


def accept(state: AgentOSState):
    return {"status": "completed", "current_agent": "nomy", "current_stage": "ACCEPTANCE"}


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
    return "accept"


def build_graph(checkpointer=None):
    graph = StateGraph(AgentOSState)
    graph.add_node("execute", execute, retry_policy=RetryPolicy(max_attempts=3))
    graph.add_node("evaluate_runtime", evaluate_runtime)
    graph.add_node("classify_failure", classify_failure)
    graph.add_node("recover", recover)
    graph.add_node("tessa_evaluate", tessa_evaluate)
    graph.add_node("refine", refine)
    graph.add_node("accept", accept)
    graph.add_node("human_gate", human_gate)

    graph.add_edge(START, "execute")
    graph.add_edge("execute", "evaluate_runtime")
    graph.add_conditional_edges("evaluate_runtime", route_runtime)
    graph.add_conditional_edges("classify_failure", route_failure)
    graph.add_edge("recover", "execute")
    graph.add_conditional_edges("tessa_evaluate", route_qa)
    graph.add_edge("refine", "execute")
    graph.add_edge("accept", END)
    graph.add_edge("human_gate", "execute")

    return graph.compile(checkpointer=checkpointer or build_checkpointer())
