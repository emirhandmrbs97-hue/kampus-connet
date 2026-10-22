alter table public.comments
  add column if not exists parent_comment_id uuid references public.comments(id) on delete cascade;

create index if not exists comments_parent_comment_id_idx
  on public.comments (parent_comment_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('like', 'comment', 'reply', 'mention', 'message', 'listing_inquiry', 'listing_offer', 'follow')),
  title text not null,
  body text not null,
  related_type text check (related_type in ('post', 'chat', 'profile', 'listing')),
  related_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (recipient_id)
  where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated using (recipient_id = auth.uid());
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());
grant select, update on public.notifications to authenticated;

create or replace function public.create_social_notification(
  p_recipient_id uuid,
  p_actor_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_related_type text,
  p_related_id uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (recipient_id, actor_id, type, title, body, related_type, related_id)
  select p_recipient_id, p_actor_id, p_type, p_title, p_body, p_related_type, p_related_id
   where p_recipient_id is not null
     and p_recipient_id is distinct from p_actor_id;
$$;

revoke all on function public.create_social_notification(uuid, uuid, text, text, text, text, uuid)
  from public, anon, authenticated;

create or replace function public.notify_post_mentions(p_content text, p_actor_id uuid, p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  mentioned_username text;
  recipient uuid;
  actor_username text;
begin
  select username into actor_username from public.profiles where id = p_actor_id;
  for mentioned_username in
    select distinct lower(mention[1])
      from regexp_matches(coalesce(p_content, ''), '@([a-zA-Z0-9._]{3,20})', 'g') as mention
  loop
    select id into recipient
      from public.profiles
     where lower(username) = mentioned_username
     limit 1;
    perform public.create_social_notification(
      recipient,
      p_actor_id,
      'mention',
      'Bir gönderide etiketlendin',
      '@' || coalesce(actor_username, 'Bir kullanıcı') || ' seni etiketledi.',
      'post',
      p_post_id
    );
  end loop;
end;
$$;

create or replace function public.notify_post_mentions_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_post_mentions(new.body, new.author_id, new.id);
  return new;
end;
$$;

drop trigger if exists posts_notify_mentions on public.posts;
create trigger posts_notify_mentions
  after insert on public.posts
  for each row execute function public.notify_post_mentions_trigger();

create or replace function public.notify_like_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  actor_username text;
begin
  select author_id into owner_id from public.posts where id = new.post_id;
  select username into actor_username from public.profiles where id = new.user_id;
  perform public.create_social_notification(
    owner_id,
    new.user_id,
    'like',
    'Gönderin beğenildi',
    '@' || coalesce(actor_username, 'Bir kullanıcı') || ' gönderini beğendi.',
    'post',
    new.post_id
  );
  return new;
end;
$$;

drop trigger if exists likes_notify_author on public.likes;
create trigger likes_notify_author
  after insert on public.likes
  for each row execute function public.notify_like_trigger();

create or replace function public.notify_comment_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  parent_author_id uuid;
  actor_username text;
begin
  select author_id into owner_id from public.posts where id = new.post_id;
  select username into actor_username from public.profiles where id = new.author_id;
  if new.parent_comment_id is null then
    perform public.create_social_notification(
      owner_id,
      new.author_id,
      'comment',
      'Gönderine yorum yapıldı',
      '@' || coalesce(actor_username, 'Bir kullanıcı') || ' yorum yaptı.',
      'post',
      new.post_id
    );
  else
    select author_id into parent_author_id
      from public.comments
     where id = new.parent_comment_id
       and post_id = new.post_id;
    if parent_author_id is distinct from owner_id then
      perform public.create_social_notification(
        owner_id,
        new.author_id,
        'comment',
        'Gönderine yeni yanıt',
        '@' || coalesce(actor_username, 'Bir kullanıcı') || ' gönderindeki bir yoruma yanıt verdi.',
        'post',
        new.post_id
      );
    end if;
    perform public.create_social_notification(
      parent_author_id,
      new.author_id,
      'reply',
      'Yorumuna yanıt verildi',
      '@' || coalesce(actor_username, 'Bir kullanıcı') || ' yorumuna yanıt verdi.',
      'post',
      new.post_id
    );
  end if;
  perform public.notify_post_mentions(new.body, new.author_id, new.post_id);
  return new;
end;
$$;

drop trigger if exists comments_notify_author on public.comments;
create trigger comments_notify_author
  after insert on public.comments
  for each row execute function public.notify_comment_trigger();

create or replace function public.notify_follow_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_username text;
begin
  select username into actor_username from public.profiles where id = new.follower_id;
  perform public.create_social_notification(
    new.following_id,
    new.follower_id,
    'follow',
    'Yeni takipçin var',
    '@' || coalesce(actor_username, 'Bir kullanıcı') || ' seni takip etmeye başladı.',
    'profile',
    new.follower_id
  );
  return new;
end;
$$;

drop trigger if exists follows_notify_user on public.follows;
create trigger follows_notify_user
  after insert on public.follows
  for each row execute function public.notify_follow_trigger();

create or replace function public.notify_message_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  actor_username text;
  message_type text;
  message_title text;
begin
  select case
           when initiator_id = new.sender_id then recipient_id
           else initiator_id
         end
    into recipient
    from public.conversations
   where id = new.conversation_id;
  select username into actor_username from public.profiles where id = new.sender_id;
  if new.attachment->>'kind' = 'listing' then
    if new.body ilike '% teklif ediyorum.%' then
      return new;
    end if;
    message_type := 'listing_inquiry';
    message_title := 'İlanın için yeni mesaj';
  else
    message_type := 'message';
    message_title := 'Yeni mesajın var';
  end if;
  perform public.create_social_notification(
    recipient,
    new.sender_id,
    message_type,
    message_title,
    '@' || coalesce(actor_username, 'Bir kullanıcı') || ' sana mesaj gönderdi.',
    'chat',
    new.conversation_id
  );
  return new;
end;
$$;

drop trigger if exists messages_notify_recipient on public.messages;
create trigger messages_notify_recipient
  after insert on public.messages
  for each row execute function public.notify_message_trigger();

create or replace function public.notify_offer_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  seller_id uuid;
  actor_username text;
  listing_title text;
begin
  select l.seller_id, l.title into seller_id, listing_title
    from public.listings l
   where l.id = new.listing_id;
  select username into actor_username from public.profiles where id = new.buyer_id;
  perform public.create_social_notification(
    seller_id,
    new.buyer_id,
    'listing_offer',
    'İlanına yeni teklif geldi',
    '@' || coalesce(actor_username, 'Bir kullanıcı') || ' ' || coalesce(listing_title, 'ilanın') || ' için teklif verdi.',
    'listing',
    new.listing_id
  );
  return new;
end;
$$;

drop trigger if exists offers_notify_seller on public.offers;
create trigger offers_notify_seller
  after insert on public.offers
  for each row execute function public.notify_offer_trigger();

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end;
$$;

notify pgrst, 'reload schema';
