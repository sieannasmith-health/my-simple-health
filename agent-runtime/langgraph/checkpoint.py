from __future__ import annotations

import os
from contextlib import contextmanager


def _mode() -> str:
    return os.getenv("LANGGRAPH_CHECKPOINTER", "memory").strip().lower()


def build_checkpointer():
    """Return an in-memory checkpointer for tests and shadow execution only."""
    mode = _mode()
    if mode != "memory":
        raise RuntimeError(
            "Durable Postgres checkpointers must be opened with checkpointer_scope()"
        )
    from langgraph.checkpoint.memory import InMemorySaver
    return InMemorySaver()


@contextmanager
def checkpointer_scope():
    """Open the configured checkpointer for the full graph execution lifetime.

    LangGraph's PostgresSaver.from_conn_string() is a context manager. Keeping
    the context open across compile + invoke prevents returning a saver backed
    by an already-closed or never-entered connection.
    """
    mode = _mode()

    if mode == "memory":
        from langgraph.checkpoint.memory import InMemorySaver
        yield InMemorySaver()
        return

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
        with PostgresSaver.from_conn_string(uri) as saver:
            saver.setup()
            yield saver
        return

    raise RuntimeError(f"Unsupported LANGGRAPH_CHECKPOINTER mode: {mode}")
