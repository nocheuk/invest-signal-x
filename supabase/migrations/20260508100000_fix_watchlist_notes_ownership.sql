insert into public.watchlist_items (watchlist_id, deal_id)
select distinct wn.watchlist_id, wn.deal_id
from public.watchlist_notes wn
left join public.watchlist_items wi
  on wi.watchlist_id = wn.watchlist_id
 and wi.deal_id = wn.deal_id
where wi.id is null
on conflict (watchlist_id, deal_id) do nothing;

alter table public.watchlist_notes
  drop constraint if exists watchlist_notes_watchlist_item_fkey;

alter table public.watchlist_notes
  add constraint watchlist_notes_watchlist_item_fkey
  foreign key (watchlist_id, deal_id)
  references public.watchlist_items(watchlist_id, deal_id)
  on delete cascade;

drop policy if exists "Users can manage own watchlist notes" on public.watchlist_notes;

create policy "Users can manage own watchlist item notes"
on public.watchlist_notes
for all
to authenticated
using (
  exists (
    select 1
    from public.watchlist_items wi
    join public.watchlists w on w.id = wi.watchlist_id
    where wi.watchlist_id = watchlist_notes.watchlist_id
      and wi.deal_id = watchlist_notes.deal_id
      and w.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.watchlist_items wi
    join public.watchlists w on w.id = wi.watchlist_id
    where wi.watchlist_id = watchlist_notes.watchlist_id
      and wi.deal_id = watchlist_notes.deal_id
      and w.user_id = (select auth.uid())
  )
);
