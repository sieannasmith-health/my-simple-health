/* My Simple Health — minimal Supabase Auth/REST client for explicitly shared data */
(function () {
  'use strict';

  const URL = 'https://dcweyvlimvkljlqkzhbs.supabase.co';
  const KEY = 'sb_publishable_eDu5tCF5ngIB1kPVVud-8w_grUSJhNa';
  const SESSION_KEY = 'msh_supabase_session_v1';

  function readSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (_) { return null; }
  }
  function writeSession(session) {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  }

  function captureRedirectSession() {
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    const accessToken = hash.get('access_token');
    if (!accessToken) return;
    const session = {
      access_token: accessToken,
      refresh_token: hash.get('refresh_token') || null,
      expires_at: Date.now() + (Number(hash.get('expires_in')) || 3600) * 1000,
      token_type: hash.get('token_type') || 'bearer'
    };
    writeSession(session);
    history.replaceState(null, '', location.pathname + location.search);
  }

  async function request(path, options = {}) {
    const session = readSession();
    const headers = new Headers(options.headers || {});
    headers.set('apikey', KEY);
    if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');
    if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
    return fetch(`${URL}${path}`, { ...options, headers });
  }

  async function sendMagicLink(email) {
    const clean = String(email || '').trim().toLowerCase();
    if (!clean) throw new Error('Enter an email address.');
    const response = await request('/auth/v1/otp', {
      method: 'POST',
      body: JSON.stringify({
        email: clean,
        create_user: true,
        options: { emailRedirectTo: location.origin + location.pathname }
      })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.msg || data.message || 'Could not send sign-in link.');
    }
  }

  async function user() {
    const session = readSession();
    if (!session?.access_token) return null;
    const response = await request('/auth/v1/user');
    if (!response.ok) {
      if (response.status === 401) writeSession(null);
      return null;
    }
    return response.json();
  }

  async function rest(table, { method = 'GET', query = '', body, prefer } = {}) {
    const response = await request(`/rest/v1/${table}${query ? `?${query}` : ''}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(prefer ? { Prefer: prefer } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    if (!response.ok) {
      const message = data?.message || data?.hint || `Shared data request failed (${response.status}).`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  captureRedirectSession();
  window.MSHSupabase = {
    url: URL,
    publishableKey: KEY,
    getSession: readSession,
    signOut: () => writeSession(null),
    sendMagicLink,
    user,
    rest
  };
})();