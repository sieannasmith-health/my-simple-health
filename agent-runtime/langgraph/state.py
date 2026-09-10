from __future__ import annotations

from typing import Literal, NotRequired, TypedDict

FailureClass = Literal[
    "none",
    "transient",
    "dependency",
    "quality",
    "authorization",
    "human_input",
    "terminal",
]

class AgentOSState(TypedDict):
    objective_id: str
    correlation_id: str
    current_agent: str
    current_stage: str
    status: str
    attempt: int
    max_attempts: int
    redrive_count: int
    max_redrives: int
    failed_stage: NotRequired[str]
    failed_agent: NotRequired[str]
    failure_class: FailureClass
    reason_code: NotRequired[str]
    recovery_owner: NotRequired[str]
    resume_from: NotRequired[str]
    completed_branches: list[str]
    pending_branches: list[str]
    qa_status: Literal["not_run", "pass", "fail"]
    qa_feedback: NotRequired[str]
    human_gate: NotRequired[dict]
    evidence_version: int
