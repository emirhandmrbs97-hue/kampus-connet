create table if not exists public.confession_likes (
  confession_id uuid not null references public.confessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (confession_id, user_id)
);

alter table public.confession_likes enable row level security;
grant select, insert, delete on public.confession_likes to authenticated;

drop policy if exists confession_likes_select on public.confession_likes;
create policy confession_likes_select on public.confession_likes
  for select to authenticated using (true);

drop policy if exists confession_likes_insert on public.confession_likes;
create policy confession_likes_insert on public.confession_likes
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists confession_likes_delete on public.confession_likes;
create policy confession_likes_delete on public.confession_likes
  for delete to authenticated using (user_id = auth.uid());

create or replace function public.notify_confession_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor_username text;
  participant_id uuid;
  comment_snippet text;
begin
  select username into actor_username from public.profiles where id = new.user_id;
  comment_snippet := left(trim(new.comment_text), 120);

  for participant_id in
    select distinct participants.user_id
      from (
        select cc.user_id from public.confession_comments cc
         where cc.confession_id = new.confession_id
        union
        select q.user_id from public.confession_quota_tracker q
         where q.confession_id = new.confession_id
      ) participants
     where participants.user_id <> new.user_id
  loop
    perform public.create_social_notification(
      participant_id, new.user_id, 'comment', 'İtirafa yeni yorum yapıldı',
      '@' || coalesce(actor_username, 'Bir kullanıcı') || ' yorum yaptı: ' || comment_snippet,
      'confession', new.confession_id
    );
  end loop;
  return new;
end $$;

drop trigger if exists confession_comments_notify_participants on public.confession_comments;
create trigger confession_comments_notify_participants
  after insert on public.confession_comments
  for each row execute function public.notify_confession_comment();

create or replace function public.notify_confession_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner_id uuid;
  actor_username text;
  confession_preview text;
begin
  select user_id into owner_id
    from public.confession_quota_tracker
   where confession_id = new.confession_id;
  select username into actor_username from public.profiles where id = new.user_id;
  select left(trim(content), 80) into confession_preview
    from public.confessions where id = new.confession_id;

  perform public.create_social_notification(
    owner_id, new.user_id, 'like', 'İtirafın beğenildi',
    '@' || coalesce(actor_username, 'Bir kullanıcı') || ' itirafını beğendi: ' ||
      coalesce(confession_preview, ''),
    'confession', new.confession_id
  );
  return new;
end $$;

drop trigger if exists confession_likes_notify_owner on public.confession_likes;
create trigger confession_likes_notify_owner
  after insert on public.confession_likes
  for each row execute function public.notify_confession_like();

do $$
begin
  alter publication supabase_realtime add table public.confession_likes;
exception when duplicate_object then
  null;
end;
$$;

notify pgrst, 'reload schema';
