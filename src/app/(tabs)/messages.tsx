import { router, useFocusEffect } from 'expo-router';
import { Archive, BellOff, MessageCircle, MoreHorizontal, Plus, Search, Sparkles, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NewMessageSheet } from '@/components/NewMessageSheet';
import { Avatar, EmptyState, Segmented } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/format';
import { loadConversations, updateConversationPreference } from '@/services/chat';
import type { ConversationView } from '@/types';

type Tab = 'inbox' | 'requests' | 'spam';
let messageListChannelSequence = 0;

export default function Messages() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('inbox');
  const [convs, setConvs] = useState<ConversationView[]>([]);
  const [filteredConvs, setFilteredConvs] = useState<ConversationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setConvs(await loadConversations(user.id));
    } catch (error) {
      console.error('Sohbetler yüklenemedi:', error);
      Alert.alert('Sohbetler yüklenemedi', error instanceof Error ? error.message : 'Bir hata oluştu.');
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load()
        .catch((error: unknown) => {
          console.error('Sohbet listesi yenilenemedi:', error);
        })
        .finally(() => setLoading(false));
    }, [load]),
  );

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`message-list-${user.id}-${++messageListChannelSequence}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        void payload;
        void load();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        void payload;
        void load();
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Mesaj listesi Realtime bağlantısı kurulamadı:', status);
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, user]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredConvs(convs);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = convs.filter(
        (c) =>
          c.other?.full_name?.toLowerCase().includes(query) ||
          c.other?.username?.toLowerCase().includes(query) ||
          c.last_message?.toLowerCase().includes(query),
      );
      setFilteredConvs(filtered);
    }
  }, [convs, searchQuery]);

  const me = user?.id;
  const inbox = filteredConvs.filter(
    (c) => c.status === 'accepted' || (c.status === 'pending' && c.initiator_id === me),
  );
  const requests = filteredConvs.filter((c) => c.status === 'pending' && c.recipient_id === me);
  const spam = filteredConvs.filter((c) => (c.status === 'rejected' || c.status === 'blocked') && c.recipient_id === me);
  const lists: Record<Tab, ConversationView[]> = { inbox, requests, spam };

  const open = (id: string) => router.push({ pathname: '/chat/[id]', params: { id } });

  const changeConversationPreference = async (
    conversation: ConversationView,
    key: 'is_muted' | 'is_archived',
    value: boolean,
  ) => {
    if (!user) return;
    const error = await updateConversationPreference(conversation.id, user.id, { [key]: value });
    if (error) {
      Alert.alert('Sohbet ayarı kaydedilemedi', error);
      return;
    }
    setConvs((current) =>
      current.map((item) => (item.id === conversation.id ? { ...item, [key]: value } : item)),
    );
  };

  const showConversationActions = (conversation: ConversationView) => {
    Alert.alert(
      conversation.other?.full_name || conversation.other?.username || t('messages'),
      undefined,
      [
        {
          text: conversation.is_muted ? t('unmuteChat') : t('muteChat'),
          onPress: () => void changeConversationPreference(conversation, 'is_muted', !conversation.is_muted),
        },
        {
          text: t('archiveChat'),
          onPress: () => void changeConversationPreference(conversation, 'is_archived', true),
        },
        { text: t('cancel'), style: 'cancel' },
      ],
    );
  };

  const visibleConversations = lists[tab].filter((conversation) => !conversation.is_archived);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-gray-50 dark:bg-[#11111b]">
      <View className="px-5 pt-3">
        <View className="mb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-xs font-bold uppercase tracking-[2px] text-violet-600 dark:text-violet-300">KampüsHub</Text>
            <Text className="mt-1 text-3xl font-black text-gray-950 dark:text-white">{t('messages')}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => router.push('/archived-chats')}
              accessibilityRole="button"
              accessibilityLabel="Arşivlenen sohbetler"
              className="h-11 flex-row items-center justify-center rounded-2xl border border-gray-200 bg-white px-3 shadow-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <Archive size={17} color="#7c3aed" />
              <Text className="ml-1.5 text-xs font-bold text-gray-700 dark:text-gray-200">{t('archive')}</Text>
            </Pressable>
            <Pressable
              onPress={() => setNewOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Yeni mesaj"
              className="h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 shadow-md shadow-violet-300 dark:shadow-none"
            >
              <Plus size={23} color="#fff" strokeWidth={2.8} />
            </Pressable>
          </View>
        </View>

        <View className="flex-row items-center rounded-2xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <Search size={19} color="#9ca3af" />
          <TextInput
            placeholder={t('searchChats')}
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="ml-3 flex-1 text-[15px] text-gray-900 dark:text-white"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} className="ml-2">
              <X size={18} color="#9ca3af" />
            </Pressable>
          )}
        </View>
      </View>

      <View className="px-5 py-4">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'inbox', label: t('messages') },
            { value: 'requests', label: t('requests'), badge: requests.length },
            { value: 'spam', label: t('spam') },
          ]}
        />
      </View>

      {loading ? (
        <ActivityIndicator className="mt-10" color="#0ea5e9" />
      ) : (
        <FlatList
          data={visibleConversations}
          keyExtractor={(c) => c.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
            />
          }
          ListEmptyComponent={
            visibleConversations.length === 0 && convs.some((conversation) => conversation.is_archived) && tab === 'inbox' ? (
              <EmptyState title={t('inboxEmpty')} hint={t('archivedHint')} icon={<Archive size={32} color="#8b5cf6" />} />
            ) : searchQuery ? (
              <EmptyState title={t('noResults')} hint={t('trySearch')} />
            ) : (
              <EmptyState
                title={tab === 'inbox' ? t('noMessages') : tab === 'requests' ? t('noRequests') : t('spamEmpty')}
                hint={
                  tab === 'inbox' ? t('startChatHint') : tab === 'requests' ? t('requestHint') : t('spamHint')
                }
                icon={tab === 'inbox' ? <MessageCircle size={34} color="#8b5cf6" /> : <Sparkles size={34} color="#8b5cf6" />}
              />
            )
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => open(item.id)} className="mx-4 mb-2 flex-row items-center rounded-3xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm active:bg-violet-50 dark:border-gray-800 dark:bg-gray-900 dark:active:bg-gray-800">
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  if (item.other?.id) router.push({ pathname: '/profile/[id]', params: { id: item.other.id } });
                }}
              >
                <View className="rounded-full border-2 border-violet-100 p-0.5 dark:border-violet-900">
                  <Avatar uri={item.other?.avatar_url} name={item.other?.full_name} size={48} />
                </View>
              </Pressable>
              <View className="ml-3 flex-1">
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    if (item.other?.id) router.push({ pathname: '/profile/[id]', params: { id: item.other.id } });
                  }}
                >
                  <Text className="text-[15px] font-extrabold text-gray-900 dark:text-white">
                    {item.other?.full_name || item.other?.username}
                  </Text>
                </Pressable>
                <Text numberOfLines={1} className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
                  {item.last_message ?? 'Sohbeti başlat'}
                </Text>
              </View>
              <Text className="text-[11px] font-medium text-gray-400">{timeAgo(item.last_message_at)}</Text>
              {item.is_muted ? <BellOff size={15} color="#9ca3af" className="ml-2" /> : null}
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  showConversationActions(item);
                }}
                accessibilityRole="button"
                accessibilityLabel="Sohbet seçenekleri"
                hitSlop={10}
                className="ml-3 p-1"
              >
                <MoreHorizontal size={20} color="#9ca3af" />
              </Pressable>
            </Pressable>
          )}
        />
      )}

      <NewMessageSheet visible={newOpen} onClose={() => { setNewOpen(false); setSearchQuery(''); }} onOpenChat={open} initialQuery={searchQuery} />
    </SafeAreaView>
  );
}
