alter table public.comments
  add column if not exists parent_comment_id uuid;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'comments_parent_comment_id_fkey'
       and conrelid = 'public.comments'::regclass
  ) then
    alter table public.comments
      add constraint comments_parent_comment_id_fkey
      foreign key (parent_comment_id)
      references public.comments(id)
      on delete cascade;
  end if;
end
$$;

create index if not exists comments_thread_order_idx
  on public.comments (post_id, parent_comment_id, created_at);

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1
        from public.posts post
       where post.id = comments.post_id
         and coalesce(post.comments_disabled, false) = false
    )
    and (
      parent_comment_id is null
      or exists (
        select 1
          from public.comments parent
         where parent.id = comments.parent_comment_id
           and parent.post_id = comments.post_id
      )
    )
  );
