insert into storage.buckets (id, name, public, allowed_mime_types)
values (
  'campus-media',
  'campus-media',
  false,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    allowed_mime_types = excluded.allowed_mime_types;

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

alter table public.stories enable row level security;
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
  using (false)
  with check (false);
drop policy if exists listing_pdf_access_delete_guard on public.listing_pdf_access;
create policy listing_pdf_access_delete_guard on public.listing_pdf_access
  as restrictive for delete to public
  using (buyer_id = auth.uid() and status = 'rejected');

create or replace function public.notify_listing_pdf_access_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_title text;
  seller_id uuid;
  actor_username text;
begin
  select l.title, l.seller_id into listing_title, seller_id
    from public.listings l
   where l.id = new.listing_id;
  select p.username into actor_username
    from public.profiles p
   where p.id = case when tg_op = 'INSERT' then new.buyer_id else auth.uid() end;

  if tg_op = 'INSERT' then
    perform public.create_social_notification(
      seller_id,
      new.buyer_id,
      'listing_inquiry',
      'PDF erişim isteği',
      '@' || coalesce(actor_username, 'Bir kullanıcı') || ' "' ||
        coalesce(listing_title, 'ilanın') || '" PDF dosyasına erişmek istiyor.',
      'listing',
      new.listing_id
    );
  elsif new.status = 'approved' and old.status is distinct from new.status then
    perform public.create_social_notification(
      new.buyer_id,
      seller_id,
      'listing_inquiry',
      'PDF erişimin onaylandı',
      '"' || coalesce(listing_title, 'İlan') || '" PDF dosyasını artık açabilirsin.',
      'listing',
      new.listing_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists listing_pdf_access_notify on public.listing_pdf_access;
create trigger listing_pdf_access_notify
  after insert or update of status on public.listing_pdf_access
  for each row execute function public.notify_listing_pdf_access_change();
revoke all on function public.notify_listing_pdf_access_change() from public, anon, authenticated;

create or replace function public.respond_to_listing_pdf_access(
  p_request_id uuid,
  p_approve boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.listing_pdf_access%rowtype;
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
end;
$$;

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
        select 1
          from public.listings l
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
