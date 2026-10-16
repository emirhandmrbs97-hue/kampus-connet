import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Send, ShoppingBag, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Button } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { sendMessage } from '@/services/chat';
import { fetchProfiles } from '@/services/profiles';
import type { Attachment, ConversationRow, ConversationStatus, MessageRow, Profile } from '@/types';

function AttachmentCard({ a, mine }: { a: Attachment; mine: boolean }) {
  const onPress = () => {
    if (a.kind === 'listing') router.push({ pathname: '/listing/[id]', params: { id: a.id } });
  };
  return (
    <Pressable
      onPress={onPress}
      className={`mb-1 w-56 overflow-hidden rounded-2xl ${mine ? 'bg-primary-600' : 'bg-white dark:bg-gray-700'}`}
    >
      {a.image ? (
        <Image source={{ uri: a.image }} className="h-28 w-full" resizeMode="cover" />
      ) : (
        <View className="h-16 w-full items-center justify-center bg-black/10">
          <ShoppingBag size={22} color={mine ? '#fff' : '#9ca3af'} />
        </View>
      )}
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
    </Pressable>
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

  const [conv, setConv] = useState<ConversationRow | null>(null);
  const [other, setOther] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
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

  const load = useCallback(async () => {
    if (!me) return;
    const { data: c } = await supabase.from('conversations').select('*').eq('id', id).maybeSingle();
    const row = c as ConversationRow | null;
    setConv(row);
    if (row) {
      const otherId = row.initiator_id === me ? row.recipient_id : row.initiator_id;
      const profiles = await fetchProfiles([otherId]);
      setOther(profiles[otherId] ?? null);
    }
    const { data: m } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
      .limit(300);
    setMessages((m ?? []) as MessageRow[]);
  }, [id, me]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`chat-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        (payload) => {
          const m = payload.new as MessageRow;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

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

  const setStatus = async (status: ConversationStatus) => {
    const { error } = await supabase.from('conversations').update({ status }).eq('id', id);
    if (error) return Alert.alert('İşlem yapılamadı', error.message);
    setConv((c) => (c ? { ...c, status } : c));
    if (status !== 'accepted') router.back();
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator color="#0ea5e9" />
      </SafeAreaView>
    );
  }

  const reversed = [...messages].reverse();

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-row items-center border-b border-gray-100 px-3 py-2 dark:border-gray-800">
        <Pressable onPress={() => router.back()} hitSlop={12} className="mr-1 p-1">
          <ChevronLeft size={26} color="#9ca3af" />
        </Pressable>
        <Avatar uri={other?.avatar_url} name={other?.full_name} size={38} />
        <View className="ml-3">
          <Text className="font-semibold text-gray-900 dark:text-white">{other?.full_name || other?.username}</Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">@{other?.username}</Text>
        </View>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={reversed}
          inverted
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
          renderItem={({ item }) => {
            const mine = item.sender_id === me;
            return (
              <View className={`mb-2 ${mine ? 'items-end' : 'items-start'}`}>
                {item.attachment ? <AttachmentCard a={item.attachment} mine={mine} /> : null}
                {item.body ? (
                  <View
                    className={`max-w-[80%] rounded-3xl px-4 py-2.5 ${
                      mine ? 'rounded-br-md bg-primary-500' : 'rounded-bl-md bg-gray-100 dark:bg-gray-800'
                    }`}
                  >
                    <Text className={mine ? 'text-base text-white' : 'text-base text-gray-900 dark:text-white'}>
                      {item.body}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          }}
        />

        {iAmRecipient && conv?.status === 'pending' ? (
          <View className="border-t border-gray-100 p-4 dark:border-gray-800">
            <Text className="mb-3 text-center text-sm text-gray-500 dark:text-gray-400">
              Bu kişi seni takip etmiyor. Mesaj isteğini yanıtla.
            </Text>
            <View className="flex-row gap-2">
              <Button title="Kabul et" onPress={() => setStatus('accepted')} className="flex-1" />
              <Button title="Reddet" variant="outline" onPress={() => setStatus('rejected')} className="flex-1" />
              <Button title="Engelle" variant="danger" onPress={() => setStatus('blocked')} className="flex-1" />
            </View>
          </View>
        ) : iAmRecipient && conv && (conv.status === 'rejected' || conv.status === 'blocked') ? (
          <View className="border-t border-gray-100 p-4 dark:border-gray-800">
            <Text className="mb-3 text-center text-sm text-gray-500 dark:text-gray-400">
              Bu sohbet spam klasöründe.
            </Text>
            <Button title="Spam'den çıkar ve kabul et" variant="soft" onPress={() => setStatus('accepted')} />
          </View>
        ) : !canSend ? (
          <View className="border-t border-gray-100 p-4 dark:border-gray-800">
            <Text className="text-center text-sm text-gray-500 dark:text-gray-400">
              Bu kişiye şu an mesaj gönderemezsin.
            </Text>
          </View>
        ) : (
          <View className="border-t border-gray-100 px-4 py-3 dark:border-gray-800">
            {pending ? (
              <View className="mb-2 flex-row items-center rounded-2xl bg-primary-50 p-2.5 dark:bg-gray-800">
                <ShoppingBag size={16} color="#0ea5e9" />
                <Text numberOfLines={1} className="ml-2 flex-1 text-sm text-gray-800 dark:text-gray-200">
                  {pending.title}
                </Text>
                <Pressable onPress={() => setPending(null)} hitSlop={10}>
                  <X size={16} color="#9ca3af" />
                </Pressable>
              </View>
            ) : null}
            <View className="flex-row items-center">
              <TextInput
                className="mr-2 max-h-28 flex-1 rounded-3xl bg-gray-100 px-4 py-3 text-base text-gray-900 dark:bg-gray-800 dark:text-white"
                placeholder="Mesaj yaz..."
                placeholderTextColor="#9ca3af"
                multiline
                value={text}
                onChangeText={setText}
              />
              <Pressable
                onPress={send}
                disabled={sending || (!text.trim() && !pending)}
                className={`h-11 w-11 items-center justify-center rounded-full bg-primary-500 ${
                  !text.trim() && !pending ? 'opacity-50' : ''
                }`}
              >
                <Send size={18} color="#fff" />
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
