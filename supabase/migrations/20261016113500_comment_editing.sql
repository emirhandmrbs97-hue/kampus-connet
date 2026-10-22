alter table public.comments
  add column if not exists is_edited boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_comment_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if new.body is distinct from old.body then
    new.is_edited := true;
  end if;
  return new;
end $$;

drop trigger if exists comments_set_updated_at on public.comments;
create trigger comments_set_updated_at before update on public.comments
  for each row execute function public.set_comment_updated_at();

drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete to authenticated using (
  author_id = auth.uid()
  or exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
);

drop policy if exists comments_update on public.comments;
create policy comments_update on public.comments for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

notify pgrst, 'reload schema';
