from __future__ import annotations

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import RetryPolicy

from .state import AgentOSState


def execute(state: AgentOSState):
    return {"status": "executing"}


def evaluate_runtime(state: AgentOSState):
    # Runtime adapters replace this placeholder with deterministic execution evidence.
    return {}


def classify_failure(state: AgentOSState):
    reason = state.get("reason_code", "")
    if reason in {"RATE_LIMIT", "TIMEOUT", "TOOL_UNAVAILABLE"}:
        failure_class = "transient"
    elif reason in {"DEPENDENCY_REQUIRED", "MISSING_EVIDENCE"}:
        failure_class = "dependency"
    elif reason in {"QA_FAILED", "IMPLEMENTATION_DEFECT"}:
        failure_class = "quality"
    elif reason in {"AUTHORIZATION_REQUIRED", "PROTECTED_WRITE"}:
        failure_class = "authorization"
    elif reason in {"FOUNDER_INPUT_REQUIRED", "CREDENTIAL_REQUIRED"}:
        failure_class = "human_input"
    else:
        failure_class = "terminal"
    return {"failure_class": failure_class}


def recover(state: AgentOSState):
    attempts = state["attempt"] + 1
    redrives = state["redrive_count"] + 1
    return {
        "attempt": attempts,
        "redrive_count": redrives,
        "status": "recovering",
        "resume_from": state.get("failed_stage", state["current_stage"]),
    }


def tessa_evaluate(state: AgentOSState):
    return {"current_agent": "tessa", "current_stage": "QA"}


def refine(state: AgentOSState):
    return {
        "current_agent": state.get("recovery_owner", "selah"),
        "current_stage": "REPAIR",
        "status": "recovering",
    }


def accept(state: AgentOSState):
    return {"status": "completed", "current_agent": "nomy", "current_stage": "ACCEPTANCE"}


def human_gate(state: AgentOSState):
    return {"status": "input_required"}


def route_runtime(state: AgentOSState):
    if state.get("reason_code"):
        return "classify_failure"
    return "tessa_evaluate"


def route_failure(state: AgentOSState):
    kind = state["failure_class"]
    if kind == "quality":
        return "refine"
    if kind in {"transient", "dependency", "authorization"}:
        if state["redrive_count"] < state["max_redrives"] and state["attempt"] < state["max_attempts"]:
            return "recover"
        return "human_gate" if kind == "authorization" else END
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
    graph.add_edge("human_gate", END)

    return graph.compile(checkpointer=checkpointer or InMemorySaver())
