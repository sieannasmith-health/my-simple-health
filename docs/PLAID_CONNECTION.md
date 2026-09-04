# MSH Plaid connection contract

Plaid is a user-owned financial connection for My Simple Health. Each adult connects their own institutions. Household membership never grants access to another person's Plaid data; sharing is a separate MSH permission layer.

## Initial products

- Transactions
- Recurring Transactions when product access is enabled
- Transactions Refresh when product access is enabled
- Balance/account data returned with supported products
- Investments and Liabilities are later product additions after the core connection is stable

## Security boundary

`PLAID_SECRET` and Plaid Item `access_token` values are server-side secrets. They must never be committed to Git, embedded in the iOS bundle, logged to clients, or returned from an API response.

Expected server environment variables:

- `PLAID_CLIENT_ID`
- `PLAID_SECRET`
- `PLAID_ENV` (`sandbox` or `production`)
- `PLAID_REDIRECT_URI` for OAuth institutions
- `PLAID_WEBHOOK_URL` for transaction update webhooks

## Connection flow

1. Authenticated MSH user taps Connect financial account.
2. MSH server creates a short-lived Plaid `link_token` for that MSH user.
3. Native iOS LinkKit presents Plaid Link.
4. Link returns a temporary `public_token`.
5. iOS sends that temporary token to MSH server.
6. MSH server exchanges it for an Item `access_token` and `item_id`.
7. Server stores the access token encrypted and associated only with the authenticated MSH person/integration record.
8. Server syncs transactions with `/transactions/sync`, retaining the per-Item cursor and applying added, modified, and removed changes.
9. Webhooks trigger later incremental syncs. Manual Refresh may use `/transactions/refresh` when the add-on is enabled.
10. Plaid data maps into canonical MSH Account / Transaction / Integration records with provider provenance.

## Required before enabling real connections

- Authenticated server-side integration store
- Encrypted Plaid access-token storage
- User/integration ownership enforcement
- Disconnect and deletion behavior
- Webhook verification and sync cursor persistence
- OAuth redirect + Universal Link configuration for iOS
- Native LinkKit integration
- Sandbox tests for added, modified, removed, pending-to-posted, reconnect/update mode, and multiple users

The token-exchange endpoint intentionally does not return an access token to the client and remains disabled until durable authenticated server-side storage is present.
