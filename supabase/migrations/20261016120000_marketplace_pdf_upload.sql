alter table public.listings
  add column if not exists pdf_url text,
  add column if not exists pdf_file_name text,
  add column if not exists pdf_size bigint,
  add column if not exists university_name text,
  add column if not exists department_name text,
  add column if not exists grade_level text;

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

notify pgrst, 'reload schema';
