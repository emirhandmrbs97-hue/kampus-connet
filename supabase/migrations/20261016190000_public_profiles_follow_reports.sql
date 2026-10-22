alter table public.profiles
  add column if not exists university text,
  add column if not exists department text;

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

alter table public.user_reports enable row level security;

drop policy if exists user_reports_insert_own on public.user_reports;
create policy user_reports_insert_own on public.user_reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists user_reports_select_own on public.user_reports;
create policy user_reports_select_own on public.user_reports
  for select to authenticated
  using (reporter_id = auth.uid());

grant insert, select on public.user_reports to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.follows;
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.posts;
exception when duplicate_object then null;
end;
$$;

notify pgrst, 'reload schema';
