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
- `MSH_GOVERNED_RUNTIME_URL` and `MSH_GOVERNED_RUNTIME_TOKEN` when the governed runtime endpoint is available
- Otherwise `OPENAI_API_KEY` and optional `OPENAI_MODEL`/`OPENAI_API_URL`

In Slack app configuration, enable Events API and set the Request URL to the endpoint above. Subscribe to message events for the collaboration channel. The app must have permission to post messages in that channel.

## Operating contract

Use `AgentName: request`, for example `Iris: summarize the research plan`. `Everyone:` routes only to Nomy. Unknown agents, unapproved users/channels, restricted health content, and requests to mutate GitHub/product state are denied. Slack is transport only; GitHub and LangGraph remain durable authority.

## Failure and rollback

A 401 indicates signature or timestamp rejection. A 403 indicates workspace/channel/user denial. A 503 indicates a transient runtime or Slack failure and is retryable. Disable the Slack Events subscription or remove the Vercel deployment environment variables to stop ingress. This does not affect Agent OS execution.

Audit records contain correlation IDs and routing metadata, never message bodies, credentials, or restricted content. The in-memory duplicate window is intentionally bounded to the serverless instance lifetime; a durable idempotency store should be added only through a separately governed infrastructure decision.
