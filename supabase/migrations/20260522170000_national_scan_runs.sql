create table if not exists public.national_scan_runs (
  id uuid primary key default gen_random_uuid(),
  scan_type text not null default 'england_national_scan',
  location_query text not null,
  normalized_location text not null,
  source_name text not null,
  status text not null default 'pending',
  inserted integer not null default 0,
  existing integer not null default 0,
  failed integer not null default 0,
  skipped_duplicate integer not null default 0,
  skipped_rent_only integer not null default 0,
  skipped_poa integer not null default 0,
  result jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.national_scan_runs
  drop constraint if exists national_scan_runs_status_check;
alter table public.national_scan_runs
  add constraint national_scan_runs_status_check
  check (status in ('pending', 'completed', 'failed'));

alter table public.national_scan_runs enable row level security;

drop policy if exists "Authenticated users can read national scan runs" on public.national_scan_runs;
create policy "Authenticated users can read national scan runs"
  on public.national_scan_runs
  for select
  to authenticated
  using (true);

create index if not exists national_scan_runs_type_started_idx
  on public.national_scan_runs(scan_type, started_at desc);

create index if not exists national_scan_runs_location_source_idx
  on public.national_scan_runs(normalized_location, source_name, started_at desc);
