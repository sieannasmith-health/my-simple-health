# Durable Runtime Core

This package is the database-backed execution substrate for long-running autonomous work. It complements the existing GitHub-driven agent runtime; it does not replace the current issue/comment routing layer in this pull request.

## Source of truth

PostgreSQL task/objective projections are authoritative runtime state. `event_ledger` is immutable historical/audit evidence and is written in the same transaction as lifecycle changes.

## Local verification

1. `docker compose up -d`
2. `psql postgresql://postgres:postgres@localhost:5432/asdlc_test -v ON_ERROR_STOP=1 -f migrations/001_runtime_core.sql`
3. `npm install`
4. `npm run typecheck`
5. `npm test`
6. `npm run build`

## PR #1 scope

- PostgreSQL schema and lifecycle vocabulary
- pool-isolated transactions
- guarded task transitions
- lease fencing
- worker start and heartbeat primitives
- idempotent completion
- lease reclamation and retry exhaustion
- adversarial concurrency tests
- pull-request CI gate

## Deferred to follow-up PRs

- network-facing Worker API
- authenticated worker identity
- token broker / scoped external credentials
- durable validation workers and assertion registry
- dependency fan-in/fan-out release engine
- objective completion projection
- external-system webhook adapters

The runtime must not contain member health data, financial data, secrets, API keys, or other sensitive member content.
