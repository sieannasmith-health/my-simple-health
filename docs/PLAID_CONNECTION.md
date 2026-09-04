# MSH Plaid connection contract

Plaid is a user-owned financial connection for My Simple Health. Each adult connects their own institutions. Household membership never grants access to another person's Plaid data; sharing is a separate MSH permission layer.

## Backend owner

Firebase / Google Cloud is the permanent MSH integration boundary for Plaid.

- Firebase Auth identifies the person making the request.
- Firebase Cloud Functions performs Plaid server calls.
- Google Secret Manager stores `PLAID_CLIENT_ID` and `PLAID_SECRET`.
- Firestore stores server-owned Plaid Item state, ownership, sync cursors, and canonical financial records.
- Vercel does not own Plaid secrets or Plaid server endpoints.
- The iOS app never receives a Plaid `access_token` or Plaid secret.

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

Non-secret configuration may include:

- `PLAID_ENV` (`production` is the current default)
- `PLAID_REDIRECT_URI` for OAuth institutions
- `PLAID_WEBHOOK_URL` for transaction update webhooks

Plaid secrets and Item `access_token` values must never be committed to Git, embedded in the iOS bundle, logged to clients, or returned from a Cloud Function response.

## Firebase Functions

`createPlaidLinkToken`

1. Requires Firebase Authentication.
2. Uses the authenticated Firebase UID as Plaid `client_user_id`.
3. Reads Plaid developer credentials from Secret Manager.
4. Creates a short-lived Link token for Transactions.
5. Returns only the Link token and expiration to the app.

`exchangePlaidPublicToken`

1. Requires Firebase Authentication.
2. Accepts the temporary Plaid `public_token` returned by LinkKit.
3. Exchanges it server-side for an Item `access_token` and `item_id`.
4. Stores the Item against the authenticated Firebase UID in the server-owned `mshServerPlaidItems` collection.
5. Never returns the Item access token to iOS.

## Connection flow

1. Authenticated MSH user taps Connect financial account.
2. iOS calls `createPlaidLinkToken`.
3. Native LinkKit presents Plaid Link.
4. Link returns a temporary `public_token`.
5. iOS calls `exchangePlaidPublicToken` with that temporary token.
6. Firebase exchanges it with Plaid and persists the Item against the authenticated user.
7. Server syncs transactions with `/transactions/sync`, retaining the per-Item cursor and applying added, modified, and removed changes.
8. Webhooks trigger later incremental syncs. Manual Refresh may use `/transactions/refresh` when the add-on is enabled.
9. Plaid data maps into canonical MSH Account / Transaction / Integration records with provider provenance.
10. Household sharing is evaluated only after individual ownership is established and never exposes another person's underlying Plaid token.

## Required before public-user connections

- Verify deployed Firestore rules deny all client access to `mshServerPlaidItems`.
- Add `/transactions/sync` cursor persistence and canonical Account / Transaction mapping.
- Add disconnect and deletion behavior, including Plaid Item removal and local cleanup.
- Add webhook endpoint and transaction update handling.
- Configure Plaid OAuth redirect and iOS Universal Links.
- Add native LinkKit integration.
- Test Sandbox behavior for added, modified, removed, pending-to-posted, reconnect/update mode, and multiple Firebase users.
- Deploy Firebase Functions and verify Secret Manager access on the deployed service account.

The Firebase foundation is designed so a connection always belongs to the authenticated individual. Sharing belongs to the relationship, not to the provider connection.
