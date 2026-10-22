create or replace function public.users_block_each_other(user_a uuid, user_b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select case
    when auth.uid() is null or auth.uid() not in (user_a, user_b) then false
    else exists (
      select 1
        from public.blocks b
       where (b.blocker_id = user_a and b.blocked_id = user_b)
          or (b.blocker_id = user_b and b.blocked_id = user_a)
    )
  end;
$$;

revoke all on function public.users_block_each_other(uuid, uuid) from public, anon;
grant execute on function public.users_block_each_other(uuid, uuid) to authenticated;

delete from public.follows f
 using public.profiles p
 where p.id = f.following_id
   and p.is_private
   and not exists (
     select 1
       from public.follow_requests fr
      where fr.follower_id = f.follower_id
        and fr.following_id = f.following_id
        and fr.status = 'accepted'
   );

drop policy if exists follows_insert on public.follows;
create policy follows_insert on public.follows
  for insert to authenticated
  with check (
    follower_id = auth.uid()
    and exists (
      select 1 from public.profiles p
       where p.id = following_id and p.is_private = false
    )
  );
drop policy if exists follows_private_follow_guard on public.follows;
create policy follows_private_follow_guard on public.follows
  as restrictive for insert to authenticated
  with check (
    follower_id = auth.uid()
    and exists (
       select 1 from public.profiles p
        where p.id = following_id and p.is_private = false
    )
  );

create or replace function public.start_conversation(other uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
  st text;
  target_dm_privacy text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if other = auth.uid() then raise exception 'cannot message yourself'; end if;

  select p.dm_privacy into target_dm_privacy
    from public.profiles p
   where p.id = other;
  if not found then raise exception 'user not found'; end if;
  if public.users_block_each_other(auth.uid(), other) then
    raise exception 'Bu kullanıcıyla engelleme nedeniyle sohbet başlatılamıyor.';
  end if;
  if target_dm_privacy = 'nobody'
     or (target_dm_privacy = 'followers' and not exists (
       select 1 from public.follows f
        where f.follower_id = auth.uid() and f.following_id = other
     )) then
    raise exception 'Kullanıcının mesaj gizliliği ayarları sohbet başlatmanıza izin vermiyor.';
  end if;

  select c.id, c.status into cid, st
    from public.conversations c
   where (c.initiator_id = auth.uid() and c.recipient_id = other)
      or (c.initiator_id = other and c.recipient_id = auth.uid())
   limit 1;
  if cid is not null then return cid; end if;

  if exists (
    select 1 from public.follows f
     where f.follower_id = other and f.following_id = auth.uid()
  ) then
    st := 'accepted';
  else
    st := 'pending';
  end if;

  insert into public.conversations (initiator_id, recipient_id, status)
  values (auth.uid(), other, st)
  returning id into cid;
  return cid;
end;
$$;

revoke all on function public.start_conversation(uuid) from public, anon;
grant execute on function public.start_conversation(uuid) to authenticated;

drop policy if exists conv_block_guard_select on public.conversations;
create policy conv_block_guard_select on public.conversations
  as restrictive for select to authenticated
  using (not public.users_block_each_other(initiator_id, recipient_id));

drop policy if exists conv_block_guard_update on public.conversations;
create policy conv_block_guard_update on public.conversations
  as restrictive for update to authenticated
  using (not public.users_block_each_other(initiator_id, recipient_id))
  with check (not public.users_block_each_other(initiator_id, recipient_id));

drop policy if exists msg_block_guard_select on public.messages;
create policy msg_block_guard_select on public.messages
  as restrictive for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
       where c.id = conversation_id
         and not public.users_block_each_other(c.initiator_id, c.recipient_id)
    )
  );

drop policy if exists msg_privacy_guard_insert on public.messages;
create policy msg_privacy_guard_insert on public.messages
  as restrictive for insert to authenticated
  with check (
    exists (
      select 1
        from public.conversations c
        join public.profiles recipient
          on recipient.id = c.recipient_id
       where c.id = conversation_id
         and not public.users_block_each_other(c.initiator_id, c.recipient_id)
         and (
           c.status = 'accepted'
           or (
             c.status = 'pending'
             and c.initiator_id = auth.uid()
             and (
               recipient.dm_privacy = 'everyone'
               or (
                 recipient.dm_privacy = 'followers'
                 and exists (
                   select 1 from public.follows f
                    where f.follower_id = c.initiator_id
                      and f.following_id = c.recipient_id
                 )
               )
             )
           )
         )
    )
  );

drop policy if exists posts_private_access_guard on public.posts;
create policy posts_private_access_guard on public.posts
  as restrictive for select to authenticated
  using (
    author_id = auth.uid()
    or not exists (
      select 1 from public.profiles p
       where p.id = author_id and p.is_private
    )
    or exists (
      select 1
        from public.follows f
        join public.follow_requests fr
          on fr.follower_id = f.follower_id
         and fr.following_id = f.following_id
         and fr.status = 'accepted'
       where f.follower_id = auth.uid()
         and f.following_id = author_id
    )
  );

notify pgrst, 'reload schema';
