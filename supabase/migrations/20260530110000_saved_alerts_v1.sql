create table if not exists public.saved_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  location_query text not null default '',
  min_yield numeric not null default 0,
  max_price integer not null default 0,
  asset_type text not null default 'All',
  min_score integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_alerts_min_score_check check (min_score between 0 and 100),
  constraint saved_alerts_min_yield_check check (min_yield >= 0),
  constraint saved_alerts_max_price_check check (max_price >= 0)
);

create table if not exists public.alert_runs (
  id uuid primary key default gen_random_uuid(),
  run_date date not null default current_date,
  status text not null default 'pending',
  deals_matched integer not null default 0,
  emails_sent integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint alert_runs_status_check check (status in ('pending', 'completed', 'failed'))
);

create table if not exists public.alert_matches (
  id uuid primary key default gen_random_uuid(),
  alert_run_id uuid not null references public.alert_runs(id) on delete cascade,
  alert_id uuid not null references public.saved_alerts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  deal_id text not null references public.deals(id) on delete cascade,
  matched_at timestamptz not null default now(),
  email_sent boolean not null default false,
  email_sent_at timestamptz,
  email_status text not null default 'pending',
  match_reasons text[] not null default array[]::text[],
  payload jsonb not null default '{}'::jsonb,
  constraint alert_matches_alert_deal_unique unique (alert_id, deal_id)
);

create or replace function public.set_saved_alerts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists saved_alerts_set_updated_at on public.saved_alerts;
create trigger saved_alerts_set_updated_at
  before update on public.saved_alerts
  for each row
  execute function public.set_saved_alerts_updated_at();

alter table public.saved_alerts enable row level security;
alter table public.alert_runs enable row level security;
alter table public.alert_matches enable row level security;

drop policy if exists "Users can read their own saved alerts" on public.saved_alerts;
create policy "Users can read their own saved alerts"
  on public.saved_alerts
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own saved alerts" on public.saved_alerts;
create policy "Users can create their own saved alerts"
  on public.saved_alerts
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own saved alerts" on public.saved_alerts;
create policy "Users can update their own saved alerts"
  on public.saved_alerts
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own saved alerts" on public.saved_alerts;
create policy "Users can delete their own saved alerts"
  on public.saved_alerts
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Authenticated users can read alert runs" on public.alert_runs;
create policy "Authenticated users can read alert runs"
  on public.alert_runs
  for select
  to authenticated
  using (true);

drop policy if exists "Users can read their own alert matches" on public.alert_matches;
create policy "Users can read their own alert matches"
  on public.alert_matches
  for select
  to authenticated
  using (auth.uid() = user_id);

create index if not exists saved_alerts_user_enabled_idx
  on public.saved_alerts(user_id, enabled, updated_at desc);

create index if not exists alert_runs_started_idx
  on public.alert_runs(started_at desc);

create index if not exists alert_matches_user_alert_idx
  on public.alert_matches(user_id, alert_id, matched_at desc);

create index if not exists alert_matches_deal_idx
  on public.alert_matches(deal_id);
