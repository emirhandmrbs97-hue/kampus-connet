do $$
declare
  policy_name text;
begin
  for policy_name in
    select policyname
      from pg_policies
     where schemaname = 'public'
       and tablename = 'messages'
       and cmd = 'DELETE'
  loop
    execute format('drop policy %I on public.messages', policy_name);
  end loop;
end $$;

create policy msg_delete_participant on public.messages
  for delete to authenticated using (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() in (c.initiator_id, c.recipient_id)
    )
  );

notify pgrst, 'reload schema';
