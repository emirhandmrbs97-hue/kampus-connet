import { router, useFocusEffect } from 'expo-router';
import { Plus, Search, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NewMessageSheet } from '@/components/NewMessageSheet';
import { Avatar, EmptyState, Segmented } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { timeAgo } from '@/lib/format';
import { loadConversations } from '@/services/chat';
import type { ConversationView } from '@/types';

type Tab = 'inbox' | 'requests' | 'spam';

export default function Messages() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('inbox');
  const [convs, setConvs] = useState<ConversationView[]>([]);
  const [filteredConvs, setFilteredConvs] = useState<ConversationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setConvs(await loadConversations(user.id));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load]),
  );

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

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-gray-900">
      <View className="px-5 pt-2">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-2xl font-extrabold text-gray-900 dark:text-white">Mesajlar</Text>
          <Pressable
            onPress={() => setNewOpen(true)}
            className="h-10 w-10 items-center justify-center rounded-full bg-primary-500"
          >
            <Plus size={22} color="#fff" />
          </Pressable>
        </View>

        <View className="flex-row items-center rounded-xl bg-gray-100 dark:bg-gray-800 px-4 py-3">
          <Search size={20} className="text-gray-500 dark:text-gray-400" />
          <TextInput
            placeholder="Sohbet ara..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 ml-3 text-base text-gray-900 dark:text-white"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} className="ml-2">
              <X size={18} className="text-gray-500 dark:text-gray-400" />
            </Pressable>
          )}
        </View>
      </View>

      <View className="px-5 py-3">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'inbox', label: 'Mesajlar' },
            { value: 'requests', label: 'İstekler', badge: requests.length },
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
          ListEmptyComponent={
            searchQuery ? (
              <EmptyState title="Sonuç bulunamadı" hint="Farklı bir arama terimi deneyin veya yeni sohbet başlat." />
            ) : (
              <EmptyState
                title={tab === 'inbox' ? 'Mesaj yok' : tab === 'requests' ? 'Mesaj isteği yok' : 'Spam boş'}
                hint={
                  tab === 'inbox'
                    ? 'Sağ üstteki + ile yeni bir sohbet başlat.'
                    : tab === 'requests'
                      ? 'Takip etmediğin kişilerden gelen mesajlar burada görünür.'
                      : 'Reddettiğin veya engellediğin kişilerin mesajları burada görünür.'
                }
              />
            )
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => open(item.id)} className="flex-row items-center px-5 py-3 active:bg-gray-50 dark:active:bg-gray-800">
              <Avatar uri={item.other?.avatar_url} name={item.other?.full_name} size={52} />
              <View className="ml-3 flex-1">
                <Text className="font-semibold text-gray-900 dark:text-white">
                  {item.other?.full_name || item.other?.username}
                </Text>
                <Text numberOfLines={1} className="text-sm text-gray-500 dark:text-gray-400">
                  {item.last_message ?? 'Sohbeti başlat'}
                </Text>
              </View>
              <Text className="text-xs text-gray-400">{timeAgo(item.last_message_at)}</Text>
            </Pressable>
          )}
        />
      )}

      <NewMessageSheet visible={newOpen} onClose={() => { setNewOpen(false); setSearchQuery(''); }} onOpenChat={open} initialQuery={searchQuery} />
    </SafeAreaView>
  );
}
