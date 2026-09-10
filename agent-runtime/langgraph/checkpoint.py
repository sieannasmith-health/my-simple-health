from __future__ import annotations

import os


def build_checkpointer():
    """Return the configured LangGraph checkpointer.

    Production cutover must provide LANGGRAPH_CHECKPOINTER=postgres and
    LANGGRAPH_POSTGRES_URI. Memory mode is allowed only for tests/shadow work.
    """
    mode = os.getenv("LANGGRAPH_CHECKPOINTER", "memory").strip().lower()

    if mode == "memory":
        from langgraph.checkpoint.memory import InMemorySaver
        return InMemorySaver()

    if mode == "postgres":
        uri = os.getenv("LANGGRAPH_POSTGRES_URI", "").strip()
        if not uri:
            raise RuntimeError("LANGGRAPH_POSTGRES_URI is required for postgres checkpointer")
        try:
            from langgraph.checkpoint.postgres import PostgresSaver
        except ImportError as exc:
            raise RuntimeError(
                "Install langgraph-checkpoint-postgres before enabling postgres persistence"
            ) from exc
        saver = PostgresSaver.from_conn_string(uri)
        saver.setup()
        return saver

    raise RuntimeError(f"Unsupported LANGGRAPH_CHECKPOINTER mode: {mode}")
