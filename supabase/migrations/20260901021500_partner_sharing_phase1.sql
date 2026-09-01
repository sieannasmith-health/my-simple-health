-- My Simple Health partner sharing, Phase 1
-- Explicit two-account relationships plus category-scoped grants.

create extension if not exists pgcrypto;

create table if not exists public.msh_sharing_relationships (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
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

create policy "relationship_participants_read"
on public.msh_sharing_relationships for select
to authenticated
using (auth.uid() = inviter_id or auth.uid() = invitee_id);

create policy "inviter_creates_relationship"
on public.msh_sharing_relationships for insert
to authenticated
with check (auth.uid() = inviter_id and invitee_id is null and status = 'pending');

create policy "grant_participants_read"
on public.msh_sharing_grants for select
to authenticated
using (auth.uid() = owner_id or auth.uid() = recipient_id);

create policy "grant_owner_insert"
on public.msh_sharing_grants for insert
to authenticated
with check (
  auth.uid() = owner_id
  and exists (
    select 1 from public.msh_sharing_relationships r
    where r.id = relationship_id
      and r.status = 'accepted'
      and ((r.inviter_id = owner_id and r.invitee_id = recipient_id)
        or (r.invitee_id = owner_id and r.inviter_id = recipient_id))
  )
);

create policy "grant_owner_update"
on public.msh_sharing_grants for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "shared_items_participants_read"
on public.msh_shared_items for select
to authenticated
using (
  auth.uid() = owner_id
  or exists (
    select 1 from public.msh_sharing_grants g
    where g.id = grant_id and g.is_active = true and g.recipient_id = auth.uid()
  )
);

create policy "shared_items_owner_write"
on public.msh_shared_items for all
to authenticated
using (auth.uid() = owner_id)
with check (
  auth.uid() = owner_id
  and exists (
    select 1 from public.msh_sharing_grants g
    where g.id = grant_id and g.owner_id = auth.uid() and g.is_active = true
  )
);

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
  select * into invite from public.msh_sharing_relationships where id = invite_id for update;
  if invite.id is null then raise exception 'Invite not found'; end if;
  if invite.status <> 'pending' then raise exception 'Invite is no longer pending'; end if;
  if lower(invite.invitee_email) <> current_email then raise exception 'Invite does not belong to this account'; end if;
  update public.msh_sharing_relationships
     set invitee_id = auth.uid(), status = 'accepted', accepted_at = now()
   where id = invite_id
   returning * into invite;
  return invite;
end;
$$;

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
  where r.status = 'pending' and lower(r.invitee_email) = lower(u.email);
$$;

create or replace function public.msh_revoke_sharing_relationship(relationship_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.msh_sharing_relationships r
    where r.id = relationship_id
      and (r.inviter_id = auth.uid() or r.invitee_id = auth.uid())
      and r.status in ('pending','accepted')
  ) then
    raise exception 'Relationship not found or not available';
  end if;

  update public.msh_sharing_relationships
     set status = 'revoked', revoked_at = now()
   where id = relationship_id;

  update public.msh_sharing_grants
     set is_active = false, revoked_at = now(), updated_at = now()
   where relationship_id = msh_revoke_sharing_relationship.relationship_id
     and is_active = true;
end;
$$;

grant execute on function public.msh_accept_sharing_invite(uuid) to authenticated;
grant execute on function public.msh_pending_sharing_invites() to authenticated;
grant execute on function public.msh_revoke_sharing_relationship(uuid) to authenticated;

create or replace function public.msh_touch_sharing_grant()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  if new.is_active = false and old.is_active = true then new.revoked_at = now(); end if;
  if new.is_active = true then new.revoked_at = null; end if;
  return new;
end;
$$;

drop trigger if exists trg_msh_touch_sharing_grant on public.msh_sharing_grants;
create trigger trg_msh_touch_sharing_grant
before update on public.msh_sharing_grants
for each row execute function public.msh_touch_sharing_grant();
