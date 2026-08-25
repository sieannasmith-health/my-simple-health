/* My Simple Health — embedded mode for the existing Hello runtime */
(function (root) {
  'use strict';
  if (!root.document || new URLSearchParams(root.location.search).get('embedded') !== '1') return;

  const SCROLL_KEY = 'msh_hello_conversation_scroll';
  const chat = root.document.getElementById('helloChat');
  const input = root.document.getElementById('helloInput');
  if (!chat) return;

  function savedScroll() {
    try { return Math.max(0, Number(root.sessionStorage.getItem(SCROLL_KEY)) || 0); }
    catch (_) { return 0; }
  }

  function rememberScroll() {
    try { root.sessionStorage.setItem(SCROLL_KEY, String(Math.round(chat.scrollTop))); }
    catch (_) {}
  }

  chat.addEventListener('scroll', rememberScroll, { passive:true });
  root.addEventListener('pagehide', rememberScroll);
  if (input) {
    input.addEventListener('focus', () => root.parent.postMessage({ type:'msh:hello-input-focus' }, root.location.origin));
  }

  const initialScroll = savedScroll();
  const restore = () => { if (initialScroll) chat.scrollTop = Math.min(initialScroll, chat.scrollHeight); };
  root.requestAnimationFrame(restore);
  root.setTimeout(restore, 120);
})(typeof window !== 'undefined' ? window : globalThis);
