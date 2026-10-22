-- =====================================================================
-- Campus Connect – Supabase şeması
-- Supabase paneli > SQL Editor > New query > bu dosyanın TAMAMINI yapıştır > Run
-- Tekrar çalıştırmak güvenlidir (idempotent).
-- =====================================================================

-- ---------- Tablolar ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  username text not null unique,
  bio text,
  phone text,
  avatar_url text,
  university text,
  department text,
  is_private boolean not null default false,
  dm_privacy text not null default 'everyone' check (dm_privacy in ('everyone', 'followers', 'nobody')),
  story_reply_privacy text not null default 'everyone' check (story_reply_privacy in ('everyone', 'followers', 'nobody')),
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9._]{3,20}$')
);
alter table public.profiles add column if not exists dm_privacy text not null default 'everyone';
alter table public.profiles add column if not exists story_reply_privacy text not null default 'everyone';
alter table public.profiles add column if not exists university text;
alter table public.profiles add column if not exists department text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles
  drop constraint if exists profiles_dm_privacy_check,
  add constraint profiles_dm_privacy_check check (dm_privacy in ('everyone', 'followers', 'nobody')),
  drop constraint if exists profiles_story_reply_privacy_check,
  add constraint profiles_story_reply_privacy_check
    check (story_reply_privacy in ('everyone', 'followers', 'nobody'));

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('Spam', 'Sahte hesap', 'Taciz veya zorbalık', 'Uygunsuz içerik')),
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  check (reporter_id <> reported_user_id)
);
create index if not exists user_reports_status_created_idx
  on public.user_reports (status, created_at desc);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  media_url text,
  media_type text check (media_type in ('image','pdf')),
  file_name text,
  is_archived boolean not null default false,
  comments_disabled boolean not null default false,
  hide_like_count boolean not null default false,
  created_at timestamptz not null default now(),
  check (body <> '' or media_url is not null)
);
alter table public.posts add column if not exists is_archived boolean not null default false;
alter table public.posts add column if not exists comments_disabled boolean not null default false;
alter table public.posts add column if not exists hide_like_count boolean not null default false;

create table if not exists public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) > 0),
  parent_comment_id uuid references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_edited boolean not null default false
);
alter table public.comments add column if not exists parent_comment_id uuid references public.comments(id) on delete cascade;
alter table public.comments add column if not exists updated_at timestamptz not null default now();
alter table public.comments add column if not exists is_edited boolean not null default false;

create or replace function public.set_comment_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if new.body is distinct from old.body then
    new.is_edited := true;
  end if;
  return new;
end $$;

drop trigger if exists comments_set_updated_at on public.comments;
create trigger comments_set_updated_at before update on public.comments
  for each row execute function public.set_comment_updated_at();

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  media_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.confessions (
  id uuid primary key default gen_random_uuid(),
  university_id text not null,
  content text not null check (length(trim(content)) between 5 and 2000),
  is_anonymous boolean not null default true check (is_anonymous),
  created_at timestamptz not null default now(),
  weekly_quota_tracker integer not null default 0 check (weekly_quota_tracker between 0 and 2)
);

