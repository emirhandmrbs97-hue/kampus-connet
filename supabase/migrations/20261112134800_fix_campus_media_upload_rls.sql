grant insert on table storage.objects to authenticated;

drop policy if exists campus_media_owner_insert on storage.objects;
create policy campus_media_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'campus-media'
    and (storage.foldername(name))[1] in (
      'avatars',
      'posts',
      'stories',
      'listings',
      'messages',
      'confessions'
    )
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
