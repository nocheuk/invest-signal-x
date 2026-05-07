create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company text,
  preferences jsonb not null default '{}'::jsonb,
  alert_preferences jsonb not null default '{"email": true, "frequency": "daily", "min_score": 75}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deals (
  id text primary key,
  title text not null,
  location text not null,
  region text not null,
  asset_type text not null,
  source text not null,
  guide_price numeric not null default 0,
  passing_rent numeric not null default 0,
  sqft numeric not null default 0,
  gross_yield numeric not null default 0,
  net_initial_yield numeric not null default 0,
  reversionary_yield numeric not null default 0,
  wault numeric not null default 0,
  lease_length numeric not null default 0,
  tenant text not null,
  covenant_strength text not null,
  tenant_health_score numeric not null default 0,
  rent_sustainability text not null,
  rent_review text not null,
  price_per_sqft numeric not null default 0,
  planning_upside_score numeric not null default 0,
  void_risk_score numeric not null default 0,
  exit_yield_sensitivity text not null,
  cashflow_after_debt numeric not null default 0,
  return_on_equity numeric not null default 0,
  auction_guide_risk text,
  red_flags text[] not null default '{}',
  main_risk_flag text not null default '',
  score numeric not null default 0,
  rating text not null,
  score_breakdown jsonb not null default '{}'::jsonb,
  insights jsonb not null default '{}'::jsonb,
  thumbnail text not null default '',
  posted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  preset text not null default 'Balanced',
  weights jsonb not null default '{"yield":60,"growth":60,"discount":60,"risk":60,"demand":60}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My Watchlist',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references public.watchlists(id) on delete cascade,
  deal_id text not null references public.deals(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (watchlist_id, deal_id)
);

create table if not exists public.watchlist_notes (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references public.watchlists(id) on delete cascade,
  deal_id text not null references public.deals(id) on delete cascade,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (watchlist_id, deal_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists deals_set_updated_at on public.deals;
create trigger deals_set_updated_at before update on public.deals for each row execute function public.set_updated_at();
drop trigger if exists strategies_set_updated_at on public.strategies;
create trigger strategies_set_updated_at before update on public.strategies for each row execute function public.set_updated_at();
drop trigger if exists watchlists_set_updated_at on public.watchlists;
create trigger watchlists_set_updated_at before update on public.watchlists for each row execute function public.set_updated_at();
drop trigger if exists watchlist_notes_set_updated_at on public.watchlist_notes;
create trigger watchlist_notes_set_updated_at before update on public.watchlist_notes for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.deals enable row level security;
alter table public.strategies enable row level security;
alter table public.watchlists enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.watchlist_notes enable row level security;

drop policy if exists "Deals are readable by everyone" on public.deals;
create policy "Deals are readable by everyone" on public.deals for select to anon, authenticated using (true);

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "Users can manage own strategies" on public.strategies;
create policy "Users can manage own strategies" on public.strategies for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage own watchlists" on public.watchlists;
create policy "Users can manage own watchlists" on public.watchlists for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage own watchlist items" on public.watchlist_items;
create policy "Users can manage own watchlist items" on public.watchlist_items for all to authenticated
using (exists (select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = (select auth.uid())))
with check (exists (select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = (select auth.uid())));

drop policy if exists "Users can manage own watchlist notes" on public.watchlist_notes;
create policy "Users can manage own watchlist notes" on public.watchlist_notes for all to authenticated
using (exists (select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = (select auth.uid())))
with check (exists (select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = (select auth.uid())));

create index if not exists strategies_user_id_idx on public.strategies(user_id);
create index if not exists watchlists_user_id_idx on public.watchlists(user_id);
create index if not exists watchlist_items_watchlist_id_idx on public.watchlist_items(watchlist_id);
create index if not exists watchlist_notes_watchlist_id_idx on public.watchlist_notes(watchlist_id);