create table if not exists public.confession_quota_tracker (
  confession_id uuid primary key references public.confessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists confession_quota_tracker_user_created_idx
  on public.confession_quota_tracker (user_id, created_at desc);

create table if not exists public.confession_comments (
  id uuid primary key default gen_random_uuid(),
  confession_id uuid not null references public.confessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  comment_text text not null check (length(trim(comment_text)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create table if not exists public.confession_likes (
  confession_id uuid not null references public.confessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (confession_id, user_id)
);
create index if not exists confession_comments_confession_created_idx
  on public.confession_comments (confession_id, created_at);

create or replace function public.create_confession(p_university_id text, p_content text)
returns uuid language plpgsql security definer set search_path = public as $$
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
  select count(*)::integer into recent_count
    from public.confession_quota_tracker
   where user_id = current_user_id
     and created_at >= now() - interval '7 days';
  if recent_count >= 2 then
    raise exception using errcode = 'P0001', message = 'weekly_quota_exceeded';
  end if;

  insert into public.confessions (university_id, content, is_anonymous, weekly_quota_tracker)
  values (trim(p_university_id), trim(p_content), true, recent_count + 1)
  returning id into new_confession_id;
  insert into public.confession_quota_tracker (confession_id, user_id)
  values (new_confession_id, current_user_id);
  return new_confession_id;
end $$;

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  price numeric(12,2) not null check (price >= 0),
  category text not null default 'Diğer',
  condition text not null default 'İyi',
  image_url text,
  status text not null default 'active' check (status in ('active','sold')),
  created_at timestamptz not null default now()
);
alter table public.listings add column if not exists pdf_url text;
alter table public.listings add column if not exists pdf_file_name text;
alter table public.listings add column if not exists pdf_size bigint;
alter table public.listings add column if not exists university_name text;
alter table public.listings add column if not exists department_name text;
alter table public.listings add column if not exists grade_level text;
alter table public.listings drop constraint if exists listings_status_check;
alter table public.listings add constraint listings_status_check check (status in ('active','sold','archived'));

insert into storage.buckets (id, name, public, allowed_mime_types)
values ('marketplace-pdfs', 'marketplace-pdfs', true, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists marketplace_pdfs_upload on storage.objects;
create policy marketplace_pdfs_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'marketplace-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists marketplace_pdfs_delete on storage.objects;
create policy marketplace_pdfs_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'marketplace-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.listing_likes (
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (listing_id, user_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  initiator_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','blocked')),
  last_message text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (initiator_id <> recipient_id)
);
create table if not exists public.conversation_preferences (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  is_muted boolean not null default false,
  is_archived boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create unique index if not exists conversations_pair_idx
  on public.conversations (least(initiator_id, recipient_id), greatest(initiator_id, recipient_id));

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  attachment jsonb,
  photo_views_used integer not null default 0 check (photo_views_used >= 0),
  photo_viewing_by uuid references public.profiles(id) on delete set null,
  photo_viewing_until timestamptz,
  created_at timestamptz not null default now(),
  check (body <> '' or attachment is not null)
);
create index if not exists messages_conv_idx on public.messages (conversation_id, created_at);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('like','comment','reply','mention','message','offer','listing_inquiry','listing_offer','follow','follow_request')),
  title text not null,
  body text not null,
  related_type text check (related_type in ('post','chat','profile','listing','confession')),
  related_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  user_id uuid generated always as (recipient_id) stored,
  target_id uuid generated always as (related_id) stored,
  is_read boolean generated always as (read_at is not null) stored
);
alter table public.notifications
  drop constraint if exists notifications_type_check,
  add constraint notifications_type_check
    check (type in ('like','comment','reply','mention','message','offer','listing_inquiry','listing_offer','follow','follow_request')),
  drop constraint if exists notifications_related_type_check,
  add constraint notifications_related_type_check
    check (related_type in ('post','chat','profile','listing','confession'));
alter table public.notifications
  add column if not exists user_id uuid generated always as (recipient_id) stored,
  add column if not exists target_id uuid generated always as (related_id) stored,
  add column if not exists is_read boolean generated always as (read_at is not null) stored;
create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (recipient_id) where read_at is null;

-- ---------- Yeni kullanıcı => profil ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, username, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    lower(coalesce(nullif(new.raw_user_meta_data->>'username', ''), 'user' || substr(replace(new.id::text, '-', ''), 1, 8))),
    nullif(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Zaten kayıtlı kullanıcılar için profil oluştur
insert into public.profiles (id, full_name, username)
select id, coalesce(raw_user_meta_data->>'full_name', ''), 'user' || substr(replace(id::text, '-', ''), 1, 8)
from auth.users
on conflict (id) do nothing;

-- ---------- Yardımcı fonksiyonlar ----------
create or replace function public.username_available(u text)
returns boolean language sql security definer set search_path = public stable as $$
  select not exists (select 1 from public.profiles where username = lower(u));
$$;

create or replace function public.users_block_each_other(user_a uuid, user_b uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select case
    when auth.uid() is null or auth.uid() not in (user_a, user_b) then false
    else exists (
      select 1 from public.blocks b
       where (b.blocker_id = user_a and b.blocked_id = user_b)
          or (b.blocker_id = user_b and b.blocked_id = user_a)
    )
  end;
$$;
revoke all on function public.users_block_each_other(uuid, uuid) from public, anon;
grant execute on function public.users_block_each_other(uuid, uuid) to authenticated;

-- Sohbet başlat: karşı taraf seni takip ediyorsa 'accepted', etmiyorsa 'pending' (mesaj isteği)
create or replace function public.start_conversation(other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; st text; target_dm_privacy text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if other = auth.uid() then raise exception 'cannot message yourself'; end if;
  select p.dm_privacy into target_dm_privacy from public.profiles p where p.id = other;
  if not found then raise exception 'user not found'; end if;
  if public.users_block_each_other(auth.uid(), other) then
    raise exception 'Bu kullanıcıyla engelleme nedeniyle sohbet başlatılamıyor.';
  end if;
  if target_dm_privacy = 'nobody'
     or (target_dm_privacy = 'followers' and not exists (
       select 1 from public.follows f
        where f.follower_id = auth.uid() and f.following_id = other
     )) then
    raise exception 'Kullanıcının mesaj gizliliği ayarları sohbet başlatmanıza izin vermiyor.';
  end if;
  select c.id, c.status into cid, st from public.conversations c
   where (c.initiator_id = auth.uid() and c.recipient_id = other)
      or (c.initiator_id = other and c.recipient_id = auth.uid())
   limit 1;
  if cid is not null then return cid; end if;
  if exists (select 1 from public.follows f where f.follower_id = other and f.following_id = auth.uid()) then
    st := 'accepted';
  else
    st := 'pending';
  end if;
  insert into public.conversations (initiator_id, recipient_id, status)
  values (auth.uid(), other, st) returning id into cid;
  return cid;
end $$;
revoke all on function public.start_conversation(uuid) from public, anon;
grant execute on function public.start_conversation(uuid) to authenticated;

create or replace function public.touch_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations
     set last_message_at = new.created_at,
         last_message = case when new.body <> '' then left(new.body, 80)
                             else coalesce(new.attachment->>'title', 'Ek') end
   where id = new.conversation_id;
  return new;
end $$;

drop trigger if exists on_message_insert on public.messages;
create trigger on_message_insert after insert on public.messages
  for each row execute function public.touch_conversation();

create or replace function public.refresh_conversation_after_message_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations c
     set last_message = (
           select case when m.body <> '' then left(m.body, 80)
                       else coalesce(m.attachment->>'title', 'Ek') end
             from public.messages m
            where m.conversation_id = old.conversation_id
            order by m.created_at desc
            limit 1
         ),
         last_message_at = coalesce(
           (
             select m.created_at
               from public.messages m
              where m.conversation_id = old.conversation_id
              order by m.created_at desc
              limit 1
           ),
           c.created_at
         )
   where c.id = old.conversation_id;
  return old;
end $$;

drop trigger if exists messages_refresh_conversation_after_delete on public.messages;
create trigger messages_refresh_conversation_after_delete
  after delete on public.messages
  for each row execute function public.refresh_conversation_after_message_delete();

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.user_reports enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.stories enable row level security;
alter table public.confessions enable row level security;
alter table public.confession_quota_tracker enable row level security;
alter table public.confession_comments enable row level security;
alter table public.confession_likes enable row level security;
alter table public.listings enable row level security;
alter table public.offers enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.conversation_preferences enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- follows
drop policy if exists follows_select on public.follows;
create policy follows_select on public.follows for select to authenticated using (true);
drop policy if exists follows_insert on public.follows;
create policy follows_insert on public.follows for insert to authenticated with check (
  follower_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = following_id and p.is_private = false
  )
);
drop policy if exists follows_private_follow_guard on public.follows;
create policy follows_private_follow_guard on public.follows
  as restrictive for insert to authenticated
  with check (
    follower_id = auth.uid()
    and exists (
      select 1 from public.profiles p
       where p.id = following_id and p.is_private = false
    )
  );
drop policy if exists follows_delete on public.follows;
create policy follows_delete on public.follows for delete to authenticated using (follower_id = auth.uid());

-- blocks
drop policy if exists blocks_select on public.blocks;
create policy blocks_select on public.blocks for select to authenticated using (blocker_id = auth.uid());
drop policy if exists blocks_insert on public.blocks;
create policy blocks_insert on public.blocks for insert to authenticated with check (blocker_id = auth.uid());
drop policy if exists blocks_delete on public.blocks;
create policy blocks_delete on public.blocks for delete to authenticated using (blocker_id = auth.uid());

-- user reports
drop policy if exists user_reports_insert_own on public.user_reports;
create policy user_reports_insert_own on public.user_reports
  for insert to authenticated with check (reporter_id = auth.uid());
drop policy if exists user_reports_select_own on public.user_reports;
create policy user_reports_select_own on public.user_reports
  for select to authenticated using (reporter_id = auth.uid());

-- posts (gizli hesabın gönderilerini yalnızca takipçiler ve kendisi görür)
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts for select to authenticated using (
  author_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = author_id and not p.is_private)
  or exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = author_id)
);
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts for insert to authenticated with check (author_id = auth.uid());
drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts for delete to authenticated using (author_id = auth.uid());
drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

-- likes
drop policy if exists likes_select on public.likes;
create policy likes_select on public.likes for select to authenticated using (exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists likes_insert on public.likes;
create policy likes_insert on public.likes for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists likes_delete on public.likes;
create policy likes_delete on public.likes for delete to authenticated using (user_id = auth.uid());

-- Listing likes
drop policy if exists listing_likes_select on public.listing_likes;
create policy listing_likes_select on public.listing_likes for select to authenticated using (true);
drop policy if exists listing_likes_insert on public.listing_likes;
create policy listing_likes_insert on public.listing_likes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists listing_likes_delete on public.listing_likes;
create policy listing_likes_delete on public.listing_likes for delete to authenticated using (user_id = auth.uid());

-- comments
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select to authenticated using (exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.posts p
    where p.id = post_id and p.comments_disabled = false
  )
);
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete to authenticated using (
  author_id = auth.uid()
  or exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
);
drop policy if exists comments_update on public.comments;
create policy comments_update on public.comments for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

-- notifications
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated using (recipient_id = auth.uid());
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- stories
drop policy if exists stories_select on public.stories;
create policy stories_select on public.stories for select to authenticated using (true);
drop policy if exists stories_insert on public.stories;
create policy stories_insert on public.stories for insert to authenticated with check (author_id = auth.uid());
drop policy if exists stories_delete on public.stories;
create policy stories_delete on public.stories for delete to authenticated using (author_id = auth.uid());

-- Confessions: public-facing rows never store the author's identity; quota ownership is private.
drop policy if exists confessions_select on public.confessions;
create policy confessions_select on public.confessions for select to authenticated using (true);
drop policy if exists confession_comments_select on public.confession_comments;
create policy confession_comments_select on public.confession_comments for select to authenticated using (true);
drop policy if exists confession_comments_insert on public.confession_comments;
create policy confession_comments_insert on public.confession_comments for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists confession_comments_delete on public.confession_comments;
create policy confession_comments_delete on public.confession_comments for delete to authenticated
  using (user_id = auth.uid());
drop policy if exists confession_likes_select on public.confession_likes;
create policy confession_likes_select on public.confession_likes for select to authenticated using (true);
drop policy if exists confession_likes_insert on public.confession_likes;
create policy confession_likes_insert on public.confession_likes for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists confession_likes_delete on public.confession_likes;
create policy confession_likes_delete on public.confession_likes for delete to authenticated
  using (user_id = auth.uid());
revoke all on public.confession_quota_tracker from anon, authenticated;
grant select, insert, delete on public.confession_likes to authenticated;
revoke all on function public.create_confession(text, text) from public, anon;
grant execute on function public.create_confession(text, text) to authenticated;

-- listings
drop policy if exists listings_select on public.listings;
create policy listings_select on public.listings for select to authenticated using (true);
drop policy if exists listings_insert on public.listings;
create policy listings_insert on public.listings for insert to authenticated with check (seller_id = auth.uid());
drop policy if exists listings_update on public.listings;
create policy listings_update on public.listings for update to authenticated using (seller_id = auth.uid()) with check (seller_id = auth.uid());
drop policy if exists listings_delete on public.listings;
create policy listings_delete on public.listings for delete to authenticated using (seller_id = auth.uid());

-- offers
drop policy if exists offers_select on public.offers;
create policy offers_select on public.offers for select to authenticated using (
  buyer_id = auth.uid()
  or exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid())
);
drop policy if exists offers_insert on public.offers;
create policy offers_insert on public.offers for insert to authenticated with check (buyer_id = auth.uid());

-- conversations (oluşturma yalnızca start_conversation() ile)
drop policy if exists conv_select on public.conversations;
create policy conv_select on public.conversations for select to authenticated using (auth.uid() in (initiator_id, recipient_id));
drop policy if exists conv_update on public.conversations;
create policy conv_update on public.conversations for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
drop policy if exists conv_block_guard_select on public.conversations;
create policy conv_block_guard_select on public.conversations
  as restrictive for select to authenticated
  using (not public.users_block_each_other(initiator_id, recipient_id));
drop policy if exists conv_block_guard_update on public.conversations;
create policy conv_block_guard_update on public.conversations
  as restrictive for update to authenticated
  using (not public.users_block_each_other(initiator_id, recipient_id))
  with check (not public.users_block_each_other(initiator_id, recipient_id));

-- Per-user conversation controls
drop policy if exists conversation_preferences_select on public.conversation_preferences;
create policy conversation_preferences_select on public.conversation_preferences
  for select to authenticated using (user_id = auth.uid());
drop policy if exists conversation_preferences_insert on public.conversation_preferences;
create policy conversation_preferences_insert on public.conversation_preferences
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() in (c.initiator_id, c.recipient_id)
    )
  );
