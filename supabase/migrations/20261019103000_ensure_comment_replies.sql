alter table public.comments
  add column if not exists parent_comment_id uuid
  references public.comments(id) on delete cascade;

create index if not exists comments_parent_comment_id_idx
  on public.comments (parent_comment_id);

notify pgrst, 'reload schema';
