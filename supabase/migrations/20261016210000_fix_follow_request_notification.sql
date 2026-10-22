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
