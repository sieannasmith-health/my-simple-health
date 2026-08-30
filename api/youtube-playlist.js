const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';
const PLAYLIST_FEED = 'https://www.youtube.com/feeds/videos.xml?playlist_id=';

function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.end(JSON.stringify(body));
}

function playlistIdFrom(value) {
  const raw = String(value || '').trim();
  if (/^[A-Za-z0-9_-]{10,}$/.test(raw) && !raw.includes('http')) return raw;
  try {
    const url = new URL(raw);
    return url.searchParams.get('list') || '';
  } catch (_) {
    return '';
  }
}

function decodeXml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function parseIsoDuration(value) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(value || ''));
  if (!match) return null;
  const seconds = Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
  return seconds ? Math.max(1, Math.round(seconds / 60)) : null;
}

function inferDuration(title) {
  const text = String(title || '');
  const match = text.match(/\b(\d{1,3})\s*(?:min(?:ute)?s?|mins?)\b/i);
  return match ? Number(match[1]) : null;
}

function inferFocus(title) {
  const text = String(title || '').toLowerCase();
  const tags = [];
  const rules = [
    ['full_body', /full[ -]?body|total[ -]?body/], ['upper_body', /upper[ -]?body|arms?|shoulders?|chest|back workout/],
    ['lower_body', /lower[ -]?body|legs?|quads?|hamstrings?/], ['glutes', /glutes?|booty/], ['core', /\bcore\b|\babs?\b/],
    ['cardio', /cardio|hiit|aerobic|dance cardio/], ['mobility', /mobility|stretch|recovery|yoga/]
  ];
  rules.forEach(([tag, pattern]) => { if (pattern.test(text)) tags.push(tag); });
  return tags.length ? tags : ['other'];
}

async function fetchWithApiKey(playlistId, key) {
  const videos = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({ part: 'snippet,contentDetails', playlistId, maxResults: '50', key });
    if (pageToken) params.set('pageToken', pageToken);
    const response = await fetch(`${YOUTUBE_API}/playlistItems?${params}`);
    if (!response.ok) throw new Error('YouTube playlist request failed.');
    const data = await response.json();
    videos.push(...(data.items || []).map(item => ({
      videoId: item.contentDetails?.videoId || item.snippet?.resourceId?.videoId || '',
      title: item.snippet?.title || 'Workout',
      position: item.snippet?.position ?? videos.length,
      thumbnailUrl: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.high?.url || '',
      publishedAt: item.snippet?.publishedAt || ''
    })).filter(item => item.videoId));
    pageToken = data.nextPageToken || '';
  } while (pageToken && videos.length < 500);

  const durationById = {};
  for (let index = 0; index < videos.length; index += 50) {
    const ids = videos.slice(index, index + 50).map(item => item.videoId);
    const params = new URLSearchParams({ part: 'contentDetails', id: ids.join(','), key });
    const response = await fetch(`${YOUTUBE_API}/videos?${params}`);
    if (!response.ok) continue;
    const data = await response.json();
    (data.items || []).forEach(item => { durationById[item.id] = parseIsoDuration(item.contentDetails?.duration); });
  }

  return videos.map(item => ({
    ...item,
    durationMinutes: durationById[item.videoId] || inferDuration(item.title),
    focusTags: inferFocus(item.title),
    youtubeUrl: `https://www.youtube.com/watch?v=${item.videoId}`,
    thumbnailUrl: item.thumbnailUrl || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`
  }));
}

async function fetchWithFeed(playlistId) {
  const response = await fetch(`${PLAYLIST_FEED}${encodeURIComponent(playlistId)}`);
  if (!response.ok) throw new Error('The playlist could not be read. Make sure it is public or unlisted.');
  const xml = await response.text();
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  return entries.map((entry, position) => {
    const videoId = decodeXml((entry.match(/<yt:videoId>([\s\S]*?)<\/yt:videoId>/) || [])[1]);
    const title = decodeXml((entry.match(/<title>([\s\S]*?)<\/title>/) || [])[1]) || 'Workout';
    return {
      videoId, title, position,
      durationMinutes: inferDuration(title), focusTags: inferFocus(title),
      youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    };
  }).filter(item => item.videoId);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed.' });
  const playlistId = playlistIdFrom(req.query?.url || req.query?.playlistId);
  if (!playlistId) return send(res, 400, { error: 'Paste a valid YouTube playlist URL.' });
  try {
    const apiKey = process.env.YOUTUBE_API_KEY || '';
    const videos = apiKey ? await fetchWithApiKey(playlistId, apiKey) : await fetchWithFeed(playlistId);
    return send(res, 200, {
      playlistId,
      videos,
      source: apiKey ? 'youtube-data-api' : 'youtube-public-feed',
      limited: !apiKey,
      note: apiKey ? '' : 'Public-feed fallback may include only the most recent playlist videos. Add YOUTUBE_API_KEY for the complete playlist.'
    });
  } catch (error) {
    return send(res, 502, { error: error.message || 'YouTube playlist could not be loaded.' });
  }
}
