alter table public.listings
  add column if not exists university text;

create index if not exists listings_active_university_idx
  on public.listings (university, created_at desc)
  where status = 'active';
