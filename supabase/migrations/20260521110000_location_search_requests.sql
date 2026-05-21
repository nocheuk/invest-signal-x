create table if not exists public.location_search_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  location_query text not null,
  normalized_location text not null,
  source_name text not null default 'Rightmove Commercial',
  status text not null default 'pending',
  result jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.location_search_requests
  drop constraint if exists location_search_requests_status_check;
alter table public.location_search_requests
  add constraint location_search_requests_status_check
  check (status in ('pending', 'completed', 'failed'));

alter table public.location_search_requests enable row level security;

drop policy if exists "Users can read own location search requests" on public.location_search_requests;
create policy "Users can read own location search requests"
  on public.location_search_requests
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists location_search_requests_user_created_idx
  on public.location_search_requests(user_id, created_at desc);

create index if not exists location_search_requests_user_location_source_idx
  on public.location_search_requests(user_id, normalized_location, source_name, created_at desc);
