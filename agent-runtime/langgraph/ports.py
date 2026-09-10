from __future__ import annotations

import json
import re
import subprocess
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Any, Mapping, Protocol, Sequence

from state import AgentOSState


class AgentExecutionPort(Protocol):
    def __call__(self, state: AgentOSState) -> dict[str, Any]: ...


class QAEvaluationPort(Protocol):
    def __call__(self, state: AgentOSState) -> dict[str, Any]: ...


class EventPort(Protocol):
    def __call__(self, event: dict[str, Any]) -> None: ...


@dataclass(frozen=True)
class AgentOSPorts:
    execute_agent: AgentExecutionPort
    evaluate_qa: QAEvaluationPort
    emit_event: EventPort


def _drop_event(_event: dict[str, Any]) -> None:
    return None


def fail_closed_ports() -> AgentOSPorts:
    def execute(_state: AgentOSState) -> dict[str, Any]:
        return {"status": "blocked", "reason_code": "EXECUTION_ADAPTER_NOT_CONFIGURED", "message": "LangGraph execution adapter is not configured."}
    def qa(_state: AgentOSState) -> dict[str, Any]:
        return {"qa_status": "fail", "qa_feedback": "LangGraph QA adapter is not configured.", "reason_code": "QA_ADAPTER_NOT_CONFIGURED"}
    return AgentOSPorts(execute_agent=execute, evaluate_qa=qa, emit_event=_drop_event)


class ScriptedPorts:
    def __init__(self, execution_results: Mapping[str, Sequence[Mapping[str, Any]]] | None = None, qa_results: Sequence[Mapping[str, Any]] | None = None) -> None:
        self.execution_results = defaultdict(deque)
        for agent, results in (execution_results or {}).items():
            self.execution_results[str(agent).lower()].extend(dict(item) for item in results)
        self.qa_results = deque(dict(item) for item in (qa_results or []))
        self.events: list[dict[str, Any]] = []

    def execute_agent(self, state: AgentOSState) -> dict[str, Any]:
        queue = self.execution_results[str(state.get("current_agent") or "").lower()]
        if not queue:
            return {"status": "blocked", "reason_code": "MISSING_EVIDENCE", "message": f"No scripted execution evidence for {state.get('current_agent')}"}
        return queue.popleft()

    def evaluate_qa(self, _state: AgentOSState) -> dict[str, Any]:
        if not self.qa_results:
            return {"qa_status": "fail", "qa_feedback": "No scripted Tessa evaluation evidence.", "reason_code": "MISSING_EVIDENCE"}
        return self.qa_results.popleft()

    def emit_event(self, event: dict[str, Any]) -> None:
        self.events.append(dict(event))

    def as_ports(self) -> AgentOSPorts:
        return AgentOSPorts(execute_agent=self.execute_agent, evaluate_qa=self.evaluate_qa, emit_event=self.emit_event)


def _issue_number(state: AgentOSState) -> int | None:
    match = re.fullmatch(r"github-issue-(\d+)", str(state.get("objective_id") or ""))
    return int(match.group(1)) if match else None


class JsonSubprocessExecutionPort:
    def __init__(self, command: Sequence[str], *, timeout_seconds: int = 120, env: Mapping[str, str] | None = None) -> None:
        if not command:
            raise ValueError("execution adapter command is required")
        self.command = tuple(str(part) for part in command)
        self.timeout_seconds = timeout_seconds
        self.env = dict(env) if env is not None else None

    def __call__(self, state: AgentOSState) -> dict[str, Any]:
        payload = {
            "issue_number": _issue_number(state),
            "objective_id": state["objective_id"],
            "correlation_id": state["correlation_id"],
            "agent": state["current_agent"],
            "stage": state["current_stage"],
            "attempt": state["attempt"],
            "redrive_count": state["redrive_count"],
            "resume_from": state.get("resume_from", ""),
            "completed_branches": list(state.get("completed_branches", [])),
            "evidence_version": state["evidence_version"],
        }
        try:
            completed = subprocess.run(self.command, input=json.dumps(payload), text=True, capture_output=True, shell=False, timeout=self.timeout_seconds, env=self.env, check=False)
        except subprocess.TimeoutExpired:
            return {"status": "blocked", "reason_code": "TIMEOUT", "message": "Execution adapter timed out."}
        except OSError as exc:
            return {"status": "blocked", "reason_code": "TOOL_UNAVAILABLE", "message": str(exc)}
        if completed.returncode != 0:
            return {"status": "blocked", "reason_code": "TOOL_UNAVAILABLE", "message": completed.stderr.strip() or f"Execution adapter exited {completed.returncode}"}
        try:
            result = json.loads(completed.stdout)
        except json.JSONDecodeError:
            return {"status": "blocked", "reason_code": "INVALID_EXECUTION_EVIDENCE", "message": "Execution adapter returned invalid JSON."}
        if not isinstance(result, dict):
            return {"status": "blocked", "reason_code": "INVALID_EXECUTION_EVIDENCE", "message": "Execution adapter response must be a JSON object."}
        return result
