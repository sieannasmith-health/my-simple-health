from __future__ import annotations

from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from checkpoint import checkpointer_scope


class CounterState(TypedDict):
    value: int


def _graph(checkpointer):
    def increment(state: CounterState):
        return {"value": state["value"] + 1}

    builder = StateGraph(CounterState)
    builder.add_node("increment", increment)
    builder.add_edge(START, "increment")
    builder.add_edge("increment", END)
    return builder.compile(checkpointer=checkpointer)


def test_postgres_checkpointer_survives_reopen(monkeypatch):
    monkeypatch.setenv("LANGGRAPH_CHECKPOINTER", "postgres")
    uri = "postgresql://postgres:postgres@localhost:5432/postgres"
    monkeypatch.setenv("LANGGRAPH_POSTGRES_URI", uri)
    config = {"configurable": {"thread_id": "p0-postgres-checkpoint-proof"}}

    with checkpointer_scope() as saver:
        graph = _graph(saver)
        first = graph.invoke({"value": 1}, config=config)
        assert first["value"] == 2

    with checkpointer_scope() as saver:
        graph = _graph(saver)
        snapshot = graph.get_state(config)
        assert snapshot.values["value"] == 2

        resumed = graph.invoke(None, config=config)
        assert resumed["value"] == 2
