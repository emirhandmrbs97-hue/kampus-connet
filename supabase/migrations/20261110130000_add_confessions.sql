create table if not exists public.confessions (
  id uuid primary key default gen_random_uuid(),
  university_id text not null,
  content text not null check (length(trim(content)) > 0 and length(content) <= 2000),
  is_anonymous boolean not null default true,
  weekly_quota_tracker integer,
  created_at timestamptz not null default now()
);

create index if not exists confessions_university_created_idx
  on public.confessions (university_id, created_at desc);

create table if not exists public.confession_quota_tracker (
  confession_id uuid primary key references public.confessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists confession_quota_user_created_idx
  on public.confession_quota_tracker (user_id, created_at desc);

create table if not exists public.confession_comments (
  id uuid primary key default gen_random_uuid(),
  confession_id uuid not null references public.confessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  comment_text text not null check (length(trim(comment_text)) > 0 and length(comment_text) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists confession_comments_confession_created_idx
  on public.confession_comments (confession_id, created_at);

create table if not exists public.confession_likes (
  confession_id uuid not null references public.confessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (confession_id, user_id)
);

alter table public.confessions enable row level security;
alter table public.confession_quota_tracker enable row level security;
alter table public.confession_comments enable row level security;
alter table public.confession_likes enable row level security;

drop policy if exists confession_comments_read on public.confession_comments;
drop policy if exists confession_comments_select on public.confession_comments;
create policy confession_comments_select on public.confession_comments
  for select to authenticated using (true);

drop policy if exists confession_comments_insert_own on public.confession_comments;
drop policy if exists confession_comments_insert on public.confession_comments;
create policy confession_comments_insert on public.confession_comments
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists confession_comments_delete_own on public.confession_comments;
drop policy if exists confession_comments_delete on public.confession_comments;
create policy confession_comments_delete on public.confession_comments
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists confession_likes_read_own on public.confession_likes;
drop policy if exists confession_likes_select on public.confession_likes;
create policy confession_likes_select on public.confession_likes
  for select to authenticated using (user_id = auth.uid());

drop policy if exists confession_likes_insert_own on public.confession_likes;
drop policy if exists confession_likes_insert on public.confession_likes;
create policy confession_likes_insert on public.confession_likes
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists confession_likes_delete_own on public.confession_likes;
drop policy if exists confession_likes_delete on public.confession_likes;
create policy confession_likes_delete on public.confession_likes
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists confession_quota_tracker_read_own on public.confession_quota_tracker;
create policy confession_quota_tracker_read_own on public.confession_quota_tracker
  for select to authenticated using (user_id = auth.uid());

drop policy if exists confessions_select on public.confessions;
create policy confessions_select on public.confessions
  for select to authenticated using (true);

create or replace view public.confessions_feed
with (security_invoker = false)
as
select
  c.id,
  c.university_id,
  c.content,
  c.created_at,
  (select count(*)::integer from public.confession_likes l where l.confession_id = c.id) as like_count,
  (select count(*)::integer from public.confession_comments cm where cm.confession_id = c.id) as comment_count
from public.confessions c;

grant select on public.confessions_feed to authenticated;
grant select, insert, delete on public.confession_comments to authenticated;
grant select, insert, delete on public.confession_likes to authenticated;

create or replace function public.create_confession(p_university_id text, p_content text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  recent_count integer;
  new_confession_id uuid;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'authentication_required';
  end if;

  if p_university_id is null or length(trim(p_university_id)) = 0 then
    raise exception using errcode = '22023', message = 'university_required';
  end if;

  if p_content is null or length(trim(p_content)) < 5 or length(trim(p_content)) > 2000 then
    raise exception using errcode = '22023', message = 'invalid_confession_content';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));

  select count(*)::integer
    into recent_count
    from public.confession_quota_tracker
   where user_id = current_user_id
     and created_at >= now() - interval '7 days';

  if recent_count >= 2 then
    raise exception using errcode = 'P0001', message = 'weekly_quota_exceeded';
  end if;

  insert into public.confessions (
    university_id,
    content,
    is_anonymous,
    weekly_quota_tracker
  )
  values (
    trim(p_university_id),
    trim(p_content),
    true,
    recent_count + 1
  )
  returning id into new_confession_id;

  insert into public.confession_quota_tracker (confession_id, user_id)
  values (new_confession_id, current_user_id);

  return new_confession_id;
end;
$$;

revoke all on function public.create_confession(text, text) from public, anon;
grant execute on function public.create_confession(text, text) to authenticated;