drop policy if exists conversation_preferences_update on public.conversation_preferences;
create policy conversation_preferences_update on public.conversation_preferences
  for update to authenticated using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() in (c.initiator_id, c.recipient_id)
    )
  );
drop policy if exists conversation_preferences_delete on public.conversation_preferences;
create policy conversation_preferences_delete on public.conversation_preferences
  for delete to authenticated using (user_id = auth.uid());

-- messages
drop policy if exists msg_select on public.messages;
create policy msg_select on public.messages for select to authenticated using (
  exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.initiator_id, c.recipient_id))
);
drop policy if exists msg_insert on public.messages;
create policy msg_insert on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and auth.uid() in (c.initiator_id, c.recipient_id)
      and (c.status = 'accepted' or (c.status = 'pending' and c.initiator_id = auth.uid()))
  )
);
drop policy if exists msg_block_guard_select on public.messages;
create policy msg_block_guard_select on public.messages
  as restrictive for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
       where c.id = conversation_id
         and not public.users_block_each_other(c.initiator_id, c.recipient_id)
    )
  );
drop policy if exists msg_privacy_guard_insert on public.messages;
create policy msg_privacy_guard_insert on public.messages
  as restrictive for insert to authenticated
  with check (
    exists (
      select 1
        from public.conversations c
        join public.profiles recipient on recipient.id = c.recipient_id
       where c.id = conversation_id
         and not public.users_block_each_other(c.initiator_id, c.recipient_id)
         and (
           c.status = 'accepted'
           or (
             c.status = 'pending'
             and c.initiator_id = auth.uid()
             and (
               recipient.dm_privacy = 'everyone'
               or (
                 recipient.dm_privacy = 'followers'
                 and exists (
                   select 1 from public.follows f
                    where f.follower_id = c.initiator_id
                      and f.following_id = c.recipient_id
                 )
               )
             )
           )
         )
    )
  );
