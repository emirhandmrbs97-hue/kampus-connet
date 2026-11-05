import { router, useFocusEffect } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NewMessageSheet } from '@/components/NewMessageSheet';
import { Avatar, EmptyState, Segmented } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { timeAgo } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { loadConversations } from '@/services/chat';
import type { ConversationView } from '@/types';

type Tab = 'messages' | 'requests' | 'spam';

const EMPTY: Record<Tab, { title: string; hint: string }> = {
  messages: { title: 'Henüz sohbet yok', hint: 'Sağ üstteki + ile biriyle yazışmaya başla.' },
  requests: { title: 'Bekleyen istek yok', hint: 'Seni takip etmeyenlerin mesajları burada görünür.' },
  spam: { title: 'Spam boş', hint: 'Reddettiğin ve engellediğin sohbetler burada durur.' },
};

export default function Messages() {
  const { user } = useAuth();
  const me = user?.id;

  const [tab, setTab] = useState<Tab>('messages');
  const [convs, setConvs] = useState<ConversationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  const load = useCallback(async () => {
    if (!me) return;
    setConvs(await loadConversations(me));
    setLoading(false);
  }, [me]);

  // Ekrana her dönüşte yenile
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Yeni mesaj gelince listeyi yenile
  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel(`inbox-${me}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me, load]);

  const lists: Record<Tab, ConversationView[]> = {
    messages: convs.filter((c) => c.status === 'accepted' || (c.status === 'pending' && c.initiator_id === me)),
    requests: convs.filter((c) => c.status === 'pending' && c.recipient_id === me),
    spam: convs.filter((c) => (c.status === 'rejected' || c.status === 'blocked') && c.recipient_id === me),
  };

  const openChat = (id: string) => router.push({ pathname: '/chat/[id]', params: { id } });

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-row items-center justify-between px-5 pt-2">
        <Text className="text-2xl font-extrabold text-gray-900 dark:text-white">Mesajlar</Text>
        <Pressable
          onPress={() => setNewOpen(true)}
          className="h-10 w-10 items-center justify-center rounded-full bg-primary-500"
        >
          <Plus size={22} color="#fff" />
        </Pressable>
      </View>

      <View className="px-5 py-3">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'messages', label: 'Mesajlar' },
            { value: 'requests', label: 'İstekler', badge: lists.requests.length },
            { value: 'spam', label: 'Spam' },
          ]}
        />
      </View>

      {loading ? (
        <ActivityIndicator className="mt-10" color="#0ea5e9" />
      ) : (
        <FlatList
          data={lists[tab]}
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
          ListEmptyComponent={<EmptyState title={EMPTY[tab].title} hint={EMPTY[tab].hint} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openChat(item.id)}
              className="flex-row items-center border-b border-gray-100 px-5 py-3.5 dark:border-gray-800"
            >
              <Avatar uri={item.other?.avatar_url} name={item.other?.full_name} size={50} />
              <View className="ml-3 flex-1">
                <View className="flex-row items-center justify-between">
                  <Text numberOfLines={1} className="flex-1 font-semibold text-gray-900 dark:text-white">
                    {item.other?.full_name || item.other?.username || 'Kullanıcı'}
                  </Text>
                  <Text className="ml-2 text-xs text-gray-500 dark:text-gray-400">{timeAgo(item.last_message_at)}</Text>
                </View>
                <Text numberOfLines={1} className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  {item.last_message ?? 'Yeni sohbet'}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}

      <NewMessageSheet visible={newOpen} onClose={() => setNewOpen(false)} onOpenChat={openChat} />
    </SafeAreaView>
  );
}
