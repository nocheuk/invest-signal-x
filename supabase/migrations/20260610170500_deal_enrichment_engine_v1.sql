create table if not exists public.deal_enrichments (
  id uuid primary key default gen_random_uuid(),
  deal_id text not null references public.deals(id) on delete cascade,
  source_url text,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  last_attempted_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  tenant_name text,
  passing_rent numeric,
  lease_length numeric,
  wault numeric,
  epc_rating text,
  sqft numeric,
  guide_price numeric,
  auction_info jsonb not null default '{}'::jsonb,
  vat_info text,
  investment_summary text,
  extracted_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deal_id)
);

alter table public.deal_enrichments
  drop constraint if exists deal_enrichments_status_check;
alter table public.deal_enrichments
  add constraint deal_enrichments_status_check
  check (status in ('pending', 'enriched', 'failed'));

drop trigger if exists deal_enrichments_set_updated_at on public.deal_enrichments;
create trigger deal_enrichments_set_updated_at
  before update on public.deal_enrichments
  for each row
  execute function public.set_updated_at();

alter table public.deal_enrichments enable row level security;

drop policy if exists "Deal enrichments are readable with deals" on public.deal_enrichments;
create policy "Deal enrichments are readable with deals"
  on public.deal_enrichments
  for select
  to anon, authenticated
  using (true);

create index if not exists deal_enrichments_status_next_attempt_idx
  on public.deal_enrichments(status, next_attempt_at);

create index if not exists deal_enrichments_deal_id_idx
  on public.deal_enrichments(deal_id);
