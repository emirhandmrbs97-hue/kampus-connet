do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'confessions'
  ) then
    alter publication supabase_realtime add table public.confessions;
  end if;

  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'confession_comments'
  ) then
    alter publication supabase_realtime add table public.confession_comments;
  end if;

  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'confession_likes'
  ) then
    alter publication supabase_realtime add table public.confession_likes;
  end if;
end
$$;

alter table public.confession_comments replica identity full;