drop policy if exists msg_delete_participant on public.messages;
create policy msg_delete_participant on public.messages for delete to authenticated using (
  sender_id = auth.uid()
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id and auth.uid() in (c.initiator_id, c.recipient_id)
  )
);
drop policy if exists msg_delete_own_sender_only on public.messages;
create policy msg_delete_own_sender_only on public.messages
  as restrictive for delete to authenticated using (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() in (c.initiator_id, c.recipient_id)
    )
  );

-- ---------- Yetkiler ----------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, update on public.notifications to authenticated;
grant select, insert, update, delete on public.conversation_preferences to authenticated;
grant delete on public.messages to authenticated;
revoke all on public.confession_quota_tracker from anon, authenticated;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.start_conversation(uuid) to authenticated;

-- ---------- Anlık mesajlaşma (Realtime) ----------
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.follows;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.posts;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.listing_likes;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.confession_likes;
exception when duplicate_object then null;
end $$;

create or replace function public.create_social_notification(
  p_recipient_id uuid,
  p_actor_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_related_type text,
  p_related_id uuid
)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (recipient_id, actor_id, type, title, body, related_type, related_id)
  select p_recipient_id, p_actor_id, p_type, p_title, p_body, p_related_type, p_related_id
   where p_recipient_id is not null and p_recipient_id is distinct from p_actor_id;
$$;
revoke all on function public.create_social_notification(uuid, uuid, text, text, text, text, uuid)
  from public, anon, authenticated;

