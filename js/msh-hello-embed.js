/* My Simple Health — embedded mode for the existing Hello runtime */
(function (root) {
  'use strict';
  if (!root.document || new URLSearchParams(root.location.search).get('embedded') !== '1') return;

  const SCROLL_KEY = 'msh_hello_conversation_scroll';
  const LONG_PRESS_MS = 560;
  const MAX_EDIT_AUDIT = 40;
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

  function uid(prefix) {
    if (root.crypto && root.crypto.randomUUID) return `${prefix}_${root.crypto.randomUUID()}`;
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function installStyles() {
    if (root.document.getElementById('msh-simple-edit-styles')) return;
    const style = root.document.createElement('style');
    style.id = 'msh-simple-edit-styles';
    style.textContent = `
      .hello-message-row.user .hello-bubble.user[data-msh-editable="true"] { cursor:default; position:relative; }
      .msh-simple-edited-label { display:inline-block; margin-top:6px; font-size:10px; line-height:1; letter-spacing:.35px; opacity:.7; }
      .msh-simple-edit-shell { width:min(72vw,430px); display:flex; flex-direction:column; gap:10px; }
      .msh-simple-edit-input { width:100%; min-height:86px; max-height:180px; resize:vertical; box-sizing:border-box; border:1px solid rgba(255,255,255,.58); border-radius:14px; padding:12px 13px; background:rgba(255,255,255,.98); color:#263127; font:inherit; line-height:1.45; outline:none; }
      .msh-simple-edit-input:focus { box-shadow:0 0 0 3px rgba(255,255,255,.22); }
      .msh-simple-edit-actions { display:flex; justify-content:flex-end; gap:8px; }
      .msh-simple-edit-action { min-height:38px; padding:0 14px; border-radius:999px; border:1px solid rgba(255,255,255,.6); font-size:12px; font-weight:750; cursor:pointer; }
      .msh-simple-edit-action.cancel { background:transparent; color:#fff; }
      .msh-simple-edit-action.save { background:#fff; color:#07543d; }
      .msh-simple-edit-hint { margin-top:5px; font-size:10px; line-height:1.25; opacity:.62; }
    `;
    (root.document.head || root.document.documentElement).appendChild(style);
  }

  function rawConversation(state) {
    const memory = state && state.settings && state.settings.memory;
    return memory && Array.isArray(memory.helloConversation) ? memory.helloConversation : [];
  }

  function preserveTurnMetadataOnAppend() {
    if (!root.MSHStorage || !root.MSHStorage.updateState || root.MSHStorage.__mshEditableAppendInstalled) return;
    const limit = Number(root.MSHStorage.HELLO_HISTORY_LIMIT) || 12;
    root.MSHStorage.appendHelloTurn = function(role, content, assistantRole) {
      if (!['user','assistant'].includes(role) || typeof content !== 'string' || !content.trim()) return root.MSHStorage.getHelloConversation ? root.MSHStorage.getHelloConversation() : [];
      root.MSHStorage.updateState(function(state) {
        const memory = state.settings.memory;
        const history = rawConversation(state).filter(function(turn) { return turn && ['user','assistant'].includes(turn.role) && typeof turn.content === 'string' && turn.content.trim(); });
        const createdAt = new Date().toISOString();
        const turn = { id:uid('helloTurn'), role:role, content:content.trim().slice(0,1500), createdAt:createdAt };
        if (role === 'assistant') turn.assistantRole = assistantRole === 'PAL' ? 'PAL' : 'HELLO';
        history.push(turn);
        memory.helloConversation = history.slice(-limit);
        return state;
      });
      return root.MSHStorage.getHelloConversation ? root.MSHStorage.getHelloConversation() : [];
    };
    root.MSHStorage.__mshEditableAppendInstalled = true;
  }

  function editStoredUserTurn(userIndex, newContent) {
    if (!root.MSHStorage || !root.MSHStorage.updateState) return null;
    let result = null;
    root.MSHStorage.updateState(function(state) {
      const memory = state.settings.memory;
      const history = rawConversation(state);
      const userTurns = history.map(function(turn,index) { return { turn:turn, index:index }; }).filter(function(item) { return item.turn && item.turn.role === 'user'; });
      const selected = userTurns[userIndex];
      if (!selected) return state;
      const next = String(newContent || '').trim().slice(0,1500);
      if (!next) return state;
      const turn = selected.turn;
      const previous = String(turn.content || '').trim();
      if (previous === next) { result = { content:next, edited:Boolean(turn.editedAt), changed:false }; return state; }
      const editedAt = new Date().toISOString();
      turn.id = turn.id || uid('helloTurn');
      turn.content = next;
      turn.editedAt = editedAt;
      turn.editCount = (Number(turn.editCount) || 0) + 1;
      const audit = Array.isArray(memory.helloConversationEdits) ? memory.helloConversationEdits : [];
      audit.push({ id:uid('helloEdit'), turnId:turn.id, role:'user', previousContent:previous.slice(0,1500), replacementContent:next, editedAt:editedAt, editNumber:turn.editCount });
      memory.helloConversationEdits = audit.slice(-MAX_EDIT_AUDIT);
      result = { content:next, edited:true, changed:true, turnId:turn.id };
      return state;
    });
    return result;
  }

  function currentRawUserTurns() {
    if (!root.MSHStorage || !root.MSHStorage.getState) return [];
    return rawConversation(root.MSHStorage.getState()).filter(function(turn) { return turn && turn.role === 'user'; });
  }

  function userRowIndex(row) { return Array.from(chat.querySelectorAll('.hello-message-row.user')).indexOf(row); }

  function visibleTextElement(bubble) {
    return Array.from(bubble.children).find(function(child) {
      return !child.classList.contains('msh-simple-edited-label') && !child.classList.contains('msh-simple-edit-hint') && !child.classList.contains('msh-simple-edit-shell');
    }) || bubble.firstElementChild;
  }

  function applyEditedState(bubble, edited) {
    let label = bubble.querySelector('.msh-simple-edited-label');
    if (edited && !label) {
      label = root.document.createElement('span');
      label.className = 'msh-simple-edited-label';
      label.textContent = 'Edited';
      bubble.appendChild(label);
    } else if (!edited && label) label.remove();
  }

  function beginEditing(row, bubble) {
    if (bubble.dataset.mshEditing === 'true') return;
    const index = userRowIndex(row);
    if (index < 0) return;
    const stored = currentRawUserTurns()[index];
    const textElement = visibleTextElement(bubble);
    const existingText = stored && typeof stored.content === 'string' ? stored.content : (textElement ? textElement.textContent : '').trim();
    if (!existingText) return;
    bubble.dataset.mshEditing = 'true';
    const oldChildren = Array.from(bubble.childNodes);
    bubble.innerHTML = '';
    const shell = root.document.createElement('div');
    shell.className = 'msh-simple-edit-shell';
    const editor = root.document.createElement('textarea');
    editor.className = 'msh-simple-edit-input';
    editor.value = existingText;
    editor.setAttribute('aria-label','Edit your message');
    const actions = root.document.createElement('div');
    actions.className = 'msh-simple-edit-actions';
    const cancel = root.document.createElement('button');
    cancel.type = 'button'; cancel.className = 'msh-simple-edit-action cancel'; cancel.textContent = 'Cancel';
    const save = root.document.createElement('button');
    save.type = 'button'; save.className = 'msh-simple-edit-action save'; save.textContent = 'Save';
    actions.append(cancel,save); shell.append(editor,actions); bubble.appendChild(shell);
    function restoreOriginal() { bubble.innerHTML = ''; oldChildren.forEach(function(node) { bubble.appendChild(node); }); bubble.dataset.mshEditing = 'false'; }
    cancel.addEventListener('click',function(event) { event.stopPropagation(); restoreOriginal(); });
    save.addEventListener('click',function(event) {
      event.stopPropagation();
      const next = editor.value.trim();
      if (!next) { editor.focus(); return; }
      const outcome = editStoredUserTurn(index,next);
      bubble.innerHTML = '';
      const text = root.document.createElement('div'); text.textContent = outcome && outcome.content ? outcome.content : next; bubble.appendChild(text);
      applyEditedState(bubble,Boolean(outcome && outcome.edited));
      const hint = root.document.createElement('div'); hint.className = 'msh-simple-edit-hint'; hint.textContent = 'Updated for this conversation'; bubble.appendChild(hint);
      root.setTimeout(function() { hint.remove(); },2200);
      bubble.dataset.mshEditing = 'false'; bubble.dataset.mshEditable = 'true'; chat.scrollTop = chat.scrollHeight;
    });
    editor.addEventListener('keydown',function(event) {
      if (event.key === 'Escape') { event.preventDefault(); cancel.click(); }
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); save.click(); }
    });
    root.requestAnimationFrame(function() { editor.focus(); editor.setSelectionRange(editor.value.length,editor.value.length); });
  }

  function makeEditable(row,index) {
    if (!row || row.dataset.mshEditBound === 'true') return;
    const bubble = row.querySelector('.hello-bubble.user');
    if (!bubble) return;
    row.dataset.mshEditBound = 'true'; bubble.dataset.mshEditable = 'true'; bubble.setAttribute('aria-label','Your message. Touch and hold to edit.');
    const rawTurns = currentRawUserTurns(); applyEditedState(bubble,Boolean(rawTurns[index] && rawTurns[index].editedAt));
    let timer = null, startX = 0, startY = 0;
    function clearTimer() { if (timer) { root.clearTimeout(timer); timer = null; } }
    bubble.addEventListener('pointerdown',function(event) { if (bubble.dataset.mshEditing === 'true') return; startX=event.clientX; startY=event.clientY; clearTimer(); timer=root.setTimeout(function(){ timer=null; beginEditing(row,bubble); },LONG_PRESS_MS); });
    bubble.addEventListener('pointermove',function(event) { if (Math.abs(event.clientX-startX)>9 || Math.abs(event.clientY-startY)>9) clearTimer(); });
    bubble.addEventListener('pointerup',clearTimer); bubble.addEventListener('pointercancel',clearTimer); bubble.addEventListener('pointerleave',clearTimer);
    bubble.addEventListener('contextmenu',function(event) { if (bubble.dataset.mshEditing === 'true') return; event.preventDefault(); clearTimer(); beginEditing(row,bubble); });
  }

  function bindEditableRows() { Array.from(chat.querySelectorAll('.hello-message-row.user')).forEach(function(row,index) { makeEditable(row,index); }); }

  installStyles(); preserveTurnMetadataOnAppend();
  const observer = new MutationObserver(function() { bindEditableRows(); }); observer.observe(chat,{childList:true,subtree:true}); bindEditableRows();
  chat.addEventListener('scroll',rememberScroll,{passive:true}); root.addEventListener('pagehide',rememberScroll);
  if (input) input.addEventListener('focus',() => root.parent.postMessage({type:'msh:hello-input-focus'},root.location.origin));
  const initialScroll = savedScroll();
  const restore = () => { if (initialScroll) chat.scrollTop = Math.min(initialScroll,chat.scrollHeight); };
  root.requestAnimationFrame(restore); root.setTimeout(restore,120);
})(typeof window !== 'undefined' ? window : globalThis);
