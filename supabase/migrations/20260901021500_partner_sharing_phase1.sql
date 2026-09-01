-- My Simple Health partner sharing, Phase 1
-- Two-account relationships with explicit category-scoped grants.
-- HealthKit source records remain device-local; this schema only permits approved shared summaries/items.

create extension if not exists pgcrypto;

create table if not exists public.msh_sharing_relationships (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  inviter_email text not null,
  invitee_email text not null,
  invitee_id uuid references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  constraint msh_sharing_no_self_pair check (invitee_id is null or inviter_id <> invitee_id)
);

create unique index if not exists msh_sharing_relationship_pending_email
  on public.msh_sharing_relationships (inviter_id, lower(invitee_email))
  where status in ('pending','accepted');

create table if not exists public.msh_sharing_grants (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references public.msh_sharing_relationships(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('calendar','workouts','finances','health')),
  scope jsonb not null default '{}'::jsonb,
  permission text not null default 'view' check (permission in ('view','collaborate')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint msh_sharing_owner_recipient_different check (owner_id <> recipient_id),
  unique (relationship_id, owner_id, recipient_id, category)
);

create table if not exists public.msh_shared_items (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references public.msh_sharing_grants(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  resource_type text not null check (resource_type in ('calendar_event','workout_video','workout_collection','financial_item','health_metric_summary')),
  resource_key text not null,
  payload jsonb not null default '{}'::jsonb,
  source text not null default 'msh' check (source in ('msh','manual','apple_health','connected_source')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (grant_id, resource_type, resource_key)
);

alter table public.msh_sharing_relationships enable row level security;
alter table public.msh_sharing_grants enable row level security;
alter table public.msh_shared_items enable row level security;

-- Relationships can be read only by accepted participants. Pending recipients use the email-bound RPC below.
create policy "relationship_participants_read"
on public.msh_sharing_relationships for select
to authenticated
using (auth.uid() = inviter_id or auth.uid() = invitee_id);

create policy "inviter_creates_relationship"
on public.msh_sharing_relationships for insert
to authenticated
with check (
  auth.uid() = inviter_id
  and invitee_id is null
  and status = 'pending'
  and lower(inviter_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  and lower(invitee_email) <> lower(inviter_email)
);

-- Grants are readable by their owner and recipient. Writes happen only through msh_set_sharing_grant().
create policy "grant_participants_read"
on public.msh_sharing_grants for select
to authenticated
using (auth.uid() = owner_id or auth.uid() = recipient_id);

-- Shared item payloads are readable by the owner or the recipient while the parent grant remains active.
create policy "shared_items_participants_read"
on public.msh_shared_items for select
to authenticated
using (
  auth.uid() = owner_id
  or exists (
    select 1 from public.msh_sharing_grants g
    where g.id = grant_id
      and g.is_active = true
      and g.recipient_id = auth.uid()
  )
);

create policy "shared_items_owner_insert"
on public.msh_shared_items for insert
to authenticated
with check (
  auth.uid() = owner_id
  and exists (
    select 1 from public.msh_sharing_grants g
    where g.id = grant_id
      and g.owner_id = auth.uid()
      and g.is_active = true
  )
);

create policy "shared_items_owner_update"
on public.msh_shared_items for update
to authenticated
using (auth.uid() = owner_id)
with check (
  auth.uid() = owner_id
  and exists (
    select 1 from public.msh_sharing_grants g
    where g.id = grant_id
      and g.owner_id = auth.uid()
      and g.is_active = true
  )
);

create policy "shared_items_owner_delete"
on public.msh_shared_items for delete
to authenticated
using (auth.uid() = owner_id);

create or replace function public.msh_pending_sharing_invites()
returns setof public.msh_sharing_relationships
language sql
security definer
set search_path = public
stable
as $$
  select r.*
  from public.msh_sharing_relationships r
  join auth.users u on u.id = auth.uid()
  where r.status = 'pending'
    and lower(r.invitee_email) = lower(u.email);
$$;

create or replace function public.msh_accept_sharing_invite(invite_id uuid)
returns public.msh_sharing_relationships
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.msh_sharing_relationships;
  current_email text;
begin
  select lower(email) into current_email from auth.users where id = auth.uid();
  select * into invite
  from public.msh_sharing_relationships
  where id = invite_id
  for update;

  if invite.id is null then raise exception 'Invite not found'; end if;
  if invite.status <> 'pending' then raise exception 'Invite is no longer pending'; end if;
  if lower(invite.invitee_email) <> current_email then raise exception 'Invite does not belong to this account'; end if;
  if invite.inviter_id = auth.uid() then raise exception 'Cannot accept your own invite'; end if;

  if exists (
    select 1 from public.msh_sharing_relationships r
    where r.status = 'accepted'
      and r.id <> invite.id
      and ((r.inviter_id = invite.inviter_id and r.invitee_id = auth.uid())
        or (r.inviter_id = auth.uid() and r.invitee_id = invite.inviter_id))
  ) then
    raise exception 'A sharing relationship already exists between these accounts';
  end if;

  update public.msh_sharing_relationships
     set invitee_id = auth.uid(), status = 'accepted', accepted_at = now()
   where id = invite_id
   returning * into invite;

  return invite;
end;
$$;

create or replace function public.msh_revoke_sharing_relationship(p_relationship_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.msh_sharing_relationships r
    where r.id = p_relationship_id
      and (r.inviter_id = auth.uid() or r.invitee_id = auth.uid())
      and r.status in ('pending','accepted')
  ) then
    raise exception 'Relationship not found or not available';
  end if;

  update public.msh_sharing_relationships
     set status = 'revoked', revoked_at = now()
   where id = p_relationship_id;

  update public.msh_sharing_grants
     set is_active = false, revoked_at = now(), updated_at = now()
   where relationship_id = p_relationship_id
     and is_active = true;
end;
$$;

create or replace function public.msh_set_sharing_grant(
  p_relationship_id uuid,
  p_category text,
  p_permission text,
  p_scope jsonb,
  p_enabled boolean
)
returns public.msh_sharing_grants
language plpgsql
security definer
set search_path = public
as $$
declare
  rel public.msh_sharing_relationships;
  recipient uuid;
  final_permission text;
  result public.msh_sharing_grants;
begin
  if p_category not in ('calendar','workouts','finances','health') then
    raise exception 'Unsupported sharing category';
  end if;

  if p_permission not in ('view','collaborate') then
    raise exception 'Unsupported sharing permission';
  end if;

  select * into rel
  from public.msh_sharing_relationships
  where id = p_relationship_id
    and status = 'accepted'
    and (inviter_id = auth.uid() or invitee_id = auth.uid());

  if rel.id is null then raise exception 'Active sharing relationship not found'; end if;

  recipient := case when rel.inviter_id = auth.uid() then rel.invitee_id else rel.inviter_id end;
  if recipient is null or recipient = auth.uid() then raise exception 'Invalid sharing recipient'; end if;

  -- Health sharing is intentionally view-only in Phase 1.
  final_permission := case when p_category = 'health' then 'view' else p_permission end;

  insert into public.msh_sharing_grants (
    relationship_id, owner_id, recipient_id, category, scope, permission, is_active, revoked_at
  ) values (
    p_relationship_id, auth.uid(), recipient, p_category, coalesce(p_scope, '{}'::jsonb), final_permission, p_enabled,
    case when p_enabled then null else now() end
  )
  on conflict (relationship_id, owner_id, recipient_id, category)
  do update set
    scope = excluded.scope,
    permission = excluded.permission,
    is_active = excluded.is_active,
    updated_at = now(),
    revoked_at = case when excluded.is_active then null else now() end
  returning * into result;

  return result;
end;
$$;

grant execute on function public.msh_pending_sharing_invites() to authenticated;
grant execute on function public.msh_accept_sharing_invite(uuid) to authenticated;
grant execute on function public.msh_revoke_sharing_relationship(uuid) to authenticated;
grant execute on function public.msh_set_sharing_grant(uuid, text, text, jsonb, boolean) to authenticated;