create or replace function public.notify_post_mentions(p_content text, p_actor_id uuid, p_post_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare mentioned_username text; recipient uuid; actor_username text;
begin
  select username into actor_username from public.profiles where id = p_actor_id;
  for mentioned_username in
    select distinct lower(mention[1])
      from regexp_matches(coalesce(p_content, ''), '@([a-zA-Z0-9._]{3,20})', 'g') as mention
  loop
    select id into recipient from public.profiles where lower(username) = mentioned_username limit 1;
    perform public.create_social_notification(
      recipient, p_actor_id, 'mention', 'Bir gönderide etiketlendin',
      '@' || coalesce(actor_username, 'Bir kullanıcı') || ' seni etiketledi.', 'post', p_post_id
    );
  end loop;
end;
$$;

create or replace function public.notify_social_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  recipient uuid;
  owner_id uuid;
  parent_author_id uuid;
  actor_id uuid;
  actor_username text;
  listing_title text;
  activity_type text;
  activity_title text;
  activity_body text;
  target_type text;
  target_id uuid;
begin
  if tg_table_name = 'likes' then
    select author_id into recipient from public.posts where id = new.post_id;
    actor_id := new.user_id;
    select username into actor_username from public.profiles where id = actor_id;
    activity_type := 'like'; activity_title := 'Gönderin beğenildi';
    activity_body := '@' || coalesce(actor_username, 'Bir kullanıcı') || ' gönderini beğendi.';
    target_type := 'post'; target_id := new.post_id;
  elsif tg_table_name = 'comments' then
    select author_id into owner_id from public.posts where id = new.post_id;
    actor_id := new.author_id;
    select username into actor_username from public.profiles where id = actor_id;
    target_type := 'post'; target_id := new.post_id;
    if new.parent_comment_id is null then
      perform public.create_social_notification(
        owner_id, actor_id, 'comment', 'Gönderine yorum yapıldı',
        '@' || coalesce(actor_username, 'Bir kullanıcı') || ' yorum yaptı: ' || left(trim(new.body), 120),
        target_type, target_id
      );
    else
      select author_id into parent_author_id from public.comments
       where id = new.parent_comment_id and post_id = new.post_id;
      if parent_author_id is distinct from owner_id then
        perform public.create_social_notification(
          owner_id, actor_id, 'comment', 'Gönderine yeni yanıt',
          '@' || coalesce(actor_username, 'Bir kullanıcı') || ' yorum yaptı: ' || left(trim(new.body), 120),
          target_type, target_id
        );
      end if;
      perform public.create_social_notification(
        parent_author_id, actor_id, 'reply', 'Yorumuna yanıt verildi',
        '@' || coalesce(actor_username, 'Bir kullanıcı') || ' yorumuna yanıt verdi: ' || left(trim(new.body), 120),
        target_type, target_id
      );
    end if;
    perform public.notify_post_mentions(new.body, actor_id, new.post_id);
    return new;
  elsif tg_table_name = 'posts' then
    perform public.notify_post_mentions(new.body, new.author_id, new.id);
    return new;
  elsif tg_table_name = 'follows' then
    actor_id := new.follower_id; recipient := new.following_id;
    select username into actor_username from public.profiles where id = actor_id;
    activity_type := 'follow'; activity_title := 'Yeni takipçin var';
    activity_body := '@' || coalesce(actor_username, 'Bir kullanıcı') || ' seni takip etmeye başladı.';
    target_type := 'profile'; target_id := actor_id;
  elsif tg_table_name = 'messages' then
    select case when initiator_id = new.sender_id then recipient_id else initiator_id end
      into recipient from public.conversations where id = new.conversation_id;
    actor_id := new.sender_id;
    select username into actor_username from public.profiles where id = actor_id;
    if new.attachment->>'kind' = 'listing' and new.body ilike '% teklif ediyorum.%' then return new; end if;
    activity_type := case when new.attachment->>'kind' = 'listing' then 'listing_inquiry' else 'message' end;
    activity_title := case when activity_type = 'listing_inquiry' then 'İlanın için yeni mesaj' else 'Yeni mesajın var' end;
    activity_body := '@' || coalesce(actor_username, 'Bir kullanıcı') || ' sana mesaj gönderdi.';
    target_type := 'chat'; target_id := new.conversation_id;
  elsif tg_table_name = 'offers' then
    select seller_id, title into recipient, listing_title from public.listings where id = new.listing_id;
    actor_id := new.buyer_id;
    select username into actor_username from public.profiles where id = actor_id;
    activity_type := 'offer'; activity_title := 'İlanına yeni teklif geldi';
    activity_body := '@' || coalesce(actor_username, 'Bir kullanıcı') || ' ' || coalesce(listing_title, 'ilanın') || ' için teklif verdi.';
    target_type := 'listing'; target_id := new.listing_id;
  end if;

  perform public.create_social_notification(
    recipient, actor_id, activity_type, activity_title, activity_body, target_type, target_id
  );
  return new;
end;
$$;

drop trigger if exists posts_notify_mentions on public.posts;
create trigger posts_notify_mentions after insert on public.posts
  for each row execute function public.notify_social_activity();
drop trigger if exists likes_notify_author on public.likes;
create trigger likes_notify_author after insert on public.likes
  for each row execute function public.notify_social_activity();
drop trigger if exists comments_notify_author on public.comments;
create trigger comments_notify_author after insert on public.comments
  for each row execute function public.notify_social_activity();
drop trigger if exists follows_notify_user on public.follows;
create trigger follows_notify_user after insert on public.follows
  for each row execute function public.notify_social_activity();
drop trigger if exists messages_notify_recipient on public.messages;
create trigger messages_notify_recipient after insert on public.messages
  for each row execute function public.notify_social_activity();
drop trigger if exists offers_notify_seller on public.offers;
create trigger offers_notify_seller after insert on public.offers
  for each row execute function public.notify_social_activity();

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

create or replace function public.notify_listing_like()
returns trigger language plpgsql security definer set search_path = public as $$
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
end $$;

drop trigger if exists listing_likes_notify_seller on public.listing_likes;
create trigger listing_likes_notify_seller after insert on public.listing_likes
  for each row execute function public.notify_listing_like();

notify pgrst, 'reload schema';

-- ---------- Bulut medya ve PDF erişim istekleri ----------
insert into storage.buckets (id, name, public, allowed_mime_types)
values (
  'campus-media',
  'campus-media',
  false,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do update
set public = false,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_read_chat_media(object_path text)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $$
  select exists (
    select 1
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
     where m.attachment->>'kind' = 'image'
       and m.attachment->>'image' = object_path
       and m.sender_id::text = (storage.foldername(object_path))[1]
       and (storage.foldername(object_path))[2] = 'messages'
       and (
         m.sender_id = auth.uid()
         or (
           auth.uid() in (c.initiator_id, c.recipient_id)
           and (
             coalesce(m.attachment->>'view_mode', 'normal') = 'normal'
             or (
               m.photo_viewing_by = auth.uid()
               and m.photo_viewing_until > now()
             )
           )
         )
       )
  );
$$;

revoke all on function public.can_read_chat_media(text) from public, anon;
grant execute on function public.can_read_chat_media(text) to authenticated;

create or replace function public.open_ephemeral_chat_photo(p_message_id uuid)
returns table (
  image_path text,
  view_mode text,
  duration_seconds integer,
  views_remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  message_row public.messages%rowtype;
  mode_value text;
  max_views integer;
  duration_value integer;
begin
  select m.* into message_row
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
   where m.id = p_message_id
     and m.sender_id <> auth.uid()
     and auth.uid() in (c.initiator_id, c.recipient_id)
     and c.status = 'accepted'
     and not public.users_block_each_other(c.initiator_id, c.recipient_id)
   for update of m;

  if not found or message_row.attachment->>'kind' <> 'image' then
    raise exception 'Fotoğraf bulunamadı veya bu sohbet için erişimin yok.';
  end if;

  mode_value := coalesce(message_row.attachment->>'view_mode', 'normal');
  max_views := case mode_value
    when '3s' then 1
    when '10s' then 1
    when 'once' then 1
    when 'twice' then 2
    else null
  end;
  duration_value := case mode_value
    when '3s' then 3
    when '10s' then 10
    else null
  end;

  if max_views is null then
    raise exception 'Bu fotoğraf geçici görüntüleme için ayarlanmamış.';
  end if;
  if message_row.photo_viewing_until > now() then
    raise exception 'Fotoğraf başka bir görüntülemede.';
  end if;
  if message_row.photo_views_used >= max_views then
    raise exception 'Bu fotoğrafın görüntüleme hakkı bitti.';
  end if;

  update public.messages
     set photo_views_used = photo_views_used + 1,
         photo_viewing_by = auth.uid(),
         photo_viewing_until = now() + interval '30 seconds'
   where id = p_message_id;

  return query
    select message_row.attachment->>'image',
           mode_value,
           duration_value,
           max_views - message_row.photo_views_used - 1;
end;
$$;

create or replace function public.close_ephemeral_chat_photo(p_message_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.messages
     set photo_viewing_by = null,
         photo_viewing_until = null
   where id = p_message_id
     and photo_viewing_by = auth.uid();
$$;

revoke all on function public.open_ephemeral_chat_photo(uuid) from public, anon;
revoke all on function public.close_ephemeral_chat_photo(uuid) from public, anon;
grant execute on function public.open_ephemeral_chat_photo(uuid) to authenticated;
grant execute on function public.close_ephemeral_chat_photo(uuid) to authenticated;

drop policy if exists campus_media_upload_own on storage.objects;
create policy campus_media_upload_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'campus-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists campus_media_read_referenced on storage.objects;
create policy campus_media_read_referenced on storage.objects
  for select to authenticated
  using (
    bucket_id = 'campus-media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.profiles p
         where p.avatar_url = name
           and p.id::text = (storage.foldername(name))[1]
           and (storage.foldername(name))[2] = 'avatars'
      )
      or exists (
        select 1
          from public.posts p
          join public.profiles owner on owner.id = p.author_id
         where p.media_url = name
           and p.author_id::text = (storage.foldername(name))[1]
           and (storage.foldername(name))[2] = 'posts'
           and (
             p.author_id = auth.uid()
             or not owner.is_private
             or exists (
               select 1 from public.follows f
                where f.follower_id = auth.uid()
                  and f.following_id = p.author_id
             )
           )
      )
      or exists (
        select 1
          from public.stories s
          join public.profiles owner on owner.id = s.author_id
         where s.media_url = name
           and s.author_id::text = (storage.foldername(name))[1]
           and (storage.foldername(name))[2] = 'stories'
           and (
             s.author_id = auth.uid()
             or not owner.is_private
             or exists (
               select 1 from public.follows f
                where f.follower_id = auth.uid()
                  and f.following_id = s.author_id
             )
           )
      )
      or exists (
        select 1 from public.listings l
         where l.image_url = name
           and l.seller_id::text = (storage.foldername(name))[1]
           and (storage.foldername(name))[2] = 'listings'
           and (l.status in ('active', 'sold') or l.seller_id = auth.uid())
      )
      or public.can_read_chat_media(name)
    )
  );

drop policy if exists campus_media_delete_own on storage.objects;
create policy campus_media_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'campus-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists campus_media_select_guard on storage.objects;
create policy campus_media_select_guard on storage.objects
  as restrictive for select to public
  using (
    bucket_id <> 'campus-media'
    or (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.profiles p
         where p.avatar_url = name
           and p.id::text = (storage.foldername(name))[1]
           and (storage.foldername(name))[2] = 'avatars'
      )
      or exists (
        select 1
          from public.posts p
          join public.profiles owner on owner.id = p.author_id
         where p.media_url = name
           and p.author_id::text = (storage.foldername(name))[1]
           and (storage.foldername(name))[2] = 'posts'
           and (
             p.author_id = auth.uid()
             or not owner.is_private
             or exists (
               select 1 from public.follows f
                where f.follower_id = auth.uid()
                  and f.following_id = p.author_id
             )
           )
      )
      or exists (
        select 1
          from public.stories s
          join public.profiles owner on owner.id = s.author_id
         where s.media_url = name
           and s.author_id::text = (storage.foldername(name))[1]
           and (storage.foldername(name))[2] = 'stories'
           and (
             s.author_id = auth.uid()
             or not owner.is_private
             or exists (
               select 1 from public.follows f
                where f.follower_id = auth.uid()
                  and f.following_id = s.author_id
             )
           )
      )
      or exists (
        select 1 from public.listings l
         where l.image_url = name
           and l.seller_id::text = (storage.foldername(name))[1]
           and (storage.foldername(name))[2] = 'listings'
           and (l.status in ('active', 'sold') or l.seller_id = auth.uid())
      )
      or public.can_read_chat_media(name)
    )
  );
drop policy if exists campus_media_insert_guard on storage.objects;
create policy campus_media_insert_guard on storage.objects
  as restrictive for insert to public
  with check (
    bucket_id <> 'campus-media'
    or (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists campus_media_update_guard on storage.objects;
create policy campus_media_update_guard on storage.objects
  as restrictive for update to public
  using (bucket_id <> 'campus-media')
  with check (bucket_id <> 'campus-media');
drop policy if exists campus_media_delete_guard on storage.objects;
create policy campus_media_delete_guard on storage.objects
  as restrictive for delete to public
  using (
    bucket_id <> 'campus-media'
    or (storage.foldername(name))[1] = auth.uid()::text
  );

insert into storage.buckets (id, name, public, allowed_mime_types)
values ('marketplace-pdfs', 'marketplace-pdfs', false, array['application/pdf'])
on conflict (id) do update
set public = false,
    allowed_mime_types = excluded.allowed_mime_types;

update public.listings
   set pdf_url = regexp_replace(
     split_part(pdf_url, '?', 1),
     '^.*/storage/v1/object/public/marketplace-pdfs/',
     ''
   )
 where pdf_url like '%/storage/v1/object/public/marketplace-pdfs/%';

create table if not exists public.listing_pdf_access (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, buyer_id)
);

alter table public.listing_pdf_access enable row level security;
revoke all on table public.listing_pdf_access from public, anon, authenticated;
grant select, insert, delete on public.listing_pdf_access to authenticated;
drop policy if exists listing_pdf_access_select_participants on public.listing_pdf_access;
create policy listing_pdf_access_select_participants on public.listing_pdf_access
  for select to authenticated
  using (
    buyer_id = auth.uid()
    or exists (
      select 1 from public.listings l
       where l.id = listing_id and l.seller_id = auth.uid()
    )
  );
drop policy if exists listing_pdf_access_request_own on public.listing_pdf_access;
create policy listing_pdf_access_request_own on public.listing_pdf_access
  for insert to authenticated
  with check (
    buyer_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.listings l
       where l.id = listing_id
         and l.seller_id <> auth.uid()
         and l.status in ('active', 'sold')
         and l.pdf_url is not null
    )
  );
drop policy if exists listing_pdf_access_delete_rejected_own on public.listing_pdf_access;
create policy listing_pdf_access_delete_rejected_own on public.listing_pdf_access
  for delete to authenticated
  using (buyer_id = auth.uid() and status = 'rejected');

drop policy if exists listing_pdf_access_select_guard on public.listing_pdf_access;
create policy listing_pdf_access_select_guard on public.listing_pdf_access
  as restrictive for select to public
  using (
    buyer_id = auth.uid()
    or exists (
      select 1 from public.listings l
       where l.id = listing_id and l.seller_id = auth.uid()
    )
  );
drop policy if exists listing_pdf_access_insert_guard on public.listing_pdf_access;
create policy listing_pdf_access_insert_guard on public.listing_pdf_access
  as restrictive for insert to public
  with check (
    buyer_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.listings l
       where l.id = listing_id
         and l.seller_id <> auth.uid()
         and l.status in ('active', 'sold')
         and l.pdf_url is not null
    )
  );
