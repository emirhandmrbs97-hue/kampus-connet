drop policy if exists campus_media_insert_guard on storage.objects;
create policy campus_media_insert_guard on storage.objects
  as restrictive
  for insert to public
  with check (
    bucket_id <> 'campus-media'
    or (
      (storage.foldername(name))[1] in (
        'avatars',
        'posts',
        'stories',
        'listings',
        'messages',
        'confessions'
      )
      and (storage.foldername(name))[2] = (select auth.uid())::text
    )
  );
