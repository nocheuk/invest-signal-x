create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  message text not null,
  deal_id text references public.deals(id) on delete set null,
  source_url text,
  current_page text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.user_feedback
  drop constraint if exists user_feedback_type_check;
alter table public.user_feedback
  add constraint user_feedback_type_check
  check (type in ('bug_report', 'feature_request', 'data_issue', 'source_request', 'general_feedback'));

create table if not exists public.user_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  deal_id text references public.deals(id) on delete set null,
  source_url text,
  current_page text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.user_events
  drop constraint if exists user_events_event_type_check;
alter table public.user_events
  add constraint user_events_event_type_check
  check (event_type in (
    'opened_deal',
    'opened_source_listing',
    'saved_to_pipeline',
    'downloaded_investment_pack',
    'clicked_top_opportunity',
    'clicked_strong_opportunity',
    'created_alert',
    'ran_location_search',
    'changed_acquisition_brief'
  ));

alter table public.user_feedback enable row level security;
alter table public.user_events enable row level security;

drop policy if exists "Users can create own feedback" on public.user_feedback;
create policy "Users can create own feedback"
  on public.user_feedback
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can view own feedback" on public.user_feedback;
create policy "Users can view own feedback"
  on public.user_feedback
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', (select auth.jwt()) -> 'app_metadata' ->> 'user_role') in ('admin', 'owner')
  );

drop policy if exists "Users can create own events" on public.user_events;
create policy "Users can create own events"
  on public.user_events
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can view own events" on public.user_events;
create policy "Users can view own events"
  on public.user_events
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', (select auth.jwt()) -> 'app_metadata' ->> 'user_role') in ('admin', 'owner')
  );

create index if not exists user_feedback_created_at_idx
  on public.user_feedback(created_at desc);
create index if not exists user_feedback_user_id_idx
  on public.user_feedback(user_id);
create index if not exists user_feedback_type_idx
  on public.user_feedback(type);

create index if not exists user_events_created_at_idx
  on public.user_events(created_at desc);
create index if not exists user_events_user_id_idx
  on public.user_events(user_id);
create index if not exists user_events_event_type_idx
  on public.user_events(event_type);
create index if not exists user_events_deal_id_idx
  on public.user_events(deal_id);

grant select, insert on public.user_feedback to authenticated;
grant select, insert on public.user_events to authenticated;
