const PLAID_ENVIRONMENTS = {
  sandbox: 'https://sandbox.plaid.com',
  production: 'https://production.plaid.com',
};

function send(res, status, payload) { res.status(status).json(payload); }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'method_not_allowed' });
  }

  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const baseURL = PLAID_ENVIRONMENTS[process.env.PLAID_ENV || 'sandbox'];
  const publicToken = typeof req.body?.publicToken === 'string' ? req.body.publicToken.trim() : '';

  if (!clientId || !secret || !baseURL) return send(res, 503, { error: 'plaid_not_configured' });
  if (!publicToken) return send(res, 400, { error: 'missing_public_token' });

  try {
    const response = await fetch(`${baseURL}/item/public_token/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, secret, public_token: publicToken }),
    });
    const payload = await response.json();
    if (!response.ok) return send(res, response.status, { error: 'plaid_token_exchange_failed', plaid: payload });

    // Never return the Plaid access token to the iOS client. The durable version of
    // this endpoint stores it against the authenticated MSH user in server-side storage.
    // Until that authenticated store is wired, refuse to pretend the connection is persisted.
    return send(res, 501, {
      error: 'server_side_item_storage_required',
      item_id: payload.item_id,
      message: 'Plaid exchange succeeded, but MSH must persist the access token server-side before this connection can be enabled.',
    });
  } catch (error) {
    return send(res, 502, { error: 'plaid_unavailable' });
  }
}
