export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.YOUTUBE_OAUTH_CLIENT_ID || '';
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    enabled: Boolean(clientId),
    clientId,
    scope: 'https://www.googleapis.com/auth/youtube.readonly'
  });
}
