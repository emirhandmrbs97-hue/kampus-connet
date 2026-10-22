import { supabase } from '@/lib/supabase';

export type MentionCandidate = {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
};

export async function searchMentionCandidates(query: string): Promise<MentionCandidate[]> {
  const term = query.trim().replace(/^@/, '');
  if (term.length < 1) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id,username,full_name,avatar_url')
    .ilike('username', `%${term}%`)
    .limit(8);
  if (error) throw error;
  return (data ?? []) as MentionCandidate[];
}
