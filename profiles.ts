import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

const cache = new Map<string, Profile>();

export async function fetchProfiles(ids: string[]): Promise<Record<string, Profile>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const missing = unique.filter((id) => !cache.has(id));
  if (missing.length > 0) {
    const { data } = await supabase.from('profiles').select('*').in('id', missing);
    (data as Profile[] | null)?.forEach((p) => cache.set(p.id, p));
  }
  const out: Record<string, Profile> = {};
  unique.forEach((id) => {
    const p = cache.get(id);
    if (p) out[id] = p;
  });
  return out;
}

export function invalidateProfile(id: string) {
  cache.delete(id);
}

export async function countRows(
  table: 'posts' | 'follows',
  column: 'author_id' | 'follower_id' | 'following_id',
  value: string,
): Promise<number> {
  const { count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(column, value);
  return count ?? 0;
}
