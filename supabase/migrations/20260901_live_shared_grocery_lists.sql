create extension if not exists pgcrypto;

create table if not exists public.shared_grocery_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Household Grocery List',
  invite_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shared_grocery_members (
  list_id uuid not null references public.shared_grocery_lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('viewer','editor')),
  joined_at timestamptz not null default now(),
  primary key (list_id, user_id)
);

create table if not exists public.shared_grocery_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shared_grocery_lists(id) on delete cascade,
  client_item_id text not null,
  name text not null,
  quantity text,
  reason text,
  estimated_price numeric(10,2),
  status text not null default 'active' check (status in ('active','purchased')),
  purchased_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (list_id, client_item_id)
);

alter table public.shared_grocery_lists enable row level security;
alter table public.shared_grocery_members enable row level security;
alter table public.shared_grocery_items enable row level security;

create or replace function public.can_access_shared_grocery(p_list_id uuid, p_require_edit boolean default false)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shared_grocery_lists l
    where l.id = p_list_id
      and (
        l.owner_id = auth.uid()
        or exists (
          select 1 from public.shared_grocery_members m
          where m.list_id = l.id
            and m.user_id = auth.uid()
            and (not p_require_edit or m.role = 'editor')
        )
      )
  );
$$;

revoke all on function public.can_access_shared_grocery(uuid, boolean) from public;
grant execute on function public.can_access_shared_grocery(uuid, boolean) to authenticated;

create or replace function public.add_owner_to_shared_grocery_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.shared_grocery_members(list_id, user_id, role)
  values (new.id, new.owner_id, 'editor')
  on conflict (list_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists shared_grocery_owner_membership on public.shared_grocery_lists;
create trigger shared_grocery_owner_membership
after insert on public.shared_grocery_lists
for each row execute function public.add_owner_to_shared_grocery_members();

create or replace function public.join_shared_grocery_list(p_invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_list_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  select id into v_list_id
  from public.shared_grocery_lists
  where invite_token = p_invite_token;
  if v_list_id is null then
    raise exception 'Invite not found';
  end if;
  insert into public.shared_grocery_members(list_id, user_id, role)
  values (v_list_id, auth.uid(), 'editor')
  on conflict (list_id, user_id) do update set role = excluded.role;
  return v_list_id;
end;
$$;

revoke all on function public.join_shared_grocery_list(uuid) from public;
grant execute on function public.join_shared_grocery_list(uuid) to authenticated;

create policy shared_grocery_lists_select on public.shared_grocery_lists
for select to authenticated
using (public.can_access_shared_grocery(id, false));

create policy shared_grocery_lists_insert on public.shared_grocery_lists
for insert to authenticated
with check (owner_id = auth.uid());

create policy shared_grocery_lists_update on public.shared_grocery_lists
for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy shared_grocery_lists_delete on public.shared_grocery_lists
for delete to authenticated
using (owner_id = auth.uid());

create policy shared_grocery_members_select on public.shared_grocery_members
for select to authenticated
using (public.can_access_shared_grocery(list_id, false));

create policy shared_grocery_members_delete on public.shared_grocery_members
for delete to authenticated
using (
  user_id = auth.uid()
  or exists (select 1 from public.shared_grocery_lists l where l.id = list_id and l.owner_id = auth.uid())
);

create policy shared_grocery_items_select on public.shared_grocery_items
for select to authenticated
using (public.can_access_shared_grocery(list_id, false));

create policy shared_grocery_items_insert on public.shared_grocery_items
for insert to authenticated
with check (public.can_access_shared_grocery(list_id, true));

create policy shared_grocery_items_update on public.shared_grocery_items
for update to authenticated
using (public.can_access_shared_grocery(list_id, true))
with check (public.can_access_shared_grocery(list_id, true));

create policy shared_grocery_items_delete on public.shared_grocery_items
for delete to authenticated
using (public.can_access_shared_grocery(list_id, true));

alter table public.shared_grocery_items replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'shared_grocery_items'
  ) then
    alter publication supabase_realtime add table public.shared_grocery_items;
  end if;
end $$;
