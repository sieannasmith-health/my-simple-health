/* My Simple Health — live shared grocery lists */
(function (root) {
  'use strict';

  const page = document.querySelector('[data-msh-food]');
  const cfg = root.MSHSupabaseConfig;
  const supabaseFactory = root.supabase && root.supabase.createClient;
  if (!page || !root.MSHStorage || !cfg || !supabaseFactory) return;

  const client = supabaseFactory(cfg.url, cfg.publishableKey, {
    auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
  });
  const LIST_KEY = 'msh_shared_grocery_list_id';
  let activeListId = localStorage.getItem(LIST_KEY) || null;
  let channel = null;
  let syncingRemote = false;

  const now = () => new Date().toISOString();

  function groceries() {
    const state = root.MSHStorage.getState();
    return state.food && Array.isArray(state.food.groceries) ? state.food.groceries : [];
  }

  async function user() {
    const { data, error } = await client.auth.getUser();
    if (error) return null;
    return data && data.user || null;
  }

  async function requireUser() {
    const current = await user();
    if (!current) throw new Error('Sign in to My Simple Health to use a live shared grocery list.');
    return current;
  }

  function setActiveList(id) {
    activeListId = id || null;
    if (activeListId) localStorage.setItem(LIST_KEY, activeListId);
    else localStorage.removeItem(LIST_KEY);
    updateIndicator();
  }

  async function ensureList() {
    const currentUser = await requireUser();
    if (activeListId) {
      const { data } = await client.from('shared_grocery_lists').select('id,invite_token,name').eq('id', activeListId).maybeSingle();
      if (data) return data;
      setActiveList(null);
    }
    const { data, error } = await client.from('shared_grocery_lists')
      .insert({ owner_id:currentUser.id, name:'Household Grocery List' })
      .select('id,invite_token,name')
      .single();
    if (error) throw error;
    setActiveList(data.id);
    return data;
  }

  function toRemote(item, currentUser) {
    return {
      list_id:activeListId,
      client_item_id:item.id,
      name:item.name,
      quantity:item.quantity || null,
      reason:item.reason || null,
      estimated_price:item.estimatedPrice == null ? null : Number(item.estimatedPrice),
      status:item.status === 'purchased' ? 'purchased' : 'active',
      purchased_at:item.purchasedAt || null,
      created_by:currentUser.id,
      updated_by:currentUser.id,
      updated_at:now()
    };
  }

  async function syncLocalGroceries() {
    if (!activeListId || syncingRemote) return { skipped:true };
    const currentUser = await requireUser();
    const rows = groceries().map(item => toRemote(item, currentUser));
    if (!rows.length) return { synced:0 };
    const { error } = await client.from('shared_grocery_items')
      .upsert(rows, { onConflict:'list_id,client_item_id' });
    if (error) throw error;
    return { synced:rows.length };
  }

  async function deleteItems(clientItemIds) {
    if (!activeListId || !Array.isArray(clientItemIds) || !clientItemIds.length) return;
    await requireUser();
    const { error } = await client.from('shared_grocery_items')
      .delete().eq('list_id', activeListId).in('client_item_id', clientItemIds);
    if (error) throw error;
  }

  async function pullRemote() {
    if (!activeListId) return;
    const { data, error } = await client.from('shared_grocery_items')
      .select('client_item_id,name,quantity,reason,estimated_price,status,purchased_at,created_at')
      .eq('list_id', activeListId)
      .order('created_at', { ascending:true });
    if (error) throw error;
    syncingRemote = true;
    try {
      root.MSHStorage.updateState(state => {
        state.food = state.food || { foods:[], onHand:[], meals:[], recipes:[], groceries:[] };
        state.food.groceries = (data || []).map(item => ({
          id:item.client_item_id,
          name:item.name,
          quantity:item.quantity || null,
          reason:item.reason || '',
          estimatedPrice:item.estimated_price == null ? null : Number(item.estimated_price),
          status:item.status === 'purchased' ? 'purchased' : 'active',
          purchasedAt:item.purchased_at || null,
          createdAt:item.created_at || now(),
          sharedListId:activeListId
        }));
        return state;
      });
      page.dispatchEvent(new CustomEvent('msh:grocery-remote-updated'));
    } finally {
      syncingRemote = false;
    }
  }

  async function subscribe() {
    if (!activeListId) return;
    if (channel) await client.removeChannel(channel);
    channel = client.channel(`shared-grocery-${activeListId}`)
      .on('postgres_changes', {
        event:'*', schema:'public', table:'shared_grocery_items', filter:`list_id=eq.${activeListId}`
      }, () => { pullRemote().catch(console.warn); })
      .subscribe();
  }

  async function enableLiveSharing() {
    const list = await ensureList();
    await syncLocalGroceries();
    await pullRemote();
    await subscribe();
    return list;
  }

  async function inviteUrl() {
    const list = await enableLiveSharing();
    const url = new URL(location.href);
    url.searchParams.set('groceryInvite', list.invite_token);
    return url.toString();
  }

  async function shareInvite() {
    try {
      const url = await inviteUrl();
      const text = 'Join my live My Simple Health grocery list.';
      if (navigator.share) {
        try { await navigator.share({ title:'Shared Grocery List', text, url }); return; }
        catch (error) { if (error && error.name === 'AbortError') return; }
      }
      await navigator.clipboard.writeText(url);
      alert('Live grocery-list invite copied.');
    } catch (error) {
      alert(error.message || 'Live sharing is not available yet.');
    }
  }

  async function joinInvite(token) {
    await requireUser();
    const { data, error } = await client.rpc('join_shared_grocery_list', { p_invite_token:token });
    if (error) throw error;
    setActiveList(data);
    await pullRemote();
    await subscribe();
    const url = new URL(location.href);
    url.searchParams.delete('groceryInvite');
    history.replaceState({}, '', url.toString());
  }

  function groceryPanel() {
    return Array.from(page.querySelectorAll('.msh-food-panel')).find(panel => panel.querySelector('h2')?.textContent.trim() === 'Grocery List') || null;
  }

  function updateIndicator() {
    const panel = groceryPanel();
    if (!panel) return;
    let badge = panel.querySelector('[data-live-grocery-status]');
    if (!badge) {
      const head = panel.querySelector('.msh-food-panel-head');
      if (!head) return;
      const wrap = document.createElement('div');
      wrap.className = 'msh-live-grocery-controls';
      wrap.innerHTML = '<span data-live-grocery-status></span><button type="button" class="msh-food-secondary" data-live-grocery-share>Live share</button>';
      head.appendChild(wrap);
      badge = wrap.querySelector('[data-live-grocery-status]');
    }
    badge.textContent = activeListId ? 'Live shared' : 'Private list';
    badge.classList.toggle('is-live', Boolean(activeListId));
  }

  page.addEventListener('click', event => {
    if (event.target.closest('[data-live-grocery-share]')) shareInvite();
  });

  const observer = new MutationObserver(updateIndicator);
  observer.observe(page, { childList:true, subtree:true });

  const invite = new URL(location.href).searchParams.get('groceryInvite');
  if (invite) {
    joinInvite(invite).catch(error => {
      console.warn('[MSH] Could not join shared grocery list.', error);
      alert(error.message || 'Sign in first, then reopen the grocery-list invite.');
    });
  } else if (activeListId) {
    pullRemote().then(subscribe).catch(error => {
      console.warn('[MSH] Shared grocery list unavailable.', error);
      updateIndicator();
    });
  }

  root.MSHSharedGrocery = Object.freeze({
    client,
    getActiveListId:() => activeListId,
    enableLiveSharing,
    shareInvite,
    syncLocalGroceries,
    deleteItems,
    pullRemote,
    subscribe
  });

  updateIndicator();
})(window);
