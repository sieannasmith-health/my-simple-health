# My Simple Health — Google Cloud Migration

## Decision

MSH will migrate away from Supabase incrementally rather than through a big-bang rewrite.

The target direction is:

```text
Apple / Web clients
        ↓
Firebase Authentication + Identity Platform
        ↓
MSH API on Cloud Run
        ↓
Cloud SQL for PostgreSQL
        ↓
Cloud Storage / BigQuery / other Google Cloud services as justified
```

Vercel can continue hosting the public website during the migration. GitHub remains the source of truth for application code, infrastructure code, migrations, and deployment configuration.

## Why identity moves first

Authentication is currently the least reliable Supabase layer and it is foundational to account ownership, health data, calendar sharing, partner sharing, financial sharing, and continuity workflows.

The current native iOS coupling is intentionally small:

- `ios/MySimpleHealthApp/project.yml` pins `supabase-swift`.
- `ios/MySimpleHealthApp/App/MSHAuth.swift` owns the Supabase client, sessions, email/password auth, Google OAuth, callback handling, and user identity.
- `ios/MySimpleHealthApp/App/MySimpleHealthApp.swift` forwards auth callback URLs into the auth store.
- The current callback URL scheme is registered in the generated project configuration and Info.plist.

This means auth can be replaced before the database is moved.

## Target auth choice

Start with Firebase Authentication SDKs in the clients and enable Identity Platform on the same Google Cloud project when MSH needs the enterprise controls it provides. Google documents Identity Platform as the backend for Firebase Authentication with compatible client SDKs, so upgrading does not require another client rewrite.

Initial providers:

1. Email/password
2. Google Sign-In
3. Apple Sign-In before App Store release if Google remains a primary sign-in option

## Migration phases

### Phase 0 — Foundation

- [x] Create a dedicated migration branch.
- [x] Inventory the current native Supabase auth integration.
- [x] Keep the existing Supabase path operational while migration work is isolated.
- [ ] Create the MSH Google Cloud/Firebase project.
- [ ] Register iOS bundle ID `org.mysimplehealth.app`.
- [ ] Add the real `GoogleService-Info.plist` locally and keep secrets/configuration handling explicit.
- [ ] Enable Email/Password and Google providers.
- [ ] Decide whether to enable Identity Platform immediately or after Firebase Auth is validated.

### Phase 1 — Identity cutover

- [ ] Add Firebase Auth and Google Sign-In Swift packages with pinned/controlled dependency versions.
- [ ] Introduce an MSH-owned authentication boundary so UI code does not depend on Firebase or Supabase session types.
- [ ] Implement Firebase email/password account creation and sign-in.
- [ ] Implement Google Sign-In through Firebase.
- [ ] Implement sign-out and auth-state restoration.
- [ ] Map Firebase UID to MSH account identity.
- [ ] Add unit tests around auth-state transitions.
- [ ] Validate Debug and Release builds.
- [ ] Validate real-device callback/sign-in behavior.

### Phase 2 — API boundary

- [ ] Create an authenticated Cloud Run API.
- [ ] Verify Firebase/Identity Platform ID tokens server-side.
- [ ] Move privileged business logic behind the API.
- [ ] Stop allowing clients to depend directly on database authorization rules for core workflows.
- [ ] Add Secret Manager, structured logging, monitoring, and least-privilege IAM.

### Phase 3 — Data migration

- [ ] Export the Supabase PostgreSQL schema and data once the source database is healthy enough to read.
- [ ] Inventory tables, RLS policies, triggers, functions, views, storage references, and auth-linked foreign keys.
- [ ] Design Cloud SQL PostgreSQL ownership/authorization around Firebase UID rather than `auth.uid()`.
- [ ] Translate RLS-dependent behavior into API authorization and/or explicit PostgreSQL policies where appropriate.
- [ ] Migrate data into Cloud SQL.
- [ ] Run row counts, constraints, referential-integrity checks, and application-level parity checks.
- [ ] Run a controlled dual-read/validation period before final cutover if production data exists.

### Phase 4 — Supabase retirement

- [ ] Remove Supabase client dependencies from iOS and web.
- [ ] Remove obsolete Supabase environment variables and redirect URLs.
- [ ] Archive migration history and final database export.
- [ ] Disable Supabase only after production verification and rollback requirements are satisfied.

## Cutover rules

1. Do not delete or disable Supabase merely because Firebase begins working.
2. Every phase must have a working rollback path until the following phase is verified.
3. Do not place Google service-account credentials in the iOS app, web client, GitHub repository, or public Vercel environment variables.
4. Client applications receive only client-safe Firebase configuration. Privileged credentials belong in managed server-side secrets.
5. Health and sharing authorization must be enforced server-side, not inferred from client-editable profile metadata.
6. Preserve stable MSH user/account IDs where possible so moving identity providers does not break historical health records.

## Current blocker

The connected Supabase project is reporting `COMING_UP` and PostgreSQL connections have timed out. This blocks a reliable schema/data export today, but it does not block starting the identity migration because the native auth boundary can be changed independently.

## Definition of identity migration complete

Identity migration is complete only when all of the following pass:

- fresh email/password signup
- existing-account sign-in strategy tested
- Google sign-in
- sign-out
- app restart with session restoration
- expired-token refresh behavior
- revoked/disabled account behavior
- correct account identity presented to downstream MSH services
- Debug build
- Release build
- real-device test
- no Supabase Auth dependency remains in the active identity path

Only then should MSH begin removing Supabase Auth from production.