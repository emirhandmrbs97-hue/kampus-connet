import { supabase } from '@/lib/supabase';
import { fetchProfiles } from '@/services/profiles';
import { createEphemeralMediaUrl } from '@/services/storageService';
import type { Attachment, ConversationRow, ConversationView, MessageRow } from '@/types';

export type EphemeralPhotoMode = '3s' | '10s' | 'once' | 'twice';

export type EphemeralPhotoGrant = {
  imagePath: string;
  viewMode: EphemeralPhotoMode;
  durationSeconds: number | null;
  viewsRemaining: number;
  signedUrl: string;
};

function isEphemeralPhotoMode(value: unknown): value is EphemeralPhotoMode {
  return value === '3s' || value === '10s' || value === 'once' || value === 'twice';
}

export async function openEphemeralChatPhoto(messageId: string): Promise<EphemeralPhotoGrant> {
  const { data, error } = await supabase.rpc('open_ephemeral_chat_photo', {
    p_message_id: messageId,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : null;
  if (
    !row ||
    typeof row.image_path !== 'string' ||
    !isEphemeralPhotoMode(row.view_mode) ||
    (row.duration_seconds !== null && typeof row.duration_seconds !== 'number') ||
    typeof row.views_remaining !== 'number'
  ) {
    throw new Error('Fotoğraf görüntüleme izni alınamadı.');
  }

  const signedUrl = await createEphemeralMediaUrl(row.image_path);
  return {
    imagePath: row.image_path,
    viewMode: row.view_mode,
    durationSeconds: row.duration_seconds,
    viewsRemaining: row.views_remaining,
    signedUrl,
  };
}

export async function closeEphemeralChatPhoto(messageId: string): Promise<void> {
  const { error } = await supabase.rpc('close_ephemeral_chat_photo', {
    p_message_id: messageId,
  });
  if (error) throw error;
}

export async function loadConversations(me: string): Promise<ConversationView[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .or(`initiator_id.eq.${me},recipient_id.eq.${me}`)
    .order('last_message_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as ConversationRow[];
  if (rows.length === 0) return [];

  const { data: preferences, error: preferencesError } = await supabase
    .from('conversation_preferences')
    .select('conversation_id,is_muted,is_archived')
    .eq('user_id', me)
    .in('conversation_id', rows.map((row) => row.id));
  if (preferencesError) throw preferencesError;
  const preferenceByConversation = new Map(
    (preferences ?? []).map((preference) => [preference.conversation_id, preference]),
  );
  const profiles = await fetchProfiles(
    rows.map((r) => (r.initiator_id === me ? r.recipient_id : r.initiator_id)),
  );
  return rows.map((r) => ({
    ...r,
    other: profiles[r.initiator_id === me ? r.recipient_id : r.initiator_id],
    is_muted: preferenceByConversation.get(r.id)?.is_muted ?? false,
    is_archived: preferenceByConversation.get(r.id)?.is_archived ?? false,
  }));
}

export async function updateConversationPreference(
  conversationId: string,
  userId: string,
  preference: { is_muted?: boolean; is_archived?: boolean },
): Promise<string | null> {
  const { data: current, error: lookupError } = await supabase
    .from('conversation_preferences')
    .select('is_muted,is_archived')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (lookupError) return lookupError.message;

  const { error } = await supabase.from('conversation_preferences').upsert(
    {
      conversation_id: conversationId,
      user_id: userId,
      is_muted: preference.is_muted ?? current?.is_muted ?? false,
      is_archived: preference.is_archived ?? current?.is_archived ?? false,
    },
    { onConflict: 'conversation_id,user_id' },
  );
  return error?.message ?? null;
}

export async function getConversationPreference(
  conversationId: string,
  userId: string,
): Promise<{ is_muted: boolean; is_archived: boolean }> {
  const { data, error } = await supabase
    .from('conversation_preferences')
    .select('is_muted,is_archived')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return { is_muted: data?.is_muted ?? false, is_archived: data?.is_archived ?? false };
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
