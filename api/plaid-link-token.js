const PLAID_ENVIRONMENTS = {
  sandbox: 'https://sandbox.plaid.com',
  production: 'https://production.plaid.com',
};

function send(res, status, payload) {
  res.status(status).json(payload);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'method_not_allowed' });
  }

  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const environment = process.env.PLAID_ENV || 'sandbox';
  const baseURL = PLAID_ENVIRONMENTS[environment];

  if (!clientId || !secret || !baseURL) {
    return send(res, 503, { error: 'plaid_not_configured' });
  }

  const userId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : '';
  if (!userId) {
    return send(res, 400, { error: 'missing_user_id' });
  }

  const body = {
    client_id: clientId,
    secret,
    client_name: 'My Simple Health',
    language: 'en',
    country_codes: ['US'],
    products: ['transactions'],
    transactions: { days_requested: 730 },
    user: { client_user_id: userId },
  };

  if (process.env.PLAID_REDIRECT_URI) body.redirect_uri = process.env.PLAID_REDIRECT_URI;
  if (process.env.PLAID_WEBHOOK_URL) body.webhook = process.env.PLAID_WEBHOOK_URL;

  try {
    const response = await fetch(`${baseURL}/link/token/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) return send(res, response.status, { error: 'plaid_link_token_failed', plaid: payload });
    return send(res, 200, { link_token: payload.link_token, expiration: payload.expiration });
  } catch (error) {
    return send(res, 502, { error: 'plaid_unavailable' });
  }
}
