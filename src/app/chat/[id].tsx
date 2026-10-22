import { router, useLocalSearchParams } from 'expo-router';
import { BellOff, ChevronLeft, Eye, Image as ImageIcon, MoreHorizontal, Send, ShoppingBag, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { resolveMediaUrl } from '@/services/storageService';

import { Avatar, Button } from '@/components/ui';
import { StorageImage } from '@/components/StorageImage';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useNotifications } from '@/context/NotificationsContext';
import { goBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import {
  closeEphemeralChatPhoto,
  getConversationPreference,
  openEphemeralChatPhoto,
  sendMessage,
  updateConversationPreference,
  type EphemeralPhotoMode,
} from '@/services/chat';
import { pickImage } from '@/services/mediaPicker';
import { fetchProfiles } from '@/services/profiles';
import { uploadMedia } from '@/services/storageService';
import type { Attachment, ConversationRow, ConversationStatus, MessageRow, Profile } from '@/types';

let chatChannelSequence = 0;

function AttachmentCard({
  message,
  mine,
  onLongPress,
  onOpenPhoto,
  t,
}: {
  message: MessageRow;
  mine: boolean;
  onLongPress: () => void;
  onOpenPhoto: () => void;
  t: (
    key:
      | 'tapToViewPhoto'
      | 'photoExpired'
      | 'photo3Seconds'
      | 'photo10Seconds'
      | 'photoOneView'
      | 'photoTwoViews',
  ) => string;
}) {
  const a = message.attachment;
  if (!a) return null;
  const isEphemeral = a.kind === 'image' && a.view_mode && a.view_mode !== 'normal';
  const maxViews = a.view_mode === 'twice' ? 2 : 1;
  const isUnavailable = isEphemeral && !mine && message.photo_views_used >= maxViews;
  const showSealedPhoto = isEphemeral && !mine;
  const onPress = () => {
    if (a.kind === 'listing') router.push({ pathname: '/listing/[id]', params: { id: a.id } });
    else if (showSealedPhoto && !isUnavailable) onOpenPhoto();
  };
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      className={`mb-1 w-56 overflow-hidden rounded-2xl ${mine ? 'bg-primary-600' : 'bg-white dark:bg-gray-700'}`}
    >
      {a.kind === 'image' ? (
        showSealedPhoto ? (
          <View className="h-48 w-full items-center justify-center bg-violet-100 dark:bg-gray-800">
            <View className="mb-2 h-12 w-12 items-center justify-center rounded-full bg-white dark:bg-gray-700">
              <Eye size={24} color="#7c3aed" />
            </View>
            <Text className="font-semibold text-violet-800 dark:text-violet-200">
              {isUnavailable ? t('photoExpired') : t('tapToViewPhoto')}
            </Text>
            <Text className="mt-1 text-xs text-violet-600 dark:text-violet-300">
              {a.view_mode === '3s'
                ? t('photo3Seconds')
                : a.view_mode === '10s'
                  ? t('photo10Seconds')
                  : a.view_mode === 'twice'
                    ? `${Math.max(0, maxViews - message.photo_views_used)}/2`
                    : t('photoOneView')}
            </Text>
          </View>
        ) : a.image ? (
          <StorageImage uri={a.image} className="h-60 w-full" resizeMode="cover" />
        ) : null
      ) : a.image ? (
        (
          <StorageImage uri={a.image} className="h-28 w-full" resizeMode="cover" />
        )
      ) : (
        <View className="h-16 w-full items-center justify-center bg-black/10">
          <ShoppingBag size={22} color={mine ? '#fff' : '#9ca3af'} />
        </View>
      )}
      {a.kind !== 'image' ? (
        <View className="p-3">
          <Text numberOfLines={2} className={`font-semibold ${mine ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
            {a.title}
          </Text>
          {a.subtitle ? (
            <Text className={`mt-0.5 text-xs ${mine ? 'text-white/80' : 'text-gray-500 dark:text-gray-300'}`}>
              {a.subtitle}
            </Text>
          ) : null}
          <Text className={`mt-1 text-xs ${mine ? 'text-white/70' : 'text-primary-600'}`}>
            {a.kind === 'listing' ? 'İlan' : 'Gönderi'}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function EphemeralPhotoViewer({
  message,
  onClose,
  onViewed,
  t,
}: {
  message: MessageRow;
  onClose: () => void;
  onViewed: () => void;
  t: (key: 'photoUnavailable' | 'closePhoto') => string;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const closeRef = useRef(onClose);
  const viewedRef = useRef(onViewed);
  const finishRef = useRef<() => void>(() => undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerStartedRef = useRef(false);
  closeRef.current = onClose;
  viewedRef.current = onViewed;
  finishRef.current = () => {
    viewedRef.current();
    closeRef.current();
  };

  useEffect(() => {
    let active = true;
    let granted = false;
    let released = false;
    const release = () => {
      if (!granted || released) return;
      released = true;
      void closeEphemeralChatPhoto(message.id).catch((closeError: unknown) => {
        console.error('Geçici fotoğraf erişimi kapatılamadı:', closeError);
      });
    };

    void openEphemeralChatPhoto(message.id)
      .then((grant) => {
        granted = true;
        if (!active) {
          release();
          return;
        }
        setImageUrl(grant.signedUrl);
        setDurationSeconds(grant.durationSeconds);
        setLoading(false);
      })
      .catch((openError: unknown) => {
        if (!active) return;
        setError(openError instanceof Error ? openError.message : t('photoUnavailable'));
        setLoading(false);
      });

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') finishRef.current();
    });

    return () => {
      active = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      appStateSubscription.remove();
      release();
    };
  }, [message.id, t]);

  const startDisplayTimer = () => {
    if (loading || !imageUrl || error || !durationSeconds || timerStartedRef.current) return;
    timerStartedRef.current = true;
    timerRef.current = setTimeout(finishRef.current, durationSeconds * 1000);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={finishRef.current} statusBarTranslucent>
      <StatusBar hidden />
      <View className="flex-1 items-center justify-center bg-black">
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            resizeMode="contain"
            className="h-full w-full"
            onLoadEnd={startDisplayTimer}
            onError={() => {
              setError(t('photoUnavailable'));
              finishRef.current();
            }}
          />
        ) : null}
        {loading ? <ActivityIndicator size="large" color="#fff" /> : null}
        {error ? (
          <Text className="px-8 text-center text-base text-white">{error}</Text>
        ) : null}
        <Pressable
          onPress={finishRef.current}
          accessibilityRole="button"
          accessibilityLabel={t('closePhoto')}
          className="absolute right-5 top-12 h-11 w-11 items-center justify-center rounded-full bg-black/60"
        >
          <X size={24} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}

export default function Chat() {
  const params = useLocalSearchParams<{
    id: string;
    att_id?: string;
    att_title?: string;
    att_sub?: string;
    att_image?: string;
  }>();
  const id = params.id;
  const { user } = useAuth();
  const { t } = useLanguage();
  const { refreshUnreadCount } = useNotifications();

  const [conv, setConv] = useState<ConversationRow | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [other, setOther] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoToView, setPhotoToView] = useState<MessageRow | null>(null);
  const [fullScreenImageVisible, setFullScreenImageVisible] = useState(false);
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);
  const [pending, setPending] = useState<Attachment | null>(
    params.att_id
      ? {
          kind: 'listing',
          id: params.att_id,
          title: params.att_title ?? 'İlan',
          subtitle: params.att_sub || undefined,
          image: params.att_image || null,
        }
      : null,
  );

  const me = user?.id;

  const markChatNotificationsRead = useCallback(async () => {
    if (!me || !id) return;
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', me)
      .eq('type', 'message')
      .eq('related_type', 'chat')
      .eq('related_id', id)
      .is('read_at', null);
    if (error) {
      console.error('Sohbet bildirimleri okundu olarak işaretlenemedi:', error);
      return;
    }
    await refreshUnreadCount();
  }, [id, me, refreshUnreadCount]);

  const load = useCallback(async () => {
    if (!me) return;
    const { data: c, error: conversationError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (conversationError) throw conversationError;
    const row = c as ConversationRow | null;
    setConv(row);
    if (row) {
      const preference = await getConversationPreference(id, me);
      setIsMuted(preference.is_muted);
      const otherId = row.initiator_id === me ? row.recipient_id : row.initiator_id;
      const profiles = await fetchProfiles([otherId]);
      setOther(profiles[otherId] ?? null);
    }
    const { data: m, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
      .limit(300);
    if (messagesError) throw messagesError;
    setMessages((m ?? []) as MessageRow[]);
    await markChatNotificationsRead();
  }, [id, markChatNotificationsRead, me]);

  useEffect(() => {
    load()
      .catch((error: unknown) => {
        console.error('Sohbet yüklenemedi:', error);
        Alert.alert('Sohbet yüklenemedi', error instanceof Error ? error.message : 'Bir hata oluştu.');
      })
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`chat-${id}-${++chatChannelSequence}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        (payload) => {
          const m = payload.new as MessageRow;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_id !== me) void markChatNotificationsRead();
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        (payload) => {
          const removed = payload.old as { id?: string };
          if (removed.id) setMessages((current) => current.filter((message) => message.id !== removed.id));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, markChatNotificationsRead, me]);

  const iAmRecipient = !!conv && conv.recipient_id === me;
  const canSend = !!conv && (conv.status === 'accepted' || (conv.status === 'pending' && conv.initiator_id === me));

  const send = async () => {
    if (!me || !canSend) return;
    if (!text.trim() && !pending) return;
    setSending(true);
    const { message, error } = await sendMessage(id, me, text, pending);
    setSending(false);
    if (error || !message) return Alert.alert('Mesaj gönderilemedi', error ?? '');
    setMessages((prev) => (prev.some((x) => x.id === message.id) ? prev : [...prev, message]));
    setText('');
    setPending(null);
  };

  const attachPhoto = async () => {
    if (!me || !canSend || uploadingPhoto || sending) return;
    try {
      const picked = await pickImage();
      if (!picked) return;
      setUploadingPhoto(true);
      const uploaded = await uploadMedia(picked.uri, {
        kind: 'image',
        folder: 'messages',
        fileName: picked.name,
        file: picked.file,
      });
      setPending({
        kind: 'image',
        id: uploaded.url,
        title: t('addPhoto'),
        image: uploaded.url,
        view_mode: 'normal',
      });
    } catch (error) {
      Alert.alert(
        'Fotoğraf eklenemedi',
        error instanceof Error ? error.message : 'Fotoğraf seçilirken veya yüklenirken bir hata oluştu.',
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const updatePhotoAccess = (viewMode: NonNullable<Attachment['view_mode']>) => {
    setPending((current) => (current?.kind === 'image' ? { ...current, view_mode: viewMode } : current));
  };

  const recordPhotoViewed = (messageId: string) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? { ...message, photo_views_used: message.photo_views_used + 1 }
          : message,
      ),
    );
  };

  const setStatus = async (status: ConversationStatus) => {
    const { error } = await supabase.from('conversations').update({ status }).eq('id', id);
    if (error) return Alert.alert('İşlem yapılamadı', error.message);
    setConv((c) => (c ? { ...c, status } : c));
    if (status !== 'accepted') goBack('/(tabs)/messages');
  };

  const changePreference = async (key: 'is_muted' | 'is_archived', value: boolean) => {
    if (!me) return;
    const error = await updateConversationPreference(id, me, { [key]: value });
    if (error) {
      Alert.alert('Sohbet ayarı kaydedilemedi', error);
      return;
    }
    if (key === 'is_muted') setIsMuted(value);
    if (key === 'is_archived' && value) router.replace('/(tabs)/messages');
  };

  const showConversationActions = () => {
    Alert.alert(t('messages'), undefined, [
      {
        text: isMuted ? t('unmuteChat') : t('muteChat'),
        onPress: () => void changePreference('is_muted', !isMuted),
      },
      {
        text: t('archiveChat'),
        onPress: () => void changePreference('is_archived', true),
      },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };

  const deleteMessageForEveryone = (message: MessageRow) => {
    if (message.sender_id !== me) return;
    Alert.alert('Mesaj herkesten silinsin mi?', 'Bu işlem sohbetin iki tarafından da kaldırır.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Herkesten sil',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              const { data, error } = await supabase
                .from('messages')
                .delete()
                .eq('id', message.id)
                .eq('sender_id', me)
                .select('id');
              if (error) {
                Alert.alert('Mesaj silinemedi', error.message);
                return;
              }
              if (!data?.length) {
                Alert.alert('Mesaj silinemedi', 'Yalnızca kendi gönderdiğiniz mesajları silebilirsiniz.');
                return;
              }
              setMessages((current) => current.filter((currentMessage) => currentMessage.id !== message.id));
            } catch (error) {
              Alert.alert('Mesaj silinemedi', error instanceof Error ? error.message : 'Bir hata oluştu.');
            }
          })();
        },
      },
    ]);
  };

  const showMessageActions = (message: MessageRow) => {
    Alert.alert('Mesaj seçenekleri', undefined, [
      ...(message.sender_id === me
        ? [{ text: 'Herkesten sil', style: 'destructive' as const, onPress: () => deleteMessageForEveryone(message) }]
        : []),
      {
        text: isMuted ? 'Sohbeti sessizden çıkar' : 'Sohbeti sessize al',
        onPress: () => void changePreference('is_muted', !isMuted),
      },
      { text: 'Sohbeti arşivle', onPress: () => void changePreference('is_archived', true) },
      { text: 'Vazgeç', style: 'cancel' },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-gray-50 dark:bg-[#11111b]">
        <ActivityIndicator color="#7c3aed" />
      </SafeAreaView>
    );
  }

  const reversed = [...messages].reverse();

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-gray-50 dark:bg-[#11111b]">
      <View className="flex-row items-center border-b border-gray-100 bg-white px-3 py-3 dark:border-gray-800 dark:bg-gray-900">
        <Pressable onPress={() => goBack('/(tabs)/messages')} hitSlop={12} className="mr-2 h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 dark:bg-gray-800">
          <ChevronLeft size={24} color="#7c3aed" />
        </Pressable>
        <Pressable
          onPress={() =>
            other?.id && router.push({ pathname: '/profile/[id]', params: { id: other.id } })
          }
          accessibilityRole="link"
        >
          <View className="rounded-full border-2 border-violet-100 p-0.5 dark:border-violet-900">
            <Avatar uri={other?.avatar_url} name={other?.full_name} size={38} />
          </View>
        </Pressable>
        <Pressable
          onPress={() =>
            other?.id && router.push({ pathname: '/profile/[id]', params: { id: other.id } })
          }
          className="ml-3 flex-1"
          accessibilityRole="link"
        >
          <Text numberOfLines={1} className="font-extrabold text-gray-900 dark:text-white">{other?.full_name || other?.username}</Text>
          <Text className="text-xs font-medium text-violet-600 dark:text-violet-300">@{other?.username}</Text>
        </Pressable>
        {isMuted ? <BellOff size={17} color="#9ca3af" /> : null}
        <Pressable
          onPress={showConversationActions}
          accessibilityRole="button"
          accessibilityLabel="Sohbet seçenekleri"
          hitSlop={10}
          className="ml-auto h-10 w-10 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-800"
        >
          <MoreHorizontal size={22} color="#7c3aed" />
        </Pressable>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={reversed}
          inverted
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}
          renderItem={({ item }) => {
            const mine = item.sender_id === me;
            return (
              <Pressable
                onLongPress={() => showMessageActions(item)}
                delayLongPress={350}
                className={`mb-2 ${mine ? 'items-end' : 'items-start'}`}
              >
                {item.attachment ? (
                  <AttachmentCard
                    message={item}
                    mine={mine}
                    onLongPress={() => showMessageActions(item)}
                    onOpenPhoto={async () => {
                      const a = item.attachment;
                      if (a?.kind === 'image' && a.image && !a.view_mode) {
                        try {
                          const resolved = await resolveMediaUrl(a.image);
                          setResolvedImageUrl(resolved);
                          setFullScreenImageVisible(true);
                        } catch {
                          setPhotoToView(item);
                        }
                      } else {
                        setPhotoToView(item);
                      }
                    }}
                    t={t}
                  />
                ) : null}
                {item.body ? (
                  <View
                    className={`max-w-[82%] rounded-[24px] px-4 py-3 shadow-sm ${
                      mine ? 'rounded-br-md bg-violet-600' : 'rounded-bl-md border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-800'
                    }`}
                  >
                    <Text className={mine ? 'text-[15px] leading-5 text-white' : 'text-[15px] leading-5 text-gray-900 dark:text-white'}>
                      {item.body}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          }}
        />

        {iAmRecipient && conv?.status === 'pending' ? (
          <View className="border-t border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <Text className="mb-3 text-center text-sm text-gray-500 dark:text-gray-400">
              {t('messageRequestIntro')}
            </Text>
            <View className="flex-row gap-2">
              <Button title={t('accept')} onPress={() => setStatus('accepted')} className="flex-1" />
              <Button title={t('reject')} variant="outline" onPress={() => setStatus('rejected')} className="flex-1" />
              <Button title={t('block')} variant="danger" onPress={() => setStatus('blocked')} className="flex-1" />
            </View>
          </View>
        ) : iAmRecipient && conv && (conv.status === 'rejected' || conv.status === 'blocked') ? (
          <View className="border-t border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <Text className="mb-3 text-center text-sm text-gray-500 dark:text-gray-400">
              {t('spamConversation')}
            </Text>
            <Button title={t('restoreSpam')} variant="soft" onPress={() => setStatus('accepted')} />
          </View>
        ) : !canSend ? (
          <View className="border-t border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <Text className="text-center text-sm text-gray-500 dark:text-gray-400">
              {t('cannotMessage')}
            </Text>
          </View>
        ) : (
          <View className="border-t border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
            {pending ? (
              <View className="mb-2 flex-row items-center rounded-2xl bg-violet-50 p-2.5 dark:bg-gray-800">
                {pending.kind === 'image' && pending.image ? (
                  <StorageImage uri={pending.image} className="h-12 w-12 rounded-xl" resizeMode="cover" />
                ) : (
                  <ShoppingBag size={16} color="#7c3aed" />
                )}
                <Text numberOfLines={1} className="ml-2 flex-1 text-sm text-gray-800 dark:text-gray-200">
                  {pending.title}
                </Text>
                <Pressable onPress={() => setPending(null)} hitSlop={10}>
                  <X size={16} color="#9ca3af" />
                </Pressable>
              </View>
            ) : null}
            {pending?.kind === 'image' ? (
              <View className="mb-2">
                <Text className="mb-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
                  {t('photoAccess')}
                </Text>
                <View className="flex-row gap-1.5">
                  {(
                    [
                      ['normal', 'photoNormal'],
                      ['3s', 'photo3Seconds'],
                      ['10s', 'photo10Seconds'],
                      ['once', 'photoOneView'],
                      ['twice', 'photoTwoViews'],
                    ] as const
                  ).map(([mode, labelKey]) => {
                    const selected = pending.view_mode === mode;
                    return (
                      <Pressable
                        key={mode}
                        onPress={() => updatePhotoAccess(mode)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        className={`flex-1 items-center rounded-xl px-1 py-2 ${
                          selected ? 'bg-violet-600' : 'bg-gray-100 dark:bg-gray-800'
                        }`}
                      >
                        <Text
                          numberOfLines={1}
                          className={`text-[10px] font-semibold ${
                            selected ? 'text-white' : 'text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          {t(labelKey)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
            <View className="flex-row items-center">
              <Pressable
                onPress={() => void attachPhoto()}
                disabled={sending || uploadingPhoto}
                accessibilityRole="button"
                accessibilityLabel={t('addPhoto')}
                className="mr-2 h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 dark:bg-gray-800"
              >
                {uploadingPhoto ? (
                  <ActivityIndicator size="small" color="#7c3aed" />
                ) : (
                  <ImageIcon size={20} color="#7c3aed" />
                )}
              </Pressable>
              <TextInput
                className="mr-2 max-h-28 flex-1 rounded-[24px] border border-gray-200 bg-gray-50 px-4 py-3 text-[15px] text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                placeholder={t('chatPlaceholder')}
                placeholderTextColor="#9ca3af"
                multiline
                value={text}
                onChangeText={setText}
              />
              <Pressable
                onPress={send}
                disabled={sending || uploadingPhoto || (!text.trim() && !pending)}
                className={`h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 ${
                  sending || uploadingPhoto || (!text.trim() && !pending) ? 'opacity-50' : ''
                }`}
              >
                <Send size={18} color="#fff" />
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
      {photoToView ? (
        <EphemeralPhotoViewer
          message={photoToView}
          onClose={() => setPhotoToView(null)}
          onViewed={() => recordPhotoViewed(photoToView.id)}
          t={t}
        />
      ) : null}

      <Modal visible={fullScreenImageVisible} transparent animationType="fade" onRequestClose={() => setFullScreenImageVisible(false)}>
        <Pressable className="flex-1 bg-black" onPress={() => setFullScreenImageVisible(false)}>
          {resolvedImageUrl ? (
            <Image source={{ uri: resolvedImageUrl }} className="flex-1" resizeMode="contain" />
          ) : null}
          <Pressable
            onPress={() => setFullScreenImageVisible(false)}
            className="absolute top-8 right-4 h-10 w-10 items-center justify-center rounded-full bg-black/50"
          >
            <X size={24} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
