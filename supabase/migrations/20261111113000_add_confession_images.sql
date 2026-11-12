alter table public.confessions
  add column if not exists image_url text;

create or replace view public.confessions_feed
with (security_invoker = false)
as
select
  c.id,
  c.university_id,
  c.content,
  c.created_at,
  (select count(*)::integer from public.confession_likes l where l.confession_id = c.id) as like_count,
  (select count(*)::integer from public.confession_comments cm where cm.confession_id = c.id) as comment_count,
  c.image_url
from public.confessions c;

drop function if exists public.create_confession(text, text);

create function public.create_confession(
  p_university_id text,
  p_content text,
  p_image_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  recent_count integer;
  new_confession_id uuid;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'authentication_required';
  end if;

  if p_university_id is null or length(trim(p_university_id)) = 0 then
    raise exception using errcode = '22023', message = 'university_required';
  end if;

  if p_content is null or length(trim(p_content)) < 5 or length(trim(p_content)) > 2000 then
    raise exception using errcode = '22023', message = 'invalid_confession_content';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));

  select count(*)::integer
    into recent_count
    from public.confession_quota_tracker
   where user_id = current_user_id
     and created_at >= now() - interval '7 days';

  if recent_count >= 2 then
    raise exception using errcode = 'P0001', message = 'weekly_quota_exceeded';
  end if;

  insert into public.confessions (
    university_id,
    content,
    image_url,
    is_anonymous,
    weekly_quota_tracker
  )
  values (
    trim(p_university_id),
    trim(p_content),
    p_image_url,
    true,
    recent_count + 1
  )
  returning id into new_confession_id;

  insert into public.confession_quota_tracker (confession_id, user_id)
  values (new_confession_id, current_user_id);

  return new_confession_id;
end;
$$;

revoke all on function public.create_confession(text, text, text) from public, anon;
grant execute on function public.create_confession(text, text, text) to authenticated;

notify pgrst, 'reload schema';
