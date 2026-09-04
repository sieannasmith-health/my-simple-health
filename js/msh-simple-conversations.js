/* My Simple Health — Simple conversation workspace */
(function (root) {
  'use strict';

  const THREADS_KEY = 'msh_simple_threads_v1';
  const CURRENT_KEY = 'msh_simple_current_thread_v1';
  const MEMORIES_KEY = 'msh_simple_memories_v1';
  const MAX_CONTEXT_TURNS = 24;

  const now = () => new Date().toISOString();
  const uid = prefix => `${prefix}_${root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`}`;

  function readJSON(key, fallback) {
    try {
      const value = JSON.parse(root.localStorage.getItem(key));
      return value == null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    root.localStorage.setItem(key, JSON.stringify(value));
    return value;
  }

  function cleanTurn(turn) {
    if (!turn || !['user', 'assistant'].includes(turn.role)) return null;
    const content = String(turn.content || '').trim();
    if (!content) return null;
    return {
      id: turn.id || uid('turn'),
      role: turn.role,
      content: content.slice(0, 6000),
      assistantRole: turn.role === 'assistant' ? (turn.assistantRole === 'PAL' ? 'PAL' : 'HELLO') : undefined,
      createdAt: turn.createdAt || now()
    };
  }

  function cleanThread(thread) {
    if (!thread || typeof thread !== 'object') return null;
    const messages = Array.isArray(thread.messages) ? thread.messages.map(cleanTurn).filter(Boolean) : [];
    return {
      id: typeof thread.id === 'string' && thread.id ? thread.id : uid('thread'),
      title: String(thread.title || 'New conversation').trim().slice(0, 80) || 'New conversation',
      createdAt: thread.createdAt || now(),
      updatedAt: thread.updatedAt || thread.createdAt || now(),
      messages
    };
  }

  function loadThreads() {
    return (Array.isArray(readJSON(THREADS_KEY, [])) ? readJSON(THREADS_KEY, []) : [])
      .map(cleanThread)
      .filter(Boolean)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  function saveThreads(threads) {
    return writeJSON(THREADS_KEY, threads.map(cleanThread).filter(Boolean));
  }

  function createThread() {
    const thread = cleanThread({ id: uid('thread'), title: 'New conversation', createdAt: now(), updatedAt: now(), messages: [] });
    const threads = loadThreads();
    threads.unshift(thread);
    saveThreads(threads);
    root.localStorage.setItem(CURRENT_KEY, thread.id);
    return thread;
  }

  function currentThread() {
    const threads = loadThreads();
    const currentId = root.localStorage.getItem(CURRENT_KEY);
    let thread = threads.find(item => item.id === currentId);
    if (!thread) thread = threads[0];
    if (!thread) thread = createThread();
    root.localStorage.setItem(CURRENT_KEY, thread.id);
    return thread;
  }

  function updateThread(id, updater) {
    const threads = loadThreads();
    const index = threads.findIndex(item => item.id === id);
    if (index < 0) return null;
    const copy = cleanThread(threads[index]);
    const next = cleanThread((typeof updater === 'function' ? updater(copy) : copy) || copy);
    next.updatedAt = now();
    threads[index] = next;
    saveThreads(threads);
    return next;
  }

  function titleFromMessages(messages) {
    const firstUser = messages.find(message => message.role === 'user');
    if (!firstUser) return 'New conversation';
    const text = firstUser.content.replace(/\s+/g, ' ').trim();
    return text.length > 44 ? `${text.slice(0, 43)}…` : text;
  }

  function getConversation() {
    return currentThread().messages.slice(-MAX_CONTEXT_TURNS).map(turn => ({
      role: turn.role,
      content: turn.content,
      ...(turn.role === 'assistant' && turn.assistantRole ? { assistantRole: turn.assistantRole } : {})
    }));
  }

  function appendTurn(role, content, assistantRole) {
    const thread = currentThread();
    const clean = cleanTurn({ role, content, assistantRole, createdAt: now() });
    if (!clean) return getConversation();
    updateThread(thread.id, draft => {
      draft.messages.push(clean);
      draft.title = titleFromMessages(draft.messages);
      return draft;
    });
    renderSidebar();
    return getConversation();
  }

  function loadMemories() {
    const raw = readJSON(MEMORIES_KEY, []);
    return (Array.isArray(raw) ? raw : [])
      .filter(item => item && typeof item.text === 'string' && item.text.trim())
      .map(item => ({ id: item.id || uid('memory'), text: item.text.trim().slice(0, 1000), createdAt: item.createdAt || now() }));
  }

  function saveMemories(memories) {
    writeJSON(MEMORIES_KEY, memories);
    renderMemoryList();
    return memories;
  }

  function addMemory(text) {
    const value = String(text || '').trim();
    if (!value) return;
    const memories = loadMemories();
    memories.unshift({ id: uid('memory'), text: value.slice(0, 1000), createdAt: now() });
    saveMemories(memories);
  }

  function removeMemory(id) {
    saveMemories(loadMemories().filter(item => item.id !== id));
  }

  function clearChat() {
    const chat = root.document.getElementById('helloChat');
    if (chat) chat.innerHTML = '';
    if ('lastAssistantSender' in root) root.lastAssistantSender = null;
  }

  function renderThread(thread) {
    clearChat();
    thread.messages.forEach(turn => {
      if (typeof root.addMessage === 'function') root.addMessage(turn.content, turn.role === 'assistant' ? 'assistant' : 'user');
    });
    requestAnimationFrame(() => {
      const chat = root.document.getElementById('helloChat');
      if (chat) chat.scrollTop = chat.scrollHeight;
    });
    updateConversationTitle();
  }

  function switchThread(id) {
    const thread = loadThreads().find(item => item.id === id);
    if (!thread) return;
    root.localStorage.setItem(CURRENT_KEY, id);
    renderThread(thread);
    closePanel();
    renderSidebar();
  }

  function startNewConversation() {
    const thread = createThread();
    clearChat();
    if (typeof root.addMessage === 'function') {
      root.addMessage('What would be useful right now?', 'assistant');
    }
    updateConversationTitle();
    closePanel();
    renderSidebar();
    const input = root.document.getElementById('helloInput');
    if (input) setTimeout(() => input.focus(), 120);
  }

  function deleteThread(id) {
    let threads = loadThreads().filter(item => item.id !== id);
    saveThreads(threads);
    if (root.localStorage.getItem(CURRENT_KEY) === id) {
      if (threads.length) {
        root.localStorage.setItem(CURRENT_KEY, threads[0].id);
        renderThread(threads[0]);
      } else {
        const thread = createThread();
        renderThread(thread);
      }
    }
    renderSidebar();
  }

  function renameThread(id) {
    const thread = loadThreads().find(item => item.id === id);
    if (!thread) return;
    const next = root.prompt('Rename conversation', thread.title);
    if (next == null || !next.trim()) return;
    updateThread(id, draft => { draft.title = next.trim().slice(0, 80); return draft; });
    renderSidebar();
    updateConversationTitle();
  }

  function openPanel(mode) {
    const panel = root.document.getElementById('simpleSidePanel');
    const scrim = root.document.getElementById('simplePanelScrim');
    if (!panel || !scrim) return;
    panel.dataset.mode = mode || 'threads';
    panel.classList.add('open');
    scrim.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    if (mode === 'memory') renderMemoryList();
  }

  function closePanel() {
    const panel = root.document.getElementById('simpleSidePanel');
    const scrim = root.document.getElementById('simplePanelScrim');
    if (!panel || !scrim) return;
    panel.classList.remove('open');
    scrim.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  }

  function threadGroupLabel(dateValue) {
    const date = new Date(dateValue);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (sameDay(date, today)) return 'Today';
    if (sameDay(date, yesterday)) return 'Yesterday';
    return 'Earlier';
  }

  function renderSidebar() {
    const list = root.document.getElementById('simpleThreadList');
    if (!list) return;
    const threads = loadThreads();
    const currentId = root.localStorage.getItem(CURRENT_KEY);
    list.innerHTML = '';
    let priorGroup = '';
    threads.forEach(thread => {
      const group = threadGroupLabel(thread.updatedAt);
      if (group !== priorGroup) {
        const label = root.document.createElement('div');
        label.className = 'simple-panel-section-label';
        label.textContent = group;
        list.appendChild(label);
        priorGroup = group;
      }
      const row = root.document.createElement('div');
      row.className = `simple-thread-row${thread.id === currentId ? ' active' : ''}`;

      const button = root.document.createElement('button');
      button.type = 'button';
      button.className = 'simple-thread-open';
      button.textContent = thread.title;
      button.onclick = () => switchThread(thread.id);

      const menu = root.document.createElement('button');
      menu.type = 'button';
      menu.className = 'simple-thread-menu';
      menu.setAttribute('aria-label', `Conversation options for ${thread.title}`);
      menu.textContent = '•••';
      menu.onclick = event => {
        event.stopPropagation();
        const action = root.prompt('Type “rename” or “delete”');
        if (!action) return;
        if (action.toLowerCase() === 'rename') renameThread(thread.id);
        if (action.toLowerCase() === 'delete' && root.confirm('Delete this conversation?')) deleteThread(thread.id);
      };

      row.append(button, menu);
      list.appendChild(row);
    });
  }

  function renderMemoryList() {
    const list = root.document.getElementById('simpleMemoryList');
    if (!list) return;
    const memories = loadMemories();
    list.innerHTML = '';
    if (!memories.length) {
      const empty = root.document.createElement('p');
      empty.className = 'simple-memory-empty';
      empty.textContent = 'Nothing saved yet. You decide what Simple remembers across conversations.';
      list.appendChild(empty);
      return;
    }
    memories.forEach(memory => {
      const row = root.document.createElement('div');
      row.className = 'simple-memory-row';
      const text = root.document.createElement('p');
      text.textContent = memory.text;
      const remove = root.document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.onclick = () => removeMemory(memory.id);
      row.append(text, remove);
      list.appendChild(row);
    });
  }

  function updateConversationTitle() {
    const title = root.document.getElementById('simpleConversationTitle');
    if (title) title.textContent = currentThread().title === 'New conversation' ? 'Simple' : currentThread().title;
  }

  function installWorkspace() {
    if (!root.document.body || root.document.body.dataset.simpleWorkspaceInstalled) return;
    root.document.body.dataset.simpleWorkspaceInstalled = 'true';

    const page = root.document.querySelector('.hello-page');
    const shell = root.document.querySelector('.hello-shell');
    const heading = root.document.querySelector('.hello-heading');
    const modeSwitcher = root.document.querySelector('.hello-mode-switcher');
    const context = root.document.getElementById('helloContext');
    const chatWrap = root.document.querySelector('.hello-chat-wrap');
    const actions = root.document.querySelector('.hello-actions');
    const note = root.document.querySelector('.hello-note');
    const input = root.document.getElementById('helloInput');
    const send = root.document.querySelector('.hello-send-btn');
    if (!page || !shell || !chatWrap || !input || !send) return;

    if (heading) heading.hidden = true;
    if (modeSwitcher) modeSwitcher.hidden = true;
    if (context) context.hidden = true;
    if (actions) actions.hidden = true;
    if (note) note.hidden = true;

    const topbar = root.document.createElement('div');
    topbar.className = 'simple-conversation-topbar';
    topbar.innerHTML = `
      <button type="button" class="simple-menu-button" id="simpleMenuButton" aria-label="Open conversations">☰</button>
      <div class="simple-conversation-heading"><strong id="simpleConversationTitle">Simple</strong><span>Conversation</span></div>
      <button type="button" class="simple-new-button" id="simpleTopNewButton" aria-label="New conversation">＋</button>
    `;
    shell.insertBefore(topbar, chatWrap);

    const scrim = root.document.createElement('button');
    scrim.type = 'button';
    scrim.id = 'simplePanelScrim';
    scrim.className = 'simple-panel-scrim';
    scrim.setAttribute('aria-label', 'Close conversations');
    scrim.onclick = closePanel;
    root.document.body.appendChild(scrim);

    const panel = root.document.createElement('aside');
    panel.id = 'simpleSidePanel';
    panel.className = 'simple-side-panel';
    panel.dataset.mode = 'threads';
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = `
      <div class="simple-panel-header">
        <div><span>MY SIMPLE HEALTH</span><strong>Simple</strong></div>
        <button type="button" id="simplePanelClose" aria-label="Close panel">×</button>
      </div>
      <button type="button" class="simple-panel-new" id="simpleNewConversation">＋ New conversation</button>
      <div class="simple-panel-tabs" role="tablist">
        <button type="button" id="simpleThreadsTab" class="active">Conversations</button>
        <button type="button" id="simpleMemoryTab">Memory</button>
      </div>
      <div class="simple-panel-view simple-threads-view" id="simpleThreadsView"><div id="simpleThreadList"></div></div>
      <div class="simple-panel-view simple-memory-view" id="simpleMemoryView">
        <p class="simple-memory-intro">Simple only keeps cross-conversation memories that you choose to save here.</p>
        <textarea id="simpleMemoryInput" placeholder="What should Simple remember?"></textarea>
        <button type="button" class="simple-memory-save" id="simpleMemorySave">Remember this</button>
        <div id="simpleMemoryList"></div>
      </div>
    `;
    root.document.body.appendChild(panel);

    function showPanelMode(mode) {
      panel.dataset.mode = mode;
      root.document.getElementById('simpleThreadsTab').classList.toggle('active', mode === 'threads');
      root.document.getElementById('simpleMemoryTab').classList.toggle('active', mode === 'memory');
      if (mode === 'memory') renderMemoryList();
    }

    root.document.getElementById('simpleMenuButton').onclick = () => { showPanelMode('threads'); openPanel('threads'); };
    root.document.getElementById('simpleTopNewButton').onclick = startNewConversation;
    root.document.getElementById('simplePanelClose').onclick = closePanel;
    root.document.getElementById('simpleNewConversation').onclick = startNewConversation;
    root.document.getElementById('simpleThreadsTab').onclick = () => showPanelMode('threads');
    root.document.getElementById('simpleMemoryTab').onclick = () => showPanelMode('memory');
    root.document.getElementById('simpleMemorySave').onclick = () => {
      const memoryInput = root.document.getElementById('simpleMemoryInput');
      addMemory(memoryInput.value);
      memoryInput.value = '';
    };

    input.placeholder = 'Message Simple…';
    input.setAttribute('enterkeyhint', 'send');
    input.rows = 1;
    send.textContent = '↑';
    send.setAttribute('aria-label', 'Send message');

    const chat = root.document.getElementById('helloChat');
    if (chat) {
      chat.addEventListener('click', event => {
        if (event.target === chat) input.blur();
      });
      chat.addEventListener('touchmove', () => input.blur(), { passive: true });
    }

    root.document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closePanel();
        input.blur();
      }
    });

    // Replace the prototype's single global thread with explicit per-thread history.
    root.getStoredConversation = getConversation;
    root.rememberConversationTurn = appendTurn;

    // Make chosen memories available to the existing Simple request context without
    // silently turning ordinary conversation into durable memory.
    if (typeof root.getHelloJourneyContext === 'function') {
      const originalJourneyContext = root.getHelloJourneyContext;
      root.getHelloJourneyContext = function () {
        const contextValue = originalJourneyContext() || {};
        return { ...contextValue, simpleMemories: loadMemories().map(item => item.text) };
      };
    }

    renderSidebar();
    const thread = currentThread();
    if (thread.messages.length) renderThread(thread);
    else {
      clearChat();
      if (typeof root.addMessage === 'function') root.addMessage('What would be useful right now?', 'assistant');
      updateConversationTitle();
    }

    root.addEventListener('pageshow', () => {
      renderSidebar();
      updateConversationTitle();
    });
  }

  root.MSHSimpleWorkspace = Object.freeze({
    getThreads: loadThreads,
    getCurrentThread: currentThread,
    getMemories: loadMemories,
    addMemory,
    removeMemory,
    newConversation: startNewConversation,
    openConversations: () => openPanel('threads'),
    openMemory: () => openPanel('memory')
  });

  if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', () => setTimeout(installWorkspace, 0), { once: true });
  } else {
    setTimeout(installWorkspace, 0);
  }
})(typeof window !== 'undefined' ? window : globalThis);
