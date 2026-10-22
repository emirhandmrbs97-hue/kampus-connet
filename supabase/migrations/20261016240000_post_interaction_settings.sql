alter table public.posts
  add column if not exists comments_disabled boolean not null default false,
  add column if not exists hide_like_count boolean not null default false;

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1
      from public.posts p
      where p.id = post_id
        and p.comments_disabled = false
    )
  );

notify pgrst, 'reload schema';
