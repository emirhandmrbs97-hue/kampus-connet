alter table public.stories enable row level security;

grant insert on public.stories to authenticated;

drop policy if exists stories_insert on public.stories;
create policy stories_insert on public.stories
  for insert to authenticated
  with check (author_id = (select auth.uid()));

drop policy if exists campus_media_owner_insert on storage.objects;
create policy campus_media_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'campus-media'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
