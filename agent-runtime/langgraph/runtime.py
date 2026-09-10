from __future__ import annotations

import json
import os
import re
import sys
import urllib.request

from adapters import legacy_state_to_agent_os
from checkpoint import build_checkpointer
from controller import build_graph
from ports import AgentOSPorts, JsonSubprocessExecutionPort

STATE_START = "<!-- MSH_STATE_LOCK -->"
STATE_END = "<!-- MSH_STATE_LOCK_END -->"


def _load_issue_state(issue_number: int) -> dict:
    repository = os.environ["GITHUB_REPOSITORY"]
    token = os.environ["GITHUB_TOKEN"]
    url = f"https://api.github.com/repos/{repository}/issues/{issue_number}"
    request = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        issue = json.load(response)
    body = str(issue.get("body") or "")
    pattern = re.compile(
        re.escape(STATE_START) + r"\s*```json\s*([\s\S]*?)\s*```\s*" + re.escape(STATE_END)
    )
    match = pattern.search(body)
    if not match:
        raise RuntimeError(f"Issue #{issue_number} has no durable MSH state block")
    return json.loads(match.group(1))


def _qa_adapter(worker: JsonSubprocessExecutionPort):
    def evaluate(state):
        result = worker({**state, "current_agent": "tessa", "current_stage": "QA"})
        status = str(result.get("status") or "")
        if status in {"completed", "ready_for_product"}:
            return {"qa_status": "pass", "qa_feedback": str(result.get("message") or "Tessa passed")}
        reason = str(result.get("reason_code") or "")
        if status in {"changes_requested", "review_requested"} and not reason:
            reason = "QA_FAILED"
        return {
            "qa_status": "fail",
            "qa_feedback": str(result.get("message") or "Tessa did not pass the implementation"),
            "reason_code": reason or "QA_FAILED",
        }
    return evaluate


def _emit_event(event: dict) -> None:
    sys.stderr.write(f"[LANGGRAPH_EVENT] {json.dumps(event, sort_keys=True)}\n")


def main() -> int:
    if os.getenv("LANGGRAPH_CHECKPOINTER", "").strip().lower() != "postgres":
        raise RuntimeError("Production LangGraph runtime requires LANGGRAPH_CHECKPOINTER=postgres")
    issue_number = int(os.environ["ISSUE_NUMBER"])
    legacy = _load_issue_state(issue_number)
    state = legacy_state_to_agent_os(issue_number, legacy)
    worker = JsonSubprocessExecutionPort(
        ["node", "agent-runtime/langgraph-worker-bridge.mjs"],
        timeout_seconds=int(os.getenv("LANGGRAPH_WORKER_TIMEOUT_SECONDS", "480")),
        env=os.environ,
    )
    ports = AgentOSPorts(execute_agent=worker, evaluate_qa=_qa_adapter(worker), emit_event=_emit_event)
    graph = build_graph(checkpointer=build_checkpointer(), ports=ports)
    config = {"configurable": {"thread_id": state["correlation_id"]}}
    result = graph.invoke(state, config=config)
    sys.stdout.write(json.dumps(result, sort_keys=True) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
