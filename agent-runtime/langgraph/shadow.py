from __future__ import annotations

import json
import sys

from .adapters import legacy_state_to_agent_os
from .checkpoint import build_checkpointer
from .controller import build_graph


def run_shadow(issue_number: int, legacy_state: dict) -> dict:
    state = legacy_state_to_agent_os(issue_number, legacy_state)
    graph = build_graph(checkpointer=build_checkpointer())
    config = {"configurable": {"thread_id": state["correlation_id"]}}
    result = graph.invoke(state, config=config)
    return result


def main() -> int:
    payload = json.load(sys.stdin)
    issue_number = int(payload["issue_number"])
    legacy_state = payload["state"]
    result = run_shadow(issue_number, legacy_state)
    json.dump(result, sys.stdout, sort_keys=True)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
