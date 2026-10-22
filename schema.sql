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
  phone text,
  avatar_url text,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9._]{3,20}$')
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  media_url text,
  media_type text check (media_type in ('image','pdf')),
  file_name text,
  created_at timestamptz not null default now(),
  comments_disabled boolean not null default false,
  hide_like_count boolean not null default false,
  check (body <> '' or media_url is not null)
);
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_edited boolean not null default false
);
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
create unique index if not exists conversations_pair_idx
  on public.conversations (least(initiator_id, recipient_id), greatest(initiator_id, recipient_id));

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  attachment jsonb,
  created_at timestamptz not null default now(),
  check (body <> '' or attachment is not null)
);
create index if not exists messages_conv_idx on public.messages (conversation_id, created_at);

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

-- Sohbet başlat: karşı taraf seni takip ediyorsa 'accepted', etmiyorsa 'pending' (mesaj isteği)
create or replace function public.start_conversation(other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; st text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if other = auth.uid() then raise exception 'cannot message yourself'; end if;
  select id into cid from public.conversations
   where (initiator_id = auth.uid() and recipient_id = other)
      or (initiator_id = other and recipient_id = auth.uid())
   limit 1;
  if cid is not null then return cid; end if;
  if exists (select 1 from public.follows where follower_id = other and following_id = auth.uid()) then
    st := 'accepted';
  else
    st := 'pending';
  end if;
  insert into public.conversations (initiator_id, recipient_id, status)
  values (auth.uid(), other, st) returning id into cid;
  return cid;
end $$;

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

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.stories enable row level security;
alter table public.listings enable row level security;
alter table public.offers enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

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
create policy follows_insert on public.follows for insert to authenticated with check (follower_id = auth.uid());
drop policy if exists follows_delete on public.follows;
create policy follows_delete on public.follows for delete to authenticated using (follower_id = auth.uid());

-- posts (gizli hesabın gönderilerini yalnızca takipçiler ve kendisi görür)
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts for select to authenticated using (
  author_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = author_id and not p.is_private)
  or exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = author_id)
);
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts for insert to authenticated with check (author_id = auth.uid());
drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());
drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts for delete to authenticated using (author_id = auth.uid());

-- likes
drop policy if exists likes_select on public.likes;
create policy likes_select on public.likes for select to authenticated using (exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists likes_insert on public.likes;
create policy likes_insert on public.likes for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists likes_delete on public.likes;
create policy likes_delete on public.likes for delete to authenticated using (user_id = auth.uid());

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

-- stories
drop policy if exists stories_select on public.stories;
create policy stories_select on public.stories for select to authenticated using (true);
drop policy if exists stories_insert on public.stories;
create policy stories_insert on public.stories for insert to authenticated with check (author_id = auth.uid());
drop policy if exists stories_delete on public.stories;
create policy stories_delete on public.stories for delete to authenticated using (author_id = auth.uid());

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

-- ---------- Yetkiler ----------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.start_conversation(uuid) to authenticated;

-- ---------- Anlık mesajlaşma (Realtime) ----------
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
