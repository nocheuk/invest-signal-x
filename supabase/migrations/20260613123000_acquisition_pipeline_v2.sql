alter table public.watchlist_items
  add column if not exists next_action_date date,
  add column if not exists assigned_owner text not null default '';

alter table public.watchlist_items
  drop constraint if exists watchlist_items_status_check;

update public.watchlist_items
set status = case status
  when 'Saved' then 'New'
  when 'Viewing Booked' then 'Agent Contacted'
  when 'Passed' then 'Rejected'
  when 'Purchased' then 'Acquired'
  else status
end;

alter table public.watchlist_items
  add constraint watchlist_items_status_check
  check (status in (
    'New',
    'Reviewing',
    'Agent Contacted',
    'Brochure Requested',
    'Planning Review',
    'Financial Review',
    'Offer Submitted',
    'Under Offer',
    'Acquired',
    'Rejected'
  ));

create table if not exists public.watchlist_stage_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deal_id text not null references public.deals(id) on delete cascade,
  old_stage text,
  new_stage text not null,
  changed_at timestamptz not null default now()
);

grant select, insert, update, delete on public.watchlist_items to authenticated;
grant select, insert on public.watchlist_stage_history to authenticated;
grant select, insert, update, delete on public.watchlist_items to service_role;
grant select, insert, update, delete on public.watchlist_stage_history to service_role;

alter table public.watchlist_stage_history enable row level security;

drop policy if exists "Users can read own watchlist stage history" on public.watchlist_stage_history;
create policy "Users can read own watchlist stage history"
  on public.watchlist_stage_history
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can insert own watchlist stage history" on public.watchlist_stage_history;
create policy "Users can insert own watchlist stage history"
  on public.watchlist_stage_history
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create index if not exists watchlist_items_user_next_action_idx
  on public.watchlist_items(user_id, next_action_date)
  where next_action_date is not null;

create index if not exists watchlist_stage_history_user_deal_idx
  on public.watchlist_stage_history(user_id, deal_id, changed_at desc);
