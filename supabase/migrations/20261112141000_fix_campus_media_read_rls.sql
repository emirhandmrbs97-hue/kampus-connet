create or replace function public.can_read_chat_media(object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
     where m.attachment->>'kind' = 'image'
       and m.attachment->>'image' = object_path
       and (
         m.sender_id::text = (storage.foldername(object_path))[1]
         or m.sender_id::text = (storage.foldername(object_path))[2]
       )
       and (
         (storage.foldername(object_path))[1] = 'messages'
         or (storage.foldername(object_path))[2] = 'messages'
       )
       and auth.uid() in (c.initiator_id, c.recipient_id)
  );
$$;

drop policy if exists campus_media_read_referenced on storage.objects;
create policy campus_media_read_referenced on storage.objects
  for select to authenticated
  using (
    bucket_id = 'campus-media'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (storage.foldername(name))[2] = (select auth.uid())::text
      or exists (
        select 1
          from public.profiles p
         where p.avatar_url = objects.name
           and (
             ((storage.foldername(objects.name))[1] = 'avatars'
               and p.id::text = (storage.foldername(objects.name))[2])
             or (p.id::text = (storage.foldername(objects.name))[1]
               and (storage.foldername(objects.name))[2] = 'avatars')
           )
      )
      or exists (
        select 1
          from public.posts p
          join public.profiles owner on owner.id = p.author_id
         where p.media_url = objects.name
           and (
             ((storage.foldername(objects.name))[1] = 'posts'
               and p.author_id::text = (storage.foldername(objects.name))[2])
             or (p.author_id::text = (storage.foldername(objects.name))[1]
               and (storage.foldername(objects.name))[2] = 'posts')
           )
           and (
             p.author_id = (select auth.uid())
             or not owner.is_private
             or exists (
               select 1
                 from public.follows f
                where f.follower_id = (select auth.uid())
                  and f.following_id = p.author_id
             )
           )
      )
      or exists (
        select 1
          from public.stories s
          join public.profiles owner on owner.id = s.author_id
         where s.media_url = objects.name
           and (
             ((storage.foldername(objects.name))[1] = 'stories'
               and s.author_id::text = (storage.foldername(objects.name))[2])
             or (s.author_id::text = (storage.foldername(objects.name))[1]
               and (storage.foldername(objects.name))[2] = 'stories')
           )
           and (
             s.author_id = (select auth.uid())
             or not owner.is_private
             or exists (
               select 1
                 from public.follows f
                where f.follower_id = (select auth.uid())
                  and f.following_id = s.author_id
             )
           )
      )
      or exists (
        select 1
          from public.listings l
         where l.image_url = objects.name
           and (
             ((storage.foldername(objects.name))[1] = 'listings'
               and l.seller_id::text = (storage.foldername(objects.name))[2])
             or (l.seller_id::text = (storage.foldername(objects.name))[1]
               and (storage.foldername(objects.name))[2] = 'listings')
           )
           and (l.status in ('active', 'sold') or l.seller_id = (select auth.uid()))
      )
      or public.can_read_chat_media(name)
    )
  );

drop policy if exists campus_media_select_guard on storage.objects;
create policy campus_media_select_guard on storage.objects
  as restrictive
  for select to public
  using (
    bucket_id <> 'campus-media'
    or (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (storage.foldername(name))[2] = (select auth.uid())::text
      or exists (
        select 1
          from public.profiles p
         where p.avatar_url = objects.name
           and (
             ((storage.foldername(objects.name))[1] = 'avatars'
               and p.id::text = (storage.foldername(objects.name))[2])
             or (p.id::text = (storage.foldername(objects.name))[1]
               and (storage.foldername(objects.name))[2] = 'avatars')
           )
      )
      or exists (
        select 1
          from public.posts p
          join public.profiles owner on owner.id = p.author_id
         where p.media_url = objects.name
           and (
             ((storage.foldername(objects.name))[1] = 'posts'
               and p.author_id::text = (storage.foldername(objects.name))[2])
             or (p.author_id::text = (storage.foldername(objects.name))[1]
               and (storage.foldername(objects.name))[2] = 'posts')
           )
           and (
             p.author_id = (select auth.uid())
             or not owner.is_private
             or exists (
               select 1
                 from public.follows f
                where f.follower_id = (select auth.uid())
                  and f.following_id = p.author_id
             )
           )
      )
      or exists (
        select 1
          from public.stories s
          join public.profiles owner on owner.id = s.author_id
         where s.media_url = objects.name
           and (
             ((storage.foldername(objects.name))[1] = 'stories'
               and s.author_id::text = (storage.foldername(objects.name))[2])
             or (s.author_id::text = (storage.foldername(objects.name))[1]
               and (storage.foldername(objects.name))[2] = 'stories')
           )
           and (
             s.author_id = (select auth.uid())
             or not owner.is_private
             or exists (
               select 1
                 from public.follows f
                where f.follower_id = (select auth.uid())
                  and f.following_id = s.author_id
             )
           )
      )
      or exists (
        select 1
          from public.listings l
         where l.image_url = objects.name
           and (
             ((storage.foldername(objects.name))[1] = 'listings'
               and l.seller_id::text = (storage.foldername(objects.name))[2])
             or (l.seller_id::text = (storage.foldername(objects.name))[1]
               and (storage.foldername(objects.name))[2] = 'listings')
           )
           and (l.status in ('active', 'sold') or l.seller_id = (select auth.uid()))
      )
      or public.can_read_chat_media(name)
    )
  );
