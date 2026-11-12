create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated using (recipient_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create or replace function public.notify_confession_mentions(
  p_text text,
  p_actor_id uuid,
  p_confession_id uuid,
  p_is_comment boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  mentioned_user_id uuid;
begin
  for mentioned_user_id in
    select distinct p.id
      from regexp_matches(
        coalesce(p_text, ''),
        '(^|[^[:alnum:]_])@([[:alnum:]_.]+)',
        'g'
      ) as matches(parts)
      join public.profiles p
        on lower(p.username) = lower(matches.parts[2])
     where p.id <> p_actor_id
  loop
    insert into public.notifications (
      recipient_id,
      actor_id,
      type,
      title,
      body,
      related_type,
      related_id
    )
    values (
      mentioned_user_id,
      null,
      'mention',
      'Bahsetme',
      case
        when p_is_comment then 'Bir kullanıcı anonim itiraf yorumunda senden bahsetti.'
        else 'Bir kullanıcı anonim itirafta senden bahsetti.'
      end,
      'confession',
      p_confession_id
    );
  end loop;
end;
$$;

revoke all on function public.notify_confession_mentions(text, uuid, uuid, boolean) from public, anon, authenticated;

create or replace function public.notify_confession_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  confession_owner_id uuid;
begin
  select tracker.user_id
    into confession_owner_id
    from public.confession_quota_tracker tracker
   where tracker.confession_id = new.confession_id;

  if confession_owner_id is not null and confession_owner_id <> new.user_id then
    insert into public.notifications (
      recipient_id,
      actor_id,
      type,
      title,
      body,
      related_type,
      related_id
    )
    values (
      confession_owner_id,
      new.user_id,
      'confession_comment',
      'Yeni yorum',
      'Paylaştığın anonim itirafa yeni bir yorum yapıldı.',
      'confession',
      new.confession_id
    );
  end if;

  perform public.notify_confession_mentions(new.comment_text, new.user_id, new.confession_id, true);
  return new;
end;
$$;

create or replace function public.notify_confession_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  confession_owner_id uuid;
begin
  select tracker.user_id
    into confession_owner_id
    from public.confession_quota_tracker tracker
   where tracker.confession_id = new.confession_id;

  if confession_owner_id is not null and confession_owner_id <> new.user_id then
    insert into public.notifications (
      recipient_id,
      actor_id,
      type,
      title,
      body,
      related_type,
      related_id
    )
    values (
      confession_owner_id,
      new.user_id,
      'confession_like',
      'Yeni beğeni',
      'Paylaştığın anonim itiraf beğenildi.',
      'confession',
      new.confession_id
    );
  end if;

  return new;
end;
$$;

revoke all on function public.notify_confession_comment() from public, anon, authenticated;
revoke all on function public.notify_confession_like() from public, anon, authenticated;

drop trigger if exists confession_comment_notifications_after_insert on public.confession_comments;
create trigger confession_comment_notifications_after_insert
  after insert on public.confession_comments
  for each row execute function public.notify_confession_comment();

drop trigger if exists confession_like_notifications_after_insert on public.confession_likes;
create trigger confession_like_notifications_after_insert
  after insert on public.confession_likes
  for each row execute function public.notify_confession_like();

create or replace function public.create_confession(
  p_university_id text,
  p_content text,
  p_image_url text default null
)
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
    image_url,
    is_anonymous,
    weekly_quota_tracker
  )
  values (
    trim(p_university_id),
    trim(p_content),
    p_image_url,
    true,
    recent_count + 1
  )
  returning id into new_confession_id;

  insert into public.confession_quota_tracker (confession_id, user_id)
  values (new_confession_id, current_user_id);

  perform public.notify_confession_mentions(trim(p_content), current_user_id, new_confession_id);
  return new_confession_id;
end;
$$;

revoke all on function public.create_confession(text, text, text) from public, anon;
grant execute on function public.create_confession(text, text, text) to authenticated;

do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
