-- Shared household budgets for My Simple Health
-- All access is enforced with Supabase Auth + row-level security.

create extension if not exists pgcrypto;

create table if not exists public.shared_budgets (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Shared budget' check (char_length(name) between 1 and 80),
  owner_id uuid not null references auth.users(id) on delete cascade,
  monthly_income numeric(12,2) not null default 0 check (monthly_income >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shared_budget_members (
  budget_id uuid not null references public.shared_budgets(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  invited_email text,
  role text not null default 'collaborator' check (role in ('owner','collaborator','viewer')),
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  primary key (budget_id, invited_by, invited_email),
  check (user_id is not null or invited_email is not null)
);

create unique index if not exists shared_budget_member_user_unique
  on public.shared_budget_members (budget_id, user_id)
  where user_id is not null;

create table if not exists public.shared_budget_items (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.shared_budgets(id) on delete cascade,
  category text not null default 'Other' check (char_length(category) between 1 and 60),
  label text not null check (char_length(label) between 1 and 100),
  planned_amount numeric(12,2) not null default 0 check (planned_amount >= 0),
  actual_amount numeric(12,2) not null default 0 check (actual_amount >= 0),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_shared_budget_member(target_budget uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shared_budgets b
    where b.id = target_budget and b.owner_id = auth.uid()
  ) or exists (
    select 1 from public.shared_budget_members m
    where m.budget_id = target_budget
      and m.user_id = auth.uid()
      and m.status = 'accepted'
  );
$$;

create or replace function public.can_edit_shared_budget(target_budget uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shared_budgets b
    where b.id = target_budget and b.owner_id = auth.uid()
  ) or exists (
    select 1 from public.shared_budget_members m
    where m.budget_id = target_budget
      and m.user_id = auth.uid()
      and m.status = 'accepted'
      and m.role = 'collaborator'
  );
$$;

alter table public.shared_budgets enable row level security;
alter table public.shared_budget_members enable row level security;
alter table public.shared_budget_items enable row level security;

create policy "shared budgets visible to members"
on public.shared_budgets for select
to authenticated
using (public.is_shared_budget_member(id));

create policy "users create owned shared budgets"
on public.shared_budgets for insert
to authenticated
with check (owner_id = auth.uid());

create policy "shared budgets editable by collaborators"
on public.shared_budgets for update
to authenticated
using (public.can_edit_shared_budget(id))
with check (public.can_edit_shared_budget(id));

create policy "owners delete shared budgets"
on public.shared_budgets for delete
to authenticated
using (owner_id = auth.uid());

create policy "members visible to budget members or invitee"
on public.shared_budget_members for select
to authenticated
using (
  public.is_shared_budget_member(budget_id)
  or (lower(invited_email) = lower(coalesce(auth.jwt()->>'email','')) and status = 'pending')
);

create policy "budget owners invite members"
on public.shared_budget_members for insert
to authenticated
with check (
  invited_by = auth.uid()
  and exists (select 1 from public.shared_budgets b where b.id = budget_id and b.owner_id = auth.uid())
);

create policy "invitees accept their own invitation"
on public.shared_budget_members for update
to authenticated
using (
  status = 'pending'
  and lower(invited_email) = lower(coalesce(auth.jwt()->>'email',''))
)
with check (
  user_id = auth.uid()
  and status = 'accepted'
  and lower(invited_email) = lower(coalesce(auth.jwt()->>'email',''))
);

create policy "owners manage memberships"
on public.shared_budget_members for update
to authenticated
using (exists (select 1 from public.shared_budgets b where b.id = budget_id and b.owner_id = auth.uid()))
with check (exists (select 1 from public.shared_budgets b where b.id = budget_id and b.owner_id = auth.uid()));

create policy "shared items visible to members"
on public.shared_budget_items for select
to authenticated
using (public.is_shared_budget_member(budget_id));

create policy "collaborators add shared items"
on public.shared_budget_items for insert
to authenticated
with check (
  public.can_edit_shared_budget(budget_id)
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

create policy "collaborators edit shared items"
on public.shared_budget_items for update
to authenticated
using (public.can_edit_shared_budget(budget_id))
with check (public.can_edit_shared_budget(budget_id) and updated_by = auth.uid());

create policy "collaborators delete shared items"
on public.shared_budget_items for delete
to authenticated
using (public.can_edit_shared_budget(budget_id));

create or replace function public.touch_shared_budget_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger shared_budget_touch
before update on public.shared_budgets
for each row execute function public.touch_shared_budget_updated_at();

create trigger shared_budget_item_touch
before update on public.shared_budget_items
for each row execute function public.touch_shared_budget_updated_at();
