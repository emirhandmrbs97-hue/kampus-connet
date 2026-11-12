alter table public.confession_comments
  add column if not exists parent_id uuid;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'confession_comments_parent_id_fkey'
       and conrelid = 'public.confession_comments'::regclass
  ) then
    alter table public.confession_comments
      add constraint confession_comments_parent_id_fkey
      foreign key (parent_id)
      references public.confession_comments(id)
      on delete cascade;
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'confession_comments_parent_not_self_check'
       and conrelid = 'public.confession_comments'::regclass
  ) then
    alter table public.confession_comments
      add constraint confession_comments_parent_not_self_check
      check (parent_id is null or parent_id <> id);
  end if;
end
$$;

create index if not exists confession_comments_thread_created_idx
  on public.confession_comments (confession_id, parent_id, created_at);

create index if not exists confession_comments_parent_id_idx
  on public.confession_comments (parent_id);

drop policy if exists confession_comments_insert_own on public.confession_comments;
drop policy if exists confession_comments_insert on public.confession_comments;
create policy confession_comments_insert on public.confession_comments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      parent_id is null
      or exists (
        select 1
          from public.confession_comments parent
         where parent.id = confession_comments.parent_id
           and parent.confession_id = confession_comments.confession_id
      )
    )
  );
