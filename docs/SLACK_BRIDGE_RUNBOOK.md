# Governed Slack bridge runbook

## Deployment

Deploy the repository to the existing Vercel project. The callback endpoint is:

`https://<MSH_VERCEL_DOMAIN>/api/slack-events`

Configure these Vercel production/preview secrets and variables without placing values in GitHub comments or source:

- `SLACK_SIGNING_SECRET`
- `SLACK_BOT_TOKEN`
- `MSH_SLACK_TEAM_ID`
- `MSH_SLACK_ALLOWED_USERS` (initially Siea and Brandon Slack user IDs)
- `MSH_SLACK_ALLOWED_CHANNELS` (initially `C0C0T9F3LUF`; DM conversation IDs are intentionally not listed)
- `MSH_GOVERNED_RUNTIME_URL`
- `MSH_GOVERNED_RUNTIME_TOKEN` when required by the governed runtime
- `MSH_SLACK_IDEMPOTENCY_STORE_URL`
- `MSH_SLACK_IDEMPOTENCY_STORE_TOKEN` when required by the durable store

The Slack bridge must never call a model provider directly. If the governed runtime is not configured or reachable, the bridge fails closed/degraded. Any model routing or provider fallback belongs inside the governed MSH runtime/LangGraph boundary.

## Slack app configuration

Enable Events API and set the Request URL to the endpoint above. Subscribe to the bot event `message.im` for governed direct messages and to only the channel-message events required for the approved collaboration channel. If Slack indicates the event/scope change requires reinstall or re-authorization, reinstall/re-authorize the app before the live acceptance test. The bot must have the minimum scope required to post replies (`chat:write`) and read only the approved message surfaces.

A DM (`channel_type: im`, normally a `D...` conversation) is authorized by workspace + user allowlists; its ephemeral conversation ID does not need to be added to `MSH_SLACK_ALLOWED_CHANNELS`. Channel traffic remains separately channel-allowlisted and does not inherit the DM default-routing rule.

## Operating contract

In an approved channel use `AgentName: request`, for example `Iris: summarize the research plan`. `Everyone:` routes only to Nomy. Unprefixed top-level channel messages remain denied.

In an approved DM, unprefixed text defaults to Nomy. Explicit specialist addressing remains available: `Genesis: ...`, `Mira: ...`, `Selah: ...`, etc. Ordinary DM responses are posted directly into the same DM conversation; a DM message that is genuinely part of a Slack thread preserves that thread.

Agent identity and role are loaded from `agent-runtime/agents.json`; do not maintain a second role map in the Slack transport.

The Slack Events API envelope is expected to provide top-level `event_id` plus message `event.user`, `event.channel`, `event.ts`, `event.text`, and where supplied `event.channel_type`. The bridge also recognizes canonical `D...` IM conversation IDs defensively. Thread replies may include `event.thread_ts`.

Unknown agents, malformed events, unapproved users/workspaces/channels, restricted sensitive content, and requests to mutate GitHub/product state are denied or fail closed. Slack is transport only; GitHub and the governed Agent OS/LangGraph runtime remain durable authority. Slack may not bypass typed human gates.

## Idempotency

Production requires a durable idempotency store configured through `MSH_SLACK_IDEMPOTENCY_STORE_URL`. The store must atomically claim a Slack event ID and return whether the event was newly claimed. Claims use a bounded TTL sufficient to cover Slack retries. If the durable store is missing or unavailable in production, ingress returns a fail-closed 503 and does not invoke the runtime.

In-memory idempotency is permitted only in non-production deterministic/local tests through injected or development stores.

## Verification before merge

Run the exact-head Slack governance suite on the PR head:

`node --test tests/slack-events.test.mjs tests/agent-runtime.test.mjs tests/slack-idempotency.test.mjs`

The suite must cover valid/invalid/stale signatures; actual Slack envelope normalization; Siea/Brandon access and denied permutations; strict channel authorization; allowlisted `D...` DM authorization without per-DM channel configuration; unprefixed DM -> Nomy; explicit specialist DM routing; ordinary DM direct replies; threaded DM preservation; canonical agent parity and `Everyone:` -> Nomy; malformed/bot/subtype/duplicate events; production durable-idempotency failure behavior; restricted-content and durable-mutation rejection; governed-runtime-only dispatch; retry/failure classification; attributed replies; and audit/correlation metadata without message-body logging.

After exact-head CI is green, route Aiden security review and Vera privacy review, then Tessa exact-head/adversarial QA, then Nomy Product acceptance. Only after those gates pass should the change be merged and promoted for live Slack E2E.

## Live DM acceptance

From Brandon's allowlisted Slack account, DM the My Simple Health app:

`What should I work on right now, and why?`

Expected: Nomy replies directly in the same DM using governed MSH context.

Then send:

`Mira: What design context is relevant to my current task?`

Expected: Mira is selected by the canonical registry and replies in the same DM. `Genesis: ...` and other registered specialists follow the same explicit-routing contract.

Do not mark DM support complete from unit tests alone. Production acceptance requires these live Slack events to reach `/api/slack-events`, invoke the governed runtime once per event, and post the correctly attributed response back into the originating DM.

## Failure and rollback

A 401 indicates signature or timestamp rejection. A 403 indicates authorization, addressing, restricted-content, or durable-mutation denial. A 503 indicates durable idempotency infrastructure is unavailable. Runtime failures return a retryable or permanent classification without bypassing governance.

To stop Slack ingress, disable the Slack Events subscription or remove the Slack bridge deployment environment configuration. This must not impair Agent OS execution.

Audit records contain correlation IDs and routing metadata only; they must never include message bodies, credentials, tokens, PHI, or other restricted content.
