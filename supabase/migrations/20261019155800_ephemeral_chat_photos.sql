alter table public.messages
  add column if not exists photo_views_used integer not null default 0
    check (photo_views_used >= 0),
  add column if not exists photo_viewing_by uuid references public.profiles(id) on delete set null,
  add column if not exists photo_viewing_until timestamptz;

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
       and (
         m.sender_id = auth.uid()
         or (
           auth.uid() in (c.initiator_id, c.recipient_id)
           and (
             coalesce(m.attachment->>'view_mode', 'normal') = 'normal'
             or (
               m.photo_viewing_by = auth.uid()
               and m.photo_viewing_until > now()
             )
           )
         )
       )
  );
$$;

revoke all on function public.can_read_chat_media(text) from public, anon;
grant execute on function public.can_read_chat_media(text) to authenticated;

create or replace function public.open_ephemeral_chat_photo(p_message_id uuid)
returns table (
  image_path text,
  view_mode text,
  duration_seconds integer,
  views_remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  message_row public.messages%rowtype;
  mode_value text;
  max_views integer;
  duration_value integer;
begin
  select m.* into message_row
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
   where m.id = p_message_id
     and m.sender_id <> auth.uid()
     and auth.uid() in (c.initiator_id, c.recipient_id)
     and c.status = 'accepted'
     and not public.users_block_each_other(c.initiator_id, c.recipient_id)
   for update of m;

  if not found or message_row.attachment->>'kind' <> 'image' then
    raise exception 'Fotoğraf bulunamadı veya bu sohbet için erişimin yok.';
  end if;

  mode_value := coalesce(message_row.attachment->>'view_mode', 'normal');
  max_views := case mode_value
    when '3s' then 1
    when '10s' then 1
    when 'once' then 1
    when 'twice' then 2
    else null
  end;
  duration_value := case mode_value
    when '3s' then 3
    when '10s' then 10
    else null
  end;

  if max_views is null then
    raise exception 'Bu fotoğraf geçici görüntüleme için ayarlanmamış.';
  end if;
  if message_row.photo_viewing_until > now() then
    raise exception 'Fotoğraf başka bir görüntülemede.';
  end if;
  if message_row.photo_views_used >= max_views then
    raise exception 'Bu fotoğrafın görüntüleme hakkı bitti.';
  end if;

  update public.messages
     set photo_views_used = photo_views_used + 1,
         photo_viewing_by = auth.uid(),
         photo_viewing_until = now() + interval '30 seconds'
   where id = p_message_id;

  return query
    select message_row.attachment->>'image',
           mode_value,
           duration_value,
           max_views - message_row.photo_views_used - 1;
end;
$$;

create or replace function public.close_ephemeral_chat_photo(p_message_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.messages
     set photo_viewing_by = null,
         photo_viewing_until = null
   where id = p_message_id
     and photo_viewing_by = auth.uid();
$$;

revoke all on function public.open_ephemeral_chat_photo(uuid) from public, anon;
revoke all on function public.close_ephemeral_chat_photo(uuid) from public, anon;
grant execute on function public.open_ephemeral_chat_photo(uuid) to authenticated;
grant execute on function public.close_ephemeral_chat_photo(uuid) to authenticated;

notify pgrst, 'reload schema';
