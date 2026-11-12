import { router, useLocalSearchParams } from 'expo-router';
import { Check, ChevronLeft, Image as ImageIcon, Mic, Send, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, EmptyState } from '@/components/ui';
import { MessageBubble } from '@/components/MessageBubble';
import { ImageViewerModal } from '@/components/ImageViewerModal';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { sendMessage } from '@/services/chat';
import { pickImage } from '@/services/mediaPicker';
import { uploadMedia } from '@/services/storageService';
import { timeAgo } from '@/lib/format';
import type { Attachment, ConversationStatus, MessageRow, Profile } from '@/types';

const QUICK_REACTIONS = ['❤️', '😂', '👍', '🥰', '🔥'];

type Conversation = {
  id: string;
  initiator_id: string;
  recipient_id: string;
  status: ConversationStatus;
};

export default function ChatScreen() {
  const { id, att_id, att_title, att_sub, att_image } = useLocalSearchParams<{
    id: string;
    att_id?: string;
    att_title?: string;
    att_sub?: string;
    att_image?: string;
  }>();
  const { user } = useAuth();
  const currentUserId = user?.id;
  const messagesListRef = useRef<FlatList<MessageRow>>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [other, setOther] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceHint, setVoiceHint] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<Attachment | null>(() => {
    if (!att_id || !att_title) return null;
    return {
      kind: 'listing',
      id: att_id,
      title: att_title,
      subtitle: att_sub,
      image: att_image || null,
    };
  });

  const loadConversation = useCallback(async () => {
    if (!id || !user) return;
    const { data, error: conversationError } = await supabase
      .from('conversations')
      .select('id, initiator_id, recipient_id, status')
      .eq('id', id)
      .maybeSingle();
    setError(null);
    if (conversationError) {
      setError(conversationError.message);
      return;
    }
    if (!data || (data.initiator_id !== user.id && data.recipient_id !== user.id)) {
      setError('Bu sohbete erişilemiyor.');
      setConversation(null);
      return;
    }

    const current = data as Conversation;
    setConversation(current);
    const otherId = current.initiator_id === user.id ? current.recipient_id : current.initiator_id;
    const [{ data: profile }, { data: rows, error: messagesError }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', otherId).maybeSingle(),
      supabase.from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: true }),
    ]);
    setOther((profile as Profile | null) ?? null);
    if (messagesError) {
      setError(messagesError.message);
      return;
    }
    setMessages((rows ?? []) as MessageRow[]);
  }, [id, user]);

  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(loadConversation)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadConversation]);

  useEffect(() => {
    if (!id || !currentUserId || !conversation) return;
    const isParticipant =
      conversation.initiator_id === currentUserId || conversation.recipient_id === currentUserId;
    if (!isParticipant) return;

    const channel = supabase
      .channel(`chat-${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${id}`,
      }, (payload) => {
        const incoming = payload.new as MessageRow;
        if (
          incoming.conversation_id !== id ||
          incoming.sender_id === currentUserId ||
          (conversation.initiator_id !== incoming.sender_id && conversation.recipient_id !== incoming.sender_id)
        ) {
          return;
        }

        setMessages((current) => {
          if (current.some((message) => message.id === incoming.id)) return current;
          return [...current, incoming];
        });
        requestAnimationFrame(() => messagesListRef.current?.scrollToEnd({ animated: true }));
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, currentUserId, conversation]);

  const acceptRequest = async (status: 'accepted' | 'rejected') => {
    if (!conversation || !user || updatingStatus) return;
    setUpdatingStatus(true);
    const { error: updateError } = await supabase
      .from('conversations')
      .update({ status })
      .eq('id', conversation.id)
      .eq('recipient_id', user.id);
    setUpdatingStatus(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    if (status === 'rejected') {
      router.back();
      return;
    }
    setConversation({ ...conversation, status });
  };

  const submit = async () => {
    if (!user || !conversation || sending) return;
    const body = draft.trim();
    if (!body && !pendingAttachment) return;
    setSending(true);
    setError(null);
    const result = await sendMessage(conversation.id, user.id, body, pendingAttachment);
    setSending(false);
    if (result.error || !result.message) {
      setError(result.error ?? 'Mesaj gönderilemedi.');
      return;
    }
    setMessages((current) => {
      if (current.some((message) => message.id === result.message!.id)) return current;
      return [...current, result.message!];
    });
    setDraft('');
    setPendingAttachment(null);
    requestAnimationFrame(() => messagesListRef.current?.scrollToEnd({ animated: true }));
  };

  const editMessage = async (messageId: string, body: string) => {
    if (!user) return false;
    const previous = messages.find((message) => message.id === messageId);
    if (!previous) return false;
    const editedAt = new Date().toISOString();

    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, body, edited_at: editedAt } : message,
      ),
    );
    const { data, error: updateError } = await supabase
      .from('messages')
      .update({ body, edited_at: editedAt })
      .eq('id', messageId)
      .eq('sender_id', user.id)
      .select('id')
      .maybeSingle();
    if (updateError || !data) {
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? { ...message, body: previous.body, edited_at: previous.edited_at }
            : message,
        ),
      );
      Alert.alert('Mesaj düzenlenemedi', updateError?.message ?? 'Bu mesajı düzenleme iznin olmayabilir.');
      return false;
    }
    return true;
  };

  const deleteMessage = async (messageId: string) => {
    if (!user) return;
    const deleted = messages.find((message) => message.id === messageId);
    if (!deleted) return;

    setMessages((current) => current.filter((message) => message.id !== messageId));
    const { data, error: deleteError } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId)
      .eq('sender_id', user.id)
      .select('id')
      .maybeSingle();
    if (deleteError || !data) {
      setMessages((current) => {
        if (current.some((message) => message.id === messageId)) return current;
        return [...current, deleted].sort(
          (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
        );
      });
      Alert.alert('Mesaj silinemedi', deleteError?.message ?? 'Bu mesajı silme iznin olmayabilir.');
    }
  };

  const confirmDeleteMessage = (messageId: string) => {
    Alert.alert('Mesajı sil', 'Bu mesajı silmek istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => void deleteMessage(messageId),
      },
    ]);
  };

  const chooseImage = async () => {
    if (uploadingImage || pendingAttachment) return;
    try {
      const picked = await pickImage();
      if (!picked) return;
      setUploadingImage(true);
      setError(null);
      const uploaded = await uploadMedia(picked.uri, { kind: 'image', folder: 'messages' });
      setPendingAttachment({
        kind: 'image',
        id: `${Date.now()}`,
        title: 'Fotoğraf',
        image: uploaded.path,
      });
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : 'Fotoğraf eklenemedi.';
      setError(message);
      Alert.alert('Fotoğraf eklenemedi', message);
    } finally {
      setUploadingImage(false);
    }
  };

  const addReactionToDraft = (emoji: string) => {
    setDraft((current) => `${current}${emoji}`);
  };

  const isPendingRequest = conversation?.status === 'pending' && conversation.recipient_id === user?.id;
  const canSend = conversation?.status === 'accepted' ||
    (conversation?.status === 'pending' && conversation.initiator_id === user?.id);

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-row items-center border-b border-gray-100 px-4 py-2 dark:border-gray-800">
        <Pressable onPress={() => router.back()} hitSlop={12} className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
          <ChevronLeft size={22} color="#0ea5e9" />
        </Pressable>
        <Avatar uri={other?.avatar_url} name={other?.full_name} size={40} />
        <View className="ml-3 flex-1">
          <Text className="font-semibold text-gray-900 dark:text-white">{other?.full_name || other?.username || 'Sohbet'}</Text>
          {other?.username ? <Text className="text-xs text-gray-500 dark:text-gray-400">@{other.username}</Text> : null}
        </View>
      </View>

      {error ? (
        <View className="m-4 rounded-xl bg-red-50 p-3 dark:bg-red-950">
          <Text className="text-sm text-red-700 dark:text-red-200">{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator className="mt-10" color="#0ea5e9" />
      ) : (
        <>
          {isPendingRequest ? (
            <View className="m-4 rounded-2xl bg-primary-50 p-4 dark:bg-gray-800">
              <Text className="mb-3 text-center text-sm text-gray-700 dark:text-gray-200">
                Bu kişiden bir mesaj isteği aldın.
              </Text>
              <View className="flex-row gap-3">
                <Pressable
                  disabled={updatingStatus}
                  onPress={() => acceptRequest('rejected')}
                  className="flex-1 flex-row items-center justify-center rounded-xl border border-gray-300 py-3 dark:border-gray-600"
                >
                  <X size={18} color="#6b7280" />
                  <Text className="ml-2 font-semibold text-gray-700 dark:text-gray-200">Reddet</Text>
                </Pressable>
                <Pressable
                  disabled={updatingStatus}
                  onPress={() => acceptRequest('accepted')}
                  className="flex-1 flex-row items-center justify-center rounded-xl bg-primary-500 py-3"
                >
                  {updatingStatus ? <ActivityIndicator color="#fff" /> : <Check size={18} color="#fff" />}
                  <Text className="ml-2 font-semibold text-white">Kabul et</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <FlatList
            ref={messagesListRef}
            className="flex-1"
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerClassName="px-4 py-4"
            ListEmptyComponent={
              <EmptyState title="Henüz mesaj yok" hint="Sohbeti başlatmak için bir mesaj gönder." />
            }
            renderItem={({ item }) => {
              const isOwn = item.sender_id === user?.id;
              const attachment = item.attachment;
              return (
                <MessageBubble
                  messageId={item.id}
                  message={item.body}
                  isOwn={isOwn}
                  time={timeAgo(item.created_at)}
                  isEdited={!!item.edited_at}
                  imageUri={attachment?.image}
                  attachmentTitle={attachment?.kind === 'image' ? null : attachment?.title}
                  attachmentSubtitle={attachment?.subtitle}
                  onImagePress={() => attachment?.image && setViewerUri(attachment.image)}
                  onEdit={editMessage}
                  onDelete={confirmDeleteMessage}
                />
              );
            }}
          />

          {pendingAttachment ? (
            <View className="mx-4 mb-2 flex-row items-center rounded-2xl bg-primary-50 p-2 dark:bg-gray-800">
              {pendingAttachment.image ? (
                <Image source={{ uri: pendingAttachment.image }} className="mr-3 h-12 w-12 rounded-xl" resizeMode="cover" />
              ) : null}
              <Text numberOfLines={1} className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-100">
                {pendingAttachment.title} eklendi
              </Text>
              <Pressable onPress={() => setPendingAttachment(null)} hitSlop={10}>
                <X size={18} color="#6b7280" />
              </Pressable>
            </View>
          ) : null}

          {canSend ? (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              {voiceHint ? (
                <Text className="px-5 pb-2 text-xs text-gray-500 dark:text-gray-400">
                  Sesli mesaj kaydı yakında kullanılabilecek.
                </Text>
              ) : null}
              <View className="flex-row items-center justify-between border-t border-gray-100 px-4 pb-1 pt-2 dark:border-gray-800">
                {QUICK_REACTIONS.map((emoji) => (
                  <Pressable
                    key={emoji}
                    onPress={() => addReactionToDraft(emoji)}
                    accessibilityRole="button"
                    accessibilityLabel={`${emoji} tepkisini mesaja ekle`}
                    hitSlop={8}
                    className="h-9 min-w-9 items-center justify-center rounded-full active:bg-gray-100 dark:active:bg-gray-800"
                  >
                    <Text className="text-xl">{emoji}</Text>
                  </Pressable>
                ))}
              </View>
              <View className="flex-row items-end gap-2 px-3 py-2">
                <Pressable
                  onPress={chooseImage}
                  disabled={uploadingImage || !!pendingAttachment}
                  accessibilityRole="button"
                  accessibilityLabel="Galeriden fotoğraf ekle"
                  className="h-11 w-11 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 disabled:opacity-50"
                >
                  {uploadingImage ? <ActivityIndicator size="small" color="#0ea5e9" /> : <ImageIcon size={21} color="#0ea5e9" />}
                </Pressable>
                <Pressable
                  onPress={() => setVoiceHint((shown) => !shown)}
                  accessibilityRole="button"
                  accessibilityLabel="Sesli mesaj kaydı"
                  className="h-11 w-11 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"
                >
                  <Mic size={20} color="#6b7280" />
                </Pressable>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Mesaj yaz..."
                  placeholderTextColor="#9ca3af"
                  multiline
                  maxLength={4000}
                  className="max-h-28 min-h-11 flex-1 rounded-3xl bg-gray-100 px-4 py-3 text-base text-gray-900 dark:bg-gray-800 dark:text-white"
                />
                <Pressable
                  onPress={submit}
                  disabled={sending || (!draft.trim() && !pendingAttachment)}
                  className="h-11 w-11 items-center justify-center rounded-full bg-primary-500 disabled:opacity-50"
                >
                  {sending ? <ActivityIndicator color="#fff" /> : <Send size={19} color="#fff" />}
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          ) : !isPendingRequest ? (
            <Text className="px-5 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
              Bu sohbette mesaj gönderilemiyor.
            </Text>
          ) : null}
        </>
      )}
      <ImageViewerModal
        visible={viewerUri !== null}
        uri={viewerUri}
        onClose={() => setViewerUri(null)}
      />
    </SafeAreaView>
  );
}
