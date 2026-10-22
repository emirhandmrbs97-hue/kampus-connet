create or replace function public.can_read_chat_media(object_path text)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $$
  select exists (
    select 1
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
     where m.attachment->>'kind' = 'image'
       and m.attachment->>'image' = object_path
       and m.sender_id::text = (storage.foldername(object_path))[1]
       and (storage.foldername(object_path))[2] = 'messages'
       and auth.uid() in (c.initiator_id, c.recipient_id)
  );
$$;

revoke all on function public.can_read_chat_media(text) from public, anon;
grant execute on function public.can_read_chat_media(text) to authenticated;

do $$
declare
  media_policy record;
  updated_policies integer := 0;
begin
  for media_policy in
    select polname, polrelid::regclass as relation_name, pg_get_expr(polqual, polrelid) as predicate
      from pg_policy
     where polrelid = 'storage.objects'::regclass
       and polname in ('campus_media_read_referenced', 'campus_media_select_guard')
  loop
    if media_policy.predicate is null then
      raise exception 'Storage policy % has no read predicate.', media_policy.polname;
    end if;

    execute format(
      'alter policy %I on %s using ((%s) or public.can_read_chat_media(name))',
      media_policy.polname,
      media_policy.relation_name,
      media_policy.predicate
    );
    updated_policies := updated_policies + 1;
  end loop;

  if updated_policies <> 2 then
    raise exception 'Expected both campus-media read policies, updated %.', updated_policies;
  end if;
end;
$$;

notify pgrst, 'reload schema';
