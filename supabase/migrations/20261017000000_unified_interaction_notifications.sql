-- Add notification aliases, interaction triggers, and listing likes.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  title text not null,
  body text not null,
  related_type text,
  related_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.notifications
  drop constraint if exists notifications_type_check,
  add constraint notifications_type_check
    check (type in (
      'like', 'comment', 'reply', 'mention', 'message', 'offer',
      'listing_inquiry', 'listing_offer', 'follow', 'follow_request'
    )),
  drop constraint if exists notifications_related_type_check,
  add constraint notifications_related_type_check
    check (related_type in ('post', 'chat', 'profile', 'listing', 'confession'));

alter table public.notifications
  add column if not exists user_id uuid generated always as (recipient_id) stored,
  add column if not exists target_id uuid generated always as (related_id) stored,
  add column if not exists is_read boolean generated always as (read_at is not null) stored;

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (recipient_id)
  where read_at is null;
alter table public.notifications enable row level security;
grant select, update on public.notifications to authenticated;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated using (recipient_id = auth.uid());
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

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
      recipient, p_actor_id, 'mention', 'Bir gönderide etiketlendin',
      '@' || coalesce(actor_username, 'Bir kullanıcı') || ' seni etiketledi.',
      'post', p_post_id
    );
  end loop;
end;
$$;

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

create or replace function public.notify_post_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  parent_author_id uuid;
  actor_username text;
  comment_snippet text;
begin
  select author_id into owner_id from public.posts where id = new.post_id;
  select username into actor_username from public.profiles where id = new.author_id;
  comment_snippet := left(trim(new.body), 120);

  if new.parent_comment_id is null then
    perform public.create_social_notification(
      owner_id, new.author_id, 'comment', 'Gönderine yorum yapıldı',
      '@' || coalesce(actor_username, 'Bir kullanıcı') || ' yorum yaptı: ' || comment_snippet,
      'post', new.post_id
    );
  else
    select author_id into parent_author_id
      from public.comments
     where id = new.parent_comment_id and post_id = new.post_id;
    if parent_author_id is distinct from owner_id then
      perform public.create_social_notification(
        owner_id, new.author_id, 'comment', 'Gönderine yeni yanıt',
        '@' || coalesce(actor_username, 'Bir kullanıcı') || ' yorum yaptı: ' || comment_snippet,
        'post', new.post_id
      );
    end if;
    perform public.create_social_notification(
      parent_author_id, new.author_id, 'reply', 'Yorumuna yanıt verildi',
      '@' || coalesce(actor_username, 'Bir kullanıcı') || ' yorumuna yanıt verdi: ' || comment_snippet,
      'post', new.post_id
    );
  end if;
  perform public.notify_post_mentions(new.body, new.author_id, new.post_id);
  return new;
end;
$$;

drop trigger if exists comments_notify_author on public.comments;
create trigger comments_notify_author
  after insert on public.comments
  for each row execute function public.notify_post_comment();

create or replace function public.notify_confession_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_username text;
  comment_snippet text;
  participant_id uuid;
begin
  select username into actor_username from public.profiles where id = new.user_id;
  comment_snippet := left(trim(new.comment_text), 120);

  for participant_id in
    select distinct participants.user_id
      from (
        select cc.user_id
          from public.confession_comments cc
         where cc.confession_id = new.confession_id
        union
        select q.user_id
          from public.confession_quota_tracker q
         where q.confession_id = new.confession_id
      ) as participants
     where participants.user_id <> new.user_id
  loop
    perform public.create_social_notification(
      participant_id, new.user_id, 'comment', 'İtirafa yeni yorum yapıldı',
      '@' || coalesce(actor_username, 'Bir kullanıcı') || ' yorum yaptı: ' || comment_snippet,
      'confession', new.confession_id
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists confession_comments_notify_participants on public.confession_comments;
create trigger confession_comments_notify_participants
  after insert on public.confession_comments
  for each row execute function public.notify_confession_comment();

create or replace function public.notify_follow_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_username text;
begin
  select username into requester_username
    from public.profiles
   where id = new.follower_id;
  perform public.create_social_notification(
    new.following_id, new.follower_id, 'follow_request', 'Yeni takip isteği',
    '@' || coalesce(requester_username, 'Bir kullanıcı') || ' seni takip etmek istiyor.',
    'profile', new.follower_id
  );
  return new;
end;
$$;

drop trigger if exists follow_requests_notify_recipient on public.follow_requests;
create trigger follow_requests_notify_recipient
  after insert on public.follow_requests
  for each row execute function public.notify_follow_request();

create or replace function public.notify_offer()
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
    from public.listings l where l.id = new.listing_id;
  select username into actor_username from public.profiles where id = new.buyer_id;
  perform public.create_social_notification(
    seller_id, new.buyer_id, 'offer', 'İlanına yeni teklif geldi',
    '@' || coalesce(actor_username, 'Bir kullanıcı') || ' ' ||
      coalesce(listing_title, 'ilanın') || ' için teklif verdi.',
    'listing', new.listing_id
  );
  return new;
end;
$$;

drop trigger if exists offers_notify_seller on public.offers;
create trigger offers_notify_seller
  after insert on public.offers
  for each row execute function public.notify_offer();

create or replace function public.notify_listing_like()
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
    from public.listings l where l.id = new.listing_id;
  select username into actor_username from public.profiles where id = new.user_id;
  perform public.create_social_notification(
    seller_id, new.user_id, 'like', 'İlanın beğenildi',
    '@' || coalesce(actor_username, 'Bir kullanıcı') || ' ' ||
      coalesce(listing_title, 'ilanını') || ' beğendi.',
    'listing', new.listing_id
  );
  return new;
end;
$$;

drop trigger if exists listing_likes_notify_seller on public.listing_likes;
create trigger listing_likes_notify_seller
  after insert on public.listing_likes
  for each row execute function public.notify_listing_like();

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then
  null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.listing_likes;
exception when duplicate_object then
  null;
end;
$$;

notify pgrst, 'reload schema';