drop policy if exists listing_pdf_access_update_guard on public.listing_pdf_access;
create policy listing_pdf_access_update_guard on public.listing_pdf_access
  as restrictive for update to public
  using (false) with check (false);
drop policy if exists listing_pdf_access_delete_guard on public.listing_pdf_access;
create policy listing_pdf_access_delete_guard on public.listing_pdf_access
  as restrictive for delete to public
  using (buyer_id = auth.uid() and status = 'rejected');

create or replace function public.notify_listing_pdf_access_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare listing_title text; seller_id uuid; actor_username text;
begin
  select l.title, l.seller_id into listing_title, seller_id
    from public.listings l where l.id = new.listing_id;
  select p.username into actor_username from public.profiles p
   where p.id = case when tg_op = 'INSERT' then new.buyer_id else auth.uid() end;
  if tg_op = 'INSERT' then
    perform public.create_social_notification(
      seller_id, new.buyer_id, 'listing_inquiry', 'PDF erişim isteği',
      '@' || coalesce(actor_username, 'Bir kullanıcı') || ' "' ||
        coalesce(listing_title, 'ilanın') || '" PDF dosyasına erişmek istiyor.',
      'listing', new.listing_id
    );
  elsif new.status = 'approved' and old.status is distinct from new.status then
    perform public.create_social_notification(
      new.buyer_id, seller_id, 'listing_inquiry', 'PDF erişimin onaylandı',
      '"' || coalesce(listing_title, 'İlan') || '" PDF dosyasını artık açabilirsin.',
      'listing', new.listing_id
    );
  end if;
  return new;
