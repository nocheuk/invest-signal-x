alter table public.watchlist_items
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists status text not null default 'Saved',
  add column if not exists notes text not null default '',
  add column if not exists updated_at timestamptz not null default now();

update public.watchlist_items wi
set user_id = w.user_id
from public.watchlists w
where wi.watchlist_id = w.id
  and wi.user_id is null;

update public.watchlist_items wi
set notes = wn.note
from public.watchlist_notes wn
where wi.watchlist_id = wn.watchlist_id
  and wi.deal_id = wn.deal_id
  and coalesce(wi.notes, '') = '';

delete from public.watchlist_items
where user_id is null;

alter table public.watchlist_items
  alter column user_id set not null;

with ranked_items as (
  select
    ctid,
    row_number() over (
      partition by user_id, deal_id
      order by updated_at desc, created_at desc, id
    ) as row_number
  from public.watchlist_items
)
delete from public.watchlist_items wi
using ranked_items ranked
where wi.ctid = ranked.ctid
  and ranked.row_number > 1;

alter table public.watchlist_items
  drop constraint if exists watchlist_items_status_check;
alter table public.watchlist_items
  add constraint watchlist_items_status_check
  check (status in ('Saved', 'Reviewing', 'Viewing Booked', 'Offer Submitted', 'Passed', 'Purchased'));

create unique index if not exists watchlist_items_user_deal_unique
  on public.watchlist_items(user_id, deal_id);

drop trigger if exists watchlist_items_set_updated_at on public.watchlist_items;
create trigger watchlist_items_set_updated_at
  before update on public.watchlist_items
  for each row
  execute function public.set_updated_at();

drop policy if exists "Users can manage own watchlist items" on public.watchlist_items;
create policy "Users can manage own watchlist items"
  on public.watchlist_items
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create index if not exists watchlist_items_user_status_idx
  on public.watchlist_items(user_id, status, updated_at desc);
