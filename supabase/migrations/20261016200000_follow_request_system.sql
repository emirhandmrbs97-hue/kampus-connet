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
  using (
    status = 'pending'
    and (follower_id = auth.uid() or following_id = auth.uid())
  );

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
  if to_regclass('public.notifications') is null then
    return new;
  end if;

  select username into requester_username
    from public.profiles
   where id = new.follower_id;

  execute
    'insert into public.notifications (
       recipient_id, actor_id, type, title, body, related_type, related_id
     )
     values ($1, $2, $3, $4, $5, $6, $7)'
    using
      new.following_id,
      new.follower_id,
      'follow',
      'Yeni takip isteği',
      '@' || coalesce(requester_username, 'Bir kullanıcı') || ' seni takip etmek istiyor.',
      'profile',
      new.follower_id;
  return new;
end;
$$;

drop trigger if exists follow_requests_notify_recipient on public.follow_requests;
create trigger follow_requests_notify_recipient
  after insert on public.follow_requests
  for each row execute function public.notify_follow_request();

do $$
begin
  alter publication supabase_realtime add table public.follow_requests;
exception when duplicate_object then null;
end;
$$;

notify pgrst, 'reload schema';
