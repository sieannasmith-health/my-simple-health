from __future__ import annotations

import json
import sys

from adapters import legacy_state_to_agent_os
from checkpoint import build_checkpointer
from controller import build_graph
from ports import ScriptedPorts


def run_shadow(issue_number: int, legacy_state: dict, *, execution_results: dict | None = None, qa_results: list | None = None) -> dict:
    state = legacy_state_to_agent_os(issue_number, legacy_state)
    scripted = ScriptedPorts(execution_results=execution_results, qa_results=qa_results)
    graph = build_graph(checkpointer=build_checkpointer(), ports=scripted.as_ports())
    config = {"configurable": {"thread_id": state["correlation_id"]}}
    result = graph.invoke(state, config=config)
    return {"state": result, "events": scripted.events}


def main() -> int:
    payload = json.load(sys.stdin)
    result = run_shadow(
        int(payload["issue_number"]),
        payload["state"],
        execution_results=payload.get("execution_results"),
        qa_results=payload.get("qa_results"),
    )
    json.dump(result, sys.stdout, sort_keys=True)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
