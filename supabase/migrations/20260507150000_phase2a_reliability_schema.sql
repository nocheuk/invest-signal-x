alter table public.strategies drop constraint if exists strategies_user_id_is_active_key;
drop index if exists public.strategies_user_id_is_active_key;
create unique index if not exists strategies_one_active_per_user_idx
  on public.strategies(user_id)
  where is_active;

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  alert_enabled boolean not null default false,
  alert_frequency text not null default 'daily',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.import_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_type text not null,
  base_url text,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.import_runs (
  id uuid primary key default gen_random_uuid(),
  import_source_id uuid references public.import_sources(id) on delete set null,
  status text not null default 'pending',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stats jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.raw_imports (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references public.import_runs(id) on delete cascade,
  external_id text,
  source_url text,
  payload jsonb not null default '{}'::jsonb,
  normalized_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  error_message text,
  created_at timestamptz not null default now(),
  unique (import_run_id, external_id)
);

create table if not exists public.deal_source_links (
  id uuid primary key default gen_random_uuid(),
  deal_id text not null references public.deals(id) on delete cascade,
  raw_import_id uuid references public.raw_imports(id) on delete set null,
  import_source_id uuid references public.import_sources(id) on delete set null,
  source_url text,
  confidence numeric not null default 1 check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null default now()
);

create table if not exists public.comparable_transactions (
  id uuid primary key default gen_random_uuid(),
  deal_id text references public.deals(id) on delete set null,
  title text not null,
  location text,
  asset_type text,
  price numeric,
  yield_percent numeric,
  transaction_date date,
  evidence_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists saved_searches_set_updated_at on public.saved_searches;
create trigger saved_searches_set_updated_at before update on public.saved_searches for each row execute function public.set_updated_at();
drop trigger if exists import_sources_set_updated_at on public.import_sources;
create trigger import_sources_set_updated_at before update on public.import_sources for each row execute function public.set_updated_at();
drop trigger if exists comparable_transactions_set_updated_at on public.comparable_transactions;
create trigger comparable_transactions_set_updated_at before update on public.comparable_transactions for each row execute function public.set_updated_at();

alter table public.saved_searches enable row level security;
alter table public.import_sources enable row level security;
alter table public.import_runs enable row level security;
alter table public.raw_imports enable row level security;
alter table public.deal_source_links enable row level security;
alter table public.comparable_transactions enable row level security;

drop policy if exists "Users can manage own saved searches" on public.saved_searches;
create policy "Users can manage own saved searches" on public.saved_searches for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Authenticated users can read import sources" on public.import_sources;
create policy "Authenticated users can read import sources" on public.import_sources for select to authenticated using (true);
drop policy if exists "Authenticated users can read import runs" on public.import_runs;
create policy "Authenticated users can read import runs" on public.import_runs for select to authenticated using (true);
drop policy if exists "Authenticated users can read raw imports" on public.raw_imports;
create policy "Authenticated users can read raw imports" on public.raw_imports for select to authenticated using (true);
drop policy if exists "Deal source links are readable with deals" on public.deal_source_links;
create policy "Deal source links are readable with deals" on public.deal_source_links for select to anon, authenticated using (true);
drop policy if exists "Comparable transactions are readable with deals" on public.comparable_transactions;
create policy "Comparable transactions are readable with deals" on public.comparable_transactions for select to anon, authenticated using (true);

create index if not exists saved_searches_user_id_idx on public.saved_searches(user_id);
create index if not exists import_runs_source_id_idx on public.import_runs(import_source_id);
create index if not exists raw_imports_run_id_idx on public.raw_imports(import_run_id);
create index if not exists deal_source_links_deal_id_idx on public.deal_source_links(deal_id);
create index if not exists comparable_transactions_deal_id_idx on public.comparable_transactions(deal_id);
