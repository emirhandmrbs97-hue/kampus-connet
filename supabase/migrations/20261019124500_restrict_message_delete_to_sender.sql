drop policy if exists msg_delete_own_sender_only on public.messages;
create policy msg_delete_own_sender_only on public.messages
  as restrictive
  for delete to authenticated
  using (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() in (c.initiator_id, c.recipient_id)
    )
  );

notify pgrst, 'reload schema';
