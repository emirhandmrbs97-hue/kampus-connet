create table if not exists public.conversation_preferences (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  is_muted boolean not null default false,
  is_archived boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversation_preferences enable row level security;
grant select, insert, update, delete on public.conversation_preferences to authenticated;

drop policy if exists conversation_preferences_select on public.conversation_preferences;
create policy conversation_preferences_select on public.conversation_preferences
  for select to authenticated using (user_id = auth.uid());

drop policy if exists conversation_preferences_insert on public.conversation_preferences;
create policy conversation_preferences_insert on public.conversation_preferences
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() in (c.initiator_id, c.recipient_id)
    )
  );

drop policy if exists conversation_preferences_update on public.conversation_preferences;
create policy conversation_preferences_update on public.conversation_preferences
  for update to authenticated using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() in (c.initiator_id, c.recipient_id)
    )
  );

drop policy if exists conversation_preferences_delete on public.conversation_preferences;
create policy conversation_preferences_delete on public.conversation_preferences
  for delete to authenticated using (user_id = auth.uid());

grant delete on public.messages to authenticated;
drop policy if exists msg_delete_participant on public.messages;
create policy msg_delete_participant on public.messages
  for delete to authenticated using (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() in (c.initiator_id, c.recipient_id)
    )
  );

create or replace function public.refresh_conversation_after_message_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations c
     set last_message = (
           select case when m.body <> '' then left(m.body, 80)
                       else coalesce(m.attachment->>'title', 'Ek') end
             from public.messages m
            where m.conversation_id = old.conversation_id
            order by m.created_at desc
            limit 1
         ),
         last_message_at = coalesce(
           (
             select m.created_at
               from public.messages m
              where m.conversation_id = old.conversation_id
              order by m.created_at desc
              limit 1
           ),
           c.created_at
         )
   where c.id = old.conversation_id;
  return old;
end $$;

drop trigger if exists messages_refresh_conversation_after_delete on public.messages;
create trigger messages_refresh_conversation_after_delete
  after delete on public.messages
  for each row execute function public.refresh_conversation_after_message_delete();

notify pgrst, 'reload schema';
