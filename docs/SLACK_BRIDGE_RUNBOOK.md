# Governed Slack bridge

Callback endpoint: `POST https://<MSH Vercel deployment>/api/slack-events`.

Required secret configuration:

- `MSH_SLACK_SIGNING_SECRET`
- `MSH_SLACK_BOT_TOKEN`
- `MSH_SLACK_TEAM_ID`
- `MSH_SLACK_ALLOWED_CHANNELS`
- `MSH_SLACK_ALLOWED_USERS`
- `MSH_SLACK_IDEMPOTENCY_URL`
- `MSH_SLACK_IDEMPOTENCY_TOKEN`
- `MSH_GOVERNED_RUNTIME_URL` (preferred) or `MSH_OPENAI_API_KEY` and optional `MSH_OPENAI_MODEL`

The idempotency service must accept `POST {key, ttl_seconds, operation:"claim"}` and return `409` for an already-claimed key. Production ingress fails closed when this durable store is not configured. The store must retain keys for at least 24 hours.

Slack URL verification is handled by the same endpoint. Slack signatures must be verified against the raw request body and a five-minute timestamp window. Only the configured workspace, channel, and human IDs can invoke the bridge. `Everyone:` routes only to Nomy. Unknown agents, sensitive/PHI-like content, and durable-state mutation requests are rejected.

Responses are posted by the single Slack service identity into the originating thread and visibly identify the canonical agent and role. Audit records contain correlation, identity, channel, purpose, timestamp, result, and reason only. Message bodies and tokens are never logged.

The governed runtime remains the authority for agent execution. Slack is transport only and cannot merge, deploy, alter GitHub state, bypass human gates, or create durable orchestration state. Disable ingress by removing the Vercel route or Slack event subscription. Agent OS execution is unaffected.

For account-owner setup, configure the Slack Request URL above and the secret values through the approved deployment secret manager. Do not place credentials in GitHub issues, comments, source, or tests.
