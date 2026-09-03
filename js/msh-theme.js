/* My Simple Health — shared Light / Dark / System theme runtime */
(function (root) {
  'use strict';

  const STORAGE_KEY = 'msh_theme_preference';
  const OPTIONS = ['light', 'dark', 'system'];
  const CONTRAST_STYLESHEET = 'css/msh-surface-contrast.css?v=20260902-1';
  const media = typeof root.matchMedia === 'function'
    ? root.matchMedia('(prefers-color-scheme: dark)')
    : { matches: false };
  const listeners = new Set();

  function ensureContrastStylesheet() {
    const document = root.document;
    if (!document || document.querySelector('link[data-msh-surface-contrast]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CONTRAST_STYLESHEET;
    link.dataset.mshSurfaceContrast = '';
    (document.head || document.documentElement).appendChild(link);
  }

  function normalize(value) {
    return OPTIONS.includes(value) ? value : 'system';
  }

  function readPreference() {
    try { return normalize(root.localStorage.getItem(STORAGE_KEY)); }
    catch (_) { return 'system'; }
  }

  function resolvedTheme(preference) {
    return preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
  }

  function apply(preference, persist) {
    const nextPreference = normalize(preference);
    const resolved = resolvedTheme(nextPreference);
    const documentElement = root.document && root.document.documentElement;
    ensureContrastStylesheet();
    if (documentElement) {
      documentElement.dataset.themePreference = nextPreference;
      documentElement.dataset.theme = resolved;
      documentElement.style.colorScheme = resolved;
    }
    if (persist) {
      try { root.localStorage.setItem(STORAGE_KEY, nextPreference); } catch (_) {}
    }
    listeners.forEach(listener => listener({ preference: nextPreference, resolved }));
    return { preference: nextPreference, resolved };
  }

  function setPreference(preference) { return apply(preference, true); }
  function getPreference() {
    const documentElement = root.document && root.document.documentElement;
    return normalize(documentElement && documentElement.dataset.themePreference || readPreference());
  }
  function onChange(listener) {
    if (typeof listener !== 'function') return function () {};
    listeners.add(listener);
    return function () { listeners.delete(listener); };
  }
  function handleSystemChange() { if (getPreference() === 'system') apply('system', false); }

  if (typeof media.addEventListener === 'function') media.addEventListener('change', handleSystemChange);
  else if (typeof media.addListener === 'function') media.addListener(handleSystemChange);

  root.MSHTheme = { STORAGE_KEY, OPTIONS, getPreference, setPreference, onChange, apply };
  apply(readPreference(), false);

  /* Simple is embedded in the native iPhone shell. Give it the same ambient,
     lifestyle-first material language as My Health without changing chat behavior. */
  function tuneSimpleSurface() {
    if (!root.document || !/hello\.html$/i.test(root.location && root.location.pathname || '')) return;
    const d = root.document;
    d.title = 'Simple | My Simple Health';

    const style = d.createElement('style');
    style.dataset.mshSimpleAmbient = '';
    style.textContent = `
      html,body{background:#171714!important;color:#f7f4ed!important}
      .hello-page{min-height:100vh!important;padding:34px 20px 110px!important;color:#f7f4ed!important;background:
        radial-gradient(circle at 78% 8%,rgba(184,128,76,.28),transparent 34%),
        radial-gradient(circle at 12% 38%,rgba(74,94,70,.30),transparent 42%),
        radial-gradient(circle at 70% 72%,rgba(86,74,69,.28),transparent 38%),
        linear-gradient(155deg,#171815 0%,#24231e 48%,#171614 100%)!important}
      .hello-shell{width:min(94%,760px)!important}
      .hello-heading{text-align:left!important;margin:18px 0 34px!important}
      .hello-eyebrow{color:rgba(255,255,255,.72)!important;letter-spacing:2.5px!important}
      .hello-heading h1{font-family:Georgia,'Times New Roman',serif!important;color:#fff!important;font-size:clamp(48px,12vw,72px)!important;line-height:1.02!important}
      .hello-heading>p:last-child{margin:0!important;max-width:560px!important;color:rgba(255,255,255,.78)!important;font-size:17px!important;line-height:1.55!important}
      .hello-mode-switcher{display:none!important}
      .hello-context-bar,.hello-chat-wrap,.hello-note,.hello-evidence-card,.hello-visit-summary{background:rgba(35,35,31,.48)!important;border:1px solid rgba(255,255,255,.18)!important;box-shadow:0 18px 55px rgba(0,0,0,.18)!important;backdrop-filter:blur(24px) saturate(125%)!important;-webkit-backdrop-filter:blur(24px) saturate(125%)!important}
      .hello-chat-wrap{border-radius:30px!important;overflow:hidden!important}
      .hello-chat-thread{min-height:390px!important;padding:24px 20px!important}
      .hello-bubble{max-width:86%!important;border:1px solid rgba(255,255,255,.10)!important;color:#f8f5ef!important}
      .hello-bubble.assistant{background:rgba(255,255,255,.08)!important}
      .hello-bubble.user{background:rgba(255,255,255,.18)!important}
      .hello-label{color:rgba(255,255,255,.58)!important}
      .hello-input-wrap{background:rgba(16,16,14,.28)!important;border-top:1px solid rgba(255,255,255,.14)!important}
      #helloInput{background:rgba(255,255,255,.08)!important;border:1px solid rgba(255,255,255,.18)!important;color:#fff!important}
      #helloInput::placeholder{color:rgba(255,255,255,.54)!important}
      .hello-send-btn{background:rgba(248,245,238,.92)!important;color:#20201d!important}
      .hello-routing-badge{display:none!important}
      .hello-actions,.hello-note{display:none!important}
      .hello-care-option,.hello-visit-btn,.hello-secondary-btn{background:rgba(255,255,255,.07)!important;color:#fff!important;border-color:rgba(255,255,255,.22)!important}
      @media(max-width:560px){.hello-page{padding-top:28px!important}.hello-heading{margin-bottom:28px!important}.hello-chat-thread{min-height:360px!important}.hello-input-wrap{padding:10px!important}.hello-send-btn{min-width:58px!important;padding:0 14px!important}}
    `;
    d.head.appendChild(style);

    const rewrite = function () {
      const eyebrow = d.querySelector('.hello-eyebrow');
      if (eyebrow) eyebrow.textContent = 'SIMPLE';
      const h1 = d.querySelector('.hello-heading h1');
      if (h1) h1.textContent = "What’s on your mind?";
      const lede = d.querySelector('.hello-heading > p:last-child');
      if (lede) lede.textContent = 'Make sense of something, think it through, or explore what you’re noticing.';
      const input = d.getElementById('helloInput');
      if (input) input.placeholder = 'Ask Simple anything…';

      d.querySelectorAll('.hello-bubble,.hello-chat-thread p').forEach(function (node) {
        const text = (node.textContent || '').trim();
        if (/prototype will classify/i.test(text) || /Ask me a general health or wellness question/i.test(text)) {
          node.textContent = 'I’m here. We can make sense of something, think through a decision, or simply start with what you’re noticing.';
        } else if (/Try something like:/i.test(text)) {
          node.textContent = 'You can start anywhere. What changed this week? How has sleep been feeling? What deserves your attention right now?';
        }
      });
    };
    rewrite();
    root.setTimeout(rewrite, 250);
  }

  if (root.document && root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', tuneSimpleSurface, { once: true });
  else tuneSimpleSurface();
})(typeof window !== 'undefined' ? window : globalThis);