end $$;
drop trigger if exists listing_pdf_access_notify on public.listing_pdf_access;
create trigger listing_pdf_access_notify
  after insert or update of status on public.listing_pdf_access
  for each row execute function public.notify_listing_pdf_access_change();
revoke all on function public.notify_listing_pdf_access_change() from public, anon, authenticated;

create or replace function public.respond_to_listing_pdf_access(p_request_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare request_row public.listing_pdf_access%rowtype;
begin
  select a.* into request_row
    from public.listing_pdf_access a
    join public.listings l on l.id = a.listing_id
   where a.id = p_request_id
     and l.seller_id = auth.uid()
     and a.status = 'pending'
   for update of a;
  if not found then
    raise exception 'Erişim isteği bulunamadı veya bu işlem için yetkiniz yok.';
  end if;
  update public.listing_pdf_access
     set status = case when p_approve then 'approved' else 'rejected' end,
         updated_at = now()
   where id = request_row.id;
end $$;
revoke all on function public.respond_to_listing_pdf_access(uuid, boolean) from public, anon;
grant execute on function public.respond_to_listing_pdf_access(uuid, boolean) to authenticated;

drop policy if exists marketplace_pdfs_read_seller_or_approved on storage.objects;
create policy marketplace_pdfs_read_seller_or_approved on storage.objects
  for select to authenticated
  using (
    bucket_id = 'marketplace-pdfs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.listings l
         where l.pdf_url = name
           and l.seller_id::text = (storage.foldername(name))[1]
           and (
             l.seller_id = auth.uid()
             or exists (
               select 1 from public.listing_pdf_access a
                where a.listing_id = l.id
                  and a.buyer_id = auth.uid()
                  and a.status = 'approved'
             )
           )
      )
    )
  );

drop policy if exists marketplace_pdfs_select_guard on storage.objects;
create policy marketplace_pdfs_select_guard on storage.objects
  as restrictive for select to public
  using (
    bucket_id <> 'marketplace-pdfs'
    or (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.listings l
         where l.pdf_url = name
           and l.seller_id::text = (storage.foldername(name))[1]
           and (
             l.seller_id = auth.uid()
             or exists (
               select 1 from public.listing_pdf_access a
                where a.listing_id = l.id
                  and a.buyer_id = auth.uid()
                  and a.status = 'approved'
             )
           )
      )
    )
  );
