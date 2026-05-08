alter table public.raw_imports
  add column if not exists row_number integer,
  add column if not exists deal_id text references public.deals(id) on delete set null,
  add column if not exists validation_errors jsonb not null default '[]'::jsonb,
  add column if not exists dedupe_key text;

alter table public.import_runs
  drop constraint if exists import_runs_status_check;
alter table public.import_runs
  add constraint import_runs_status_check
  check (status in ('pending', 'processed', 'failed'));

alter table public.raw_imports
  drop constraint if exists raw_imports_status_check;
alter table public.raw_imports
  add constraint raw_imports_status_check
  check (status in ('pending', 'processed', 'failed', 'skipped_duplicate'));

create unique index if not exists import_sources_name_type_idx
  on public.import_sources(name, source_type);

create unique index if not exists raw_imports_run_row_number_idx
  on public.raw_imports(import_run_id, row_number)
  where row_number is not null;

create index if not exists raw_imports_deal_id_idx
  on public.raw_imports(deal_id);

create index if not exists raw_imports_status_idx
  on public.raw_imports(status);

create unique index if not exists deal_source_links_source_url_idx
  on public.deal_source_links(source_url)
  where source_url is not null;

create index if not exists deal_source_links_raw_import_id_idx
  on public.deal_source_links(raw_import_id);
