# MSH Plaid connection contract

Plaid is a user-owned financial connection for My Simple Health. Each adult connects their own institutions. Household membership never grants access to another person's Plaid data; sharing is a separate MSH permission layer.

## Backend owner

Firebase / Google Cloud is the permanent MSH integration boundary for Plaid.

- Firebase Auth identifies the person making the request.
- Firebase Cloud Functions performs Plaid server calls.
- Google Secret Manager stores `PLAID_CLIENT_ID` and `PLAID_SECRET`.
- Firestore stores private server Item state plus owner-scoped sanitized connection, account, and transaction records.
- Vercel does not own Plaid secrets or Plaid server endpoints.
- The iOS app never receives a Plaid `access_token` or Plaid developer secret.

The Firebase project is `my-simple-health-2fd8b`.

## Initial products

- Transactions
- Recurring Transactions when product access is enabled
- Transactions Refresh when product access is enabled
- Balance/account data returned with supported products
- Investments and Liabilities after the core connection is stable

## Secret boundary

Google Secret Manager contains:

- `PLAID_CLIENT_ID`
- `PLAID_SECRET`

Non-secret configuration:

- `PLAID_ENV` defaults to `production` for the current Plaid Trial.
- Plaid OAuth redirect: `https://mysimplehealth.org/plaid/`
- Plaid webhook: `https://us-central1-my-simple-health-2fd8b.cloudfunctions.net/plaidWebhook`

Plaid developer secrets and Item `access_token` values must never be committed to Git, embedded in the iOS bundle, logged to clients, or returned from a Cloud Function response.

## Firestore ownership boundary

Private server collection:

- `mshServerPlaidItems/{ownerUid}_{itemId}` contains the Plaid Item access token, owner UID, Item ID, sync cursor, and sync state.
- Firestore client rules explicitly deny all reads and writes to this collection.

Owner-readable sanitized collections:

- `users/{uid}/plaidConnections/{itemId}`
- `users/{uid}/plaidAccounts/{accountId}`
- `users/{uid}/plaidTransactions/{transactionId}`

Clients may read these only when `request.auth.uid == uid`. Client writes are denied; Cloud Functions/Admin SDK owns writes. Household sharing remains a separate explicit MSH permission layer.

## Firebase Functions

`createPlaidLinkToken`

1. Requires Firebase Authentication.
2. Uses the authenticated Firebase UID as Plaid `client_user_id`.
3. Reads Plaid developer credentials from Secret Manager.
4. Creates a short-lived Link token for Transactions with the MSH OAuth redirect and webhook URL.
5. Returns only the Link token and expiration to the app.

`exchangePlaidPublicToken`

1. Requires Firebase Authentication.
2. Accepts the temporary Plaid `public_token` returned by LinkKit.
3. Exchanges it server-side for an Item access token and Item ID.
4. Stores private Item state against the authenticated Firebase UID.
5. Creates the owner-readable connection summary.
6. Starts the initial `/transactions/sync`.
7. Never returns the Item access token to iOS.

`syncPlaidItem`

- Requires Firebase Authentication and verifies Item ownership.
- Uses `/transactions/sync` with a persisted per-Item cursor.
- Applies added, modified, and removed transactions.
- Refreshes account metadata/balances returned by Plaid.
- Updates connection sync state without allowing client writes.

`disconnectPlaidItem`

- Requires Firebase Authentication and verifies Item ownership.
- Calls Plaid `/item/remove` first.
- Removes private server Item state and the owner's Plaid-derived account/transaction records for that Item.

`plaidWebhook`

- Accepts POST only.
- Verifies the `Plaid-Verification` ES256 JWT with Plaid's verification key.
- Rejects stale signatures and request-body hash mismatches.
- Handles `TRANSACTIONS / SYNC_UPDATES_AVAILABLE` by running incremental sync for the matching Item.

## Native iOS boundary

The iOS project includes:

- Firebase Functions client SDK.
- Plaid LinkKit 7 through Swift Package Manager.
- `MSHPlaidConnectionController` for authenticated callable Functions, Link session creation, exchange, sync, and disconnect.
- `MSHPlaidConnectionScreen` as the native Financial Connections surface.
- `applinks:mysimplehealth.org` Associated Domain entitlement.
- `.well-known/apple-app-site-association` for `/plaid/*`.
- A non-sensitive `/plaid/` web fallback when Universal Link handoff does not occur.

## Connection flow

1. Authenticated MSH user taps Connect financial account.
2. iOS calls `createPlaidLinkToken`.
3. Native LinkKit presents Plaid Link.
4. Link returns a temporary `public_token`.
5. iOS calls `exchangePlaidPublicToken`.
6. Firebase persists the Item against the authenticated user and performs the initial transaction sync.
7. Plaid webhooks trigger later incremental syncs.
8. MSH can read the person's sanitized Plaid data and later map it into canonical Account / Transaction / Integration domain objects with provider provenance.
9. Household sharing is evaluated only after individual ownership is established and never exposes another person's underlying Plaid token.

## Remaining before public-user connections

- Deploy Firestore rules and Firebase Functions to `my-simple-health-2fd8b`.
- Confirm the deployed Functions service account can access `PLAID_CLIENT_ID` and `PLAID_SECRET`.
- Register `https://mysimplehealth.org/plaid/` as an allowed Plaid redirect URI.
- Deploy the AASA file and verify it is served directly over HTTPS without redirect.
- Enable Associated Domains for the production Apple App ID/provisioning profile if it is not already enabled.
- Wire `MSHPlaidConnectionScreen` into the stable Me > Connections / Financial Health navigation seam after current branch reconciliation.
- Add recurring transaction, investment, and liability product adapters after core Transactions is verified.
- Test Sandbox and Trial behavior for added, modified, removed, pending-to-posted, reconnect/update mode, disconnect, webhooks, OAuth institutions, and multiple Firebase users.

The connection always belongs to the authenticated individual. Sharing belongs to the relationship, not to the provider connection.
