alter table public.profiles
  add column if not exists dm_privacy text not null default 'everyone',
  add column if not exists story_reply_privacy text not null default 'everyone';

alter table public.profiles
  drop constraint if exists profiles_dm_privacy_check,
  add constraint profiles_dm_privacy_check check (dm_privacy in ('everyone', 'followers', 'nobody')),
  drop constraint if exists profiles_story_reply_privacy_check,
  add constraint profiles_story_reply_privacy_check
    check (story_reply_privacy in ('everyone', 'followers', 'nobody'));

alter table public.posts
  add column if not exists is_archived boolean not null default false,
  add column if not exists comments_disabled boolean not null default false,
  add column if not exists hide_like_count boolean not null default false;

drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;

drop policy if exists blocks_select on public.blocks;
create policy blocks_select on public.blocks for select to authenticated
  using (blocker_id = auth.uid());
drop policy if exists blocks_insert on public.blocks;
create policy blocks_insert on public.blocks for insert to authenticated
  with check (blocker_id = auth.uid());
drop policy if exists blocks_delete on public.blocks;
create policy blocks_delete on public.blocks for delete to authenticated
  using (blocker_id = auth.uid());

grant select, insert, delete on public.blocks to authenticated;
grant update on public.posts to authenticated;

notify pgrst, 'reload schema';
