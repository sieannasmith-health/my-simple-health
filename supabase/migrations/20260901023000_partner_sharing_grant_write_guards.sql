-- Allow the native client to create/update only its own category grants while
-- preventing identity/category mutation and keeping health sharing view-only.

alter table public.msh_sharing_grants
  add constraint msh_health_sharing_view_only
  check (category <> 'health' or permission = 'view');

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

create or replace function public.msh_guard_sharing_grant_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.relationship_id <> old.relationship_id
     or new.owner_id <> old.owner_id
     or new.recipient_id <> old.recipient_id
     or new.category <> old.category then
    raise exception 'Sharing grant identity fields are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_msh_guard_sharing_grant_identity on public.msh_sharing_grants;
create trigger trg_msh_guard_sharing_grant_identity
before update on public.msh_sharing_grants
for each row execute function public.msh_guard_sharing_grant_identity();