drop policy if exists marketplace_pdfs_insert_guard on storage.objects;
create policy marketplace_pdfs_insert_guard on storage.objects
  as restrictive for insert to public
  with check (
    bucket_id <> 'marketplace-pdfs'
    or (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists marketplace_pdfs_update_guard on storage.objects;
create policy marketplace_pdfs_update_guard on storage.objects
  as restrictive for update to public
  using (bucket_id <> 'marketplace-pdfs')
  with check (bucket_id <> 'marketplace-pdfs');
drop policy if exists marketplace_pdfs_delete_guard on storage.objects;
create policy marketplace_pdfs_delete_guard on storage.objects
  as restrictive for delete to public
  using (
    bucket_id <> 'marketplace-pdfs'
    or (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';


-- ---------- Gizli hesap takip istekleri ----------
create table if not exists public.follow_requests (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  check (follower_id <> following_id)
);
alter table public.follow_requests
  drop constraint if exists follow_requests_status_check,
  drop constraint if exists follow_requests_follower_id_following_id_key,
  add constraint follow_requests_status_check
    check (status in ('pending', 'accepted', 'rejected'));
drop index if exists public.follow_requests_recipient_created_idx;
create index if not exists follow_requests_recipient_created_idx
  on public.follow_requests (following_id, created_at desc)
  where status = 'pending';
create unique index if not exists follow_requests_one_pending_pair_idx
  on public.follow_requests (follower_id, following_id)
  where status = 'pending';
alter table public.follow_requests enable row level security;
grant select, insert, update, delete on public.follow_requests to authenticated;

drop policy if exists follow_requests_select_participants on public.follow_requests;
create policy follow_requests_select_participants on public.follow_requests
  for select to authenticated
  using (follower_id = auth.uid() or following_id = auth.uid());
drop policy if exists follow_requests_insert_requester on public.follow_requests;
create policy follow_requests_insert_requester on public.follow_requests
  for insert to authenticated
  with check (
    follower_id = auth.uid()
    and follower_id <> following_id
    and status = 'pending'
    and exists (
      select 1 from public.profiles p
       where p.id = following_id and p.is_private = true
    )
  );
drop policy if exists follow_requests_delete_pending_participant on public.follow_requests;
create policy follow_requests_delete_pending_participant on public.follow_requests
  for delete to authenticated
  using (status = 'pending' and (follower_id = auth.uid() or following_id = auth.uid()));
drop policy if exists follow_requests_update_recipient on public.follow_requests;
create policy follow_requests_update_recipient on public.follow_requests
  for update to authenticated
  using (following_id = auth.uid() and status = 'pending')
  with check (
    following_id = auth.uid()
    and follower_id <> following_id
    and status in ('accepted', 'rejected')
  );

create or replace function public.respond_to_follow_request(p_request_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.follow_requests%rowtype;
begin
  select * into request_row
    from public.follow_requests
   where id = p_request_id
     and following_id = auth.uid()
     and status = 'pending'
   for update;
  if not found then
    raise exception 'Takip isteği bulunamadı veya bu işlem için yetkiniz yok.';
  end if;
  if p_accept then
    insert into public.follows (follower_id, following_id)
    values (request_row.follower_id, request_row.following_id)
    on conflict (follower_id, following_id) do nothing;
  end if;
  update public.follow_requests
     set status = case when p_accept then 'accepted' else 'rejected' end
   where id = request_row.id;
end;
$$;
revoke all on function public.respond_to_follow_request(uuid, boolean) from public, anon;
grant execute on function public.respond_to_follow_request(uuid, boolean) to authenticated;

create or replace function public.notify_follow_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_username text;
begin
  select username into requester_username from public.profiles where id = new.follower_id;
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

do $$ begin
  alter publication supabase_realtime add table public.follow_requests;
exception when duplicate_object then null;
end $$;

delete from public.follows f
 using public.profiles p
 where p.id = f.following_id
   and p.is_private
   and not exists (
     select 1 from public.follow_requests fr
      where fr.follower_id = f.follower_id
        and fr.following_id = f.following_id
        and fr.status = 'accepted'
   );

drop policy if exists follows_insert on public.follows;
create policy follows_insert on public.follows
  for insert to authenticated
  with check (
    follower_id = auth.uid()
    and exists (
      select 1 from public.profiles p
       where p.id = following_id and p.is_private = false
    )
  );
drop policy if exists follows_private_follow_guard on public.follows;
create policy follows_private_follow_guard on public.follows
  as restrictive for insert to authenticated
  with check (
    follower_id = auth.uid()
    and exists (
      select 1 from public.profiles p
       where p.id = following_id and p.is_private = false
    )
  );

drop policy if exists posts_private_access_guard on public.posts;
create policy posts_private_access_guard on public.posts
  as restrictive for select to authenticated
  using (
    author_id = auth.uid()
    or not exists (
      select 1 from public.profiles p
       where p.id = author_id and p.is_private
    )
    or exists (
      select 1
        from public.follows f
        join public.follow_requests fr
          on fr.follower_id = f.follower_id
         and fr.following_id = f.following_id
         and fr.status = 'accepted'
       where f.follower_id = auth.uid()
         and f.following_id = author_id
    )
  );

drop policy if exists stories_private_access_guard on public.stories;
create policy stories_private_access_guard on public.stories
  as restrictive for select to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.profiles p
       where p.id = author_id and not p.is_private
    )
    or exists (
      select 1
        from public.follows f
        join public.follow_requests fr
          on fr.follower_id = f.follower_id
         and fr.following_id = f.following_id
         and fr.status = 'accepted'
       where f.follower_id = auth.uid()
         and f.following_id = author_id
    )
  );

delete from public.follows f
 using public.profiles p
 where p.id = f.following_id
   and p.is_private
   and not exists (
     select 1 from public.follow_requests fr
      where fr.follower_id = f.follower_id
        and fr.following_id = f.following_id
        and fr.status = 'accepted'
   );

drop policy if exists follows_private_follow_guard on public.follows;
create policy follows_private_follow_guard on public.follows
  as restrictive for insert to authenticated
  with check (
    follower_id = auth.uid()
    and exists (
      select 1 from public.profiles p
       where p.id = following_id and p.is_private = false
    )
  );

notify pgrst, 'reload schema';
