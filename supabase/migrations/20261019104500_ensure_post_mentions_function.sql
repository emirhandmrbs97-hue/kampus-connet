create or replace function public.notify_post_mentions(
  p_content text,
  p_actor_id uuid,
  p_post_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  mentioned_username text;
  recipient uuid;
  actor_username text;
begin
  select username into actor_username
    from public.profiles
   where id = p_actor_id;

  for mentioned_username in
    select distinct lower(mention[1])
      from regexp_matches(coalesce(p_content, ''), '@([a-zA-Z0-9._]{3,20})', 'g') as mention
  loop
    select id into recipient
      from public.profiles
     where lower(username) = mentioned_username
     limit 1;

    perform public.create_social_notification(
      recipient,
      p_actor_id,
      'mention',
      'Bir gönderide etiketlendin',
      '@' || coalesce(actor_username, 'Bir kullanıcı') || ' seni etiketledi.',
      'post',
      p_post_id
    );
  end loop;
end;
$$;
