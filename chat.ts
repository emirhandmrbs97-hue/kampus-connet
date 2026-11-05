import { supabase } from '@/lib/supabase';
import { fetchProfiles } from '@/services/profiles';
import type { Attachment, ConversationRow, ConversationView, MessageRow } from '@/types';

export async function loadConversations(me: string): Promise<ConversationView[]> {
  const { data } = await supabase
    .from('conversations')
    .select('*')
    .or(`initiator_id.eq.${me},recipient_id.eq.${me}`)
    .order('last_message_at', { ascending: false });
  const rows = (data ?? []) as ConversationRow[];
  const profiles = await fetchProfiles(
    rows.map((r) => (r.initiator_id === me ? r.recipient_id : r.initiator_id)),
  );
  return rows.map((r) => ({
    ...r,
    other: profiles[r.initiator_id === me ? r.recipient_id : r.initiator_id],
  }));
}

export async function startConversation(
  otherId: string,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('start_conversation', { other: otherId });
  if (error) return { id: null, error: error.message };
  return { id: data as string, error: null };
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
  attachment?: Attachment | null,
): Promise<{ message: MessageRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: body.trim(),
      attachment: attachment ?? null,
    })
    .select()
    .single();
  if (error) return { message: null, error: error.message };
  return { message: data as MessageRow, error: null };
}
