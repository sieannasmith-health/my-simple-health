/* My Simple Health — YouTube workout source (preview-safe v1) */
(function (root) {
  'use strict';

  const clean = (value, length = 500) => String(value == null ? '' : value).trim().slice(0, length);

  function videoId(value) {
    const raw = clean(value, 1000);
    if (!raw) return '';
    try {
      const url = new URL(raw);
      const host = url.hostname.replace(/^www\./, '').toLowerCase();
      if (host === 'youtu.be') return clean(url.pathname.split('/').filter(Boolean)[0], 20);
      if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
        if (url.pathname === '/watch') return clean(url.searchParams.get('v'), 20);
        const match = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/);
        return match ? clean(match[1], 20) : '';
      }
    } catch (_) {}
    return '';
  }

  function canonicalUrl(id) {
    return id ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` : '';
  }

  function preview(value) {
    const id = videoId(value);
    if (!id) return null;
    return {
      provider: 'youtube',
      videoId: id,
      url: canonicalUrl(id),
      title: 'YouTube workout',
      creator: 'Creator available when YouTube API is connected',
      durationMinutes: null,
      metadataStatus: 'preview'
    };
  }

  function plan(input = {}) {
    if (!root.MSHMovement) return null;
    const source = preview(input.url);
    if (!source) return null;
    const event = root.MSHMovement.plan({
      date: input.date,
      time: input.time,
      movementType: input.movementType || 'other',
      movementLabel: clean(input.title || source.title, 160),
      durationMinutes: input.durationMinutes || '',
      notes: clean(input.notes, 500)
    });
    if (!event || !root.MSHStorage) return event;
    root.MSHStorage.updateState(state => {
      const saved = (state.calendar?.events || []).find(item => item.id === event.id);
      if (!saved) return state;
      saved.source = {
        type: 'EXTERNAL_MEDIA',
        channel: 'youtube',
        provider: 'youtube',
        videoId: source.videoId,
        url: source.url,
        metadataStatus: source.metadataStatus
      };
      saved.movement = { ...saved.movement, source: saved.source };
      saved.updatedAt = new Date().toISOString();
      return state;
    });
    return root.MSHMovement.getEvent(event.id);
  }

  root.MSHYouTubeWorkout = Object.freeze({ videoId, canonicalUrl, preview, plan });
})(typeof window !== 'undefined' ? window : globalThis);
