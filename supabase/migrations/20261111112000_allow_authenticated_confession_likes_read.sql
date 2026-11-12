drop policy if exists confession_likes_select on public.confession_likes;
create policy confession_likes_select on public.confession_likes
  for select to authenticated using (true);
