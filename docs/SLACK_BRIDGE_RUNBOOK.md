# Governed Slack bridge runbook

## Deployment

Deploy the repository to the existing Vercel project. The callback endpoint is:

`https://<MSH_VERCEL_DOMAIN>/api/slack-events`

Configure these Vercel production/preview secrets and variables without placing values in GitHub comments or source:

- `SLACK_SIGNING_SECRET`
- `SLACK_BOT_TOKEN`
- `MSH_SLACK_TEAM_ID`
- `MSH_SLACK_ALLOWED_USERS` (initially Siea and Brandon Slack user IDs)
- `MSH_SLACK_ALLOWED_CHANNELS` (initially `C0C0T9F3LUF`)
- `MSH_GOVERNED_RUNTIME_URL`
- `MSH_GOVERNED_RUNTIME_TOKEN` when required by the governed runtime
- `MSH_SLACK_IDEMPOTENCY_STORE_URL`
- `MSH_SLACK_IDEMPOTENCY_STORE_TOKEN` when required by the durable store

The Slack bridge must never call a model provider directly. If the governed runtime is not configured or reachable, the bridge fails closed/degraded. Any model routing or provider fallback belongs inside the governed MSH runtime/LangGraph boundary.

In Slack app configuration, enable Events API and set the Request URL to the endpoint above. Subscribe only to the message events required for the approved collaboration channel. The app must have permission to post replies in that channel.

## Operating contract

Use `AgentName: request`, for example `Iris: summarize the research plan`. `Everyone:` routes only to Nomy. Agent identity and role are loaded from `agent-runtime/agents.json`; do not maintain a second role map in the Slack transport.

The Slack Events API envelope is expected to provide top-level `event_id` plus message `event.user`, `event.channel`, `event.ts`, and `event.text`. The bridge also tolerates compatible legacy aliases where present, but tests must use the real Slack envelope.

Unknown agents, malformed events, unapproved users/channels, restricted sensitive content, and requests to mutate GitHub/product state are denied or fail closed. Slack is transport only; GitHub and the governed Agent OS/LangGraph runtime remain durable authority. Slack may not bypass typed human gates.

## Idempotency

Production requires a durable idempotency store configured through `MSH_SLACK_IDEMPOTENCY_STORE_URL`. The store must atomically claim a Slack event ID and return whether the event was newly claimed. Claims use a bounded TTL sufficient to cover Slack retries. If the durable store is missing or unavailable in production, ingress returns a fail-closed 503 and does not invoke the runtime.

In-memory idempotency is permitted only in non-production deterministic/local tests through injected or development stores.

## Verification before merge

Run the canonical repository test command on the exact PR head:

`node --test tests/*.test.mjs`

The Slack suite must cover at minimum:

- valid/invalid/stale request signatures;
- actual Slack envelope normalization (`payload.event_id`, `event.user`, `event.channel`);
- allowlisted Siea and Brandon access plus denied user/channel/workspace permutations;
- exhaustive canonical agent name/role parity and `Everyone:` -> Nomy;
- malformed and duplicate events;
- production durable-idempotency missing/unavailable fail-closed behavior;
- restricted-content and durable-mutation rejection;
- governed-runtime-only dispatch and failure when it is not configured;
- retry/failure classification;
- attributed threaded replies; and
- audit/correlation metadata with no message-body logging.

After exact-head CI is green, route Aiden security review and Vera privacy review, then Tessa exact-head/adversarial QA, then Nomy Product acceptance. Only after those gates pass should the change be merged and promoted for live Slack E2E.

## Failure and rollback

A 401 indicates signature or timestamp rejection. A 403 indicates authorization, addressing, restricted-content, or durable-mutation denial. A 503 indicates durable idempotency infrastructure is unavailable. Runtime failures return a retryable or permanent classification without bypassing governance.

To stop Slack ingress, disable the Slack Events subscription or remove the Slack bridge deployment environment configuration. This must not impair Agent OS execution.

Audit records contain correlation IDs and routing metadata only; they must never include message bodies, credentials, tokens, PHI, or other restricted content.
