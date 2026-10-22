create table if not exists public.listing_likes (
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (listing_id, user_id)
);

alter table public.listing_likes enable row level security;
grant select, insert, delete on public.listing_likes to authenticated;

drop policy if exists listing_likes_select on public.listing_likes;
create policy listing_likes_select on public.listing_likes
  for select to authenticated using (true);

drop policy if exists listing_likes_insert on public.listing_likes;
create policy listing_likes_insert on public.listing_likes
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists listing_likes_delete on public.listing_likes;
create policy listing_likes_delete on public.listing_likes
  for delete to authenticated using (user_id = auth.uid());

notify pgrst, 'reload schema';
