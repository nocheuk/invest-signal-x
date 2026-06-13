create table if not exists public.acquisition_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  strategy_mode text not null default 'general-investment',
  regions text[] not null default '{}',
  budget_min numeric not null default 0,
  budget_max numeric not null default 0,
  asset_types text[] not null default '{}',
  yield_min numeric not null default 0,
  floor_area_min numeric not null default 0,
  floor_area_max numeric not null default 0,
  keywords_preferred text[] not null default '{}',
  keywords_excluded text[] not null default '{}',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.acquisition_briefs to authenticated;
grant select, insert, update, delete on public.acquisition_briefs to service_role;

drop trigger if exists acquisition_briefs_set_updated_at on public.acquisition_briefs;
create trigger acquisition_briefs_set_updated_at
  before update on public.acquisition_briefs
  for each row
  execute function public.set_updated_at();

alter table public.acquisition_briefs enable row level security;

drop policy if exists "Users can manage own acquisition briefs" on public.acquisition_briefs;
create policy "Users can manage own acquisition briefs"
  on public.acquisition_briefs
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists acquisition_briefs_user_id_idx on public.acquisition_briefs(user_id);
create unique index if not exists acquisition_briefs_one_active_per_user_idx
  on public.acquisition_briefs(user_id)
  where is_active;
