create or replace function public.validate_comment_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if new.parent_comment_id is not null
     and not exists (
       select 1
         from public.comments parent
        where parent.id = new.parent_comment_id
          and parent.post_id = new.post_id
     ) then
    raise exception 'Parent comment must belong to the same post'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_comment_parent() from public;
revoke all on function public.validate_comment_parent() from anon;
revoke all on function public.validate_comment_parent() from authenticated;

drop trigger if exists comments_validate_parent on public.comments;
create trigger comments_validate_parent
  before insert or update of parent_comment_id, post_id
  on public.comments
  for each row
  execute function public.validate_comment_parent();

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1
        from public.posts post
       where post.id = comments.post_id
         and coalesce(post.comments_disabled, false) = false
    )
  );
