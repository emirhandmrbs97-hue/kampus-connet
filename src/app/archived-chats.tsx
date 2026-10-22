import { router, useFocusEffect } from 'expo-router';
import { BellOff, ChevronLeft, MoreHorizontal } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, EmptyState } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { goBack } from '@/lib/navigation';
import { loadConversations, updateConversationPreference } from '@/services/chat';
import { timeAgo } from '@/lib/format';
import type { ConversationView } from '@/types';

export default function ArchivedChatsScreen() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const rows = await loadConversations(user.id);
      setConversations(rows.filter((conversation) => conversation.is_archived));
    } catch (error) {
      console.error('Arşivlenen sohbetler yüklenemedi:', error);
      Alert.alert('Arşiv açılamadı', error instanceof Error ? error.message : 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const updatePreference = async (
    conversation: ConversationView,
    preference: { is_muted?: boolean; is_archived?: boolean },
  ) => {
    if (!user) return;
    const error = await updateConversationPreference(conversation.id, user.id, preference);
    if (error) {
      Alert.alert('Sohbet ayarı kaydedilemedi', error);
      return;
    }
    setConversations((current) =>
      current
        .map((item) => (item.id === conversation.id ? { ...item, ...preference } : item))
        .filter((item) => item.is_archived),
    );
  };

  const showActions = (conversation: ConversationView) => {
    Alert.alert(conversation.other?.full_name || 'Sohbet seçenekleri', undefined, [
      {
        text: conversation.is_muted ? 'Sessizden çıkar' : 'Sessize al',
        onPress: () => void updatePreference(conversation, { is_muted: !conversation.is_muted }),
      },
      {
        text: 'Arşivden çıkar',
        onPress: () => void updatePreference(conversation, { is_archived: false }),
      },
      { text: 'Vazgeç', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-row items-center px-5 pb-4 pt-2">
        <Pressable onPress={() => goBack('/(tabs)/messages')} className="mr-3" hitSlop={10}>
          <ChevronLeft size={24} color="#6b7280" />
        </Pressable>
        <Text className="text-2xl font-extrabold text-gray-900 dark:text-white">Arşivlenen sohbetler</Text>
      </View>
      {loading ? (
        <ActivityIndicator className="mt-10" color="#0ea5e9" />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(conversation) => conversation.id}
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
          ListEmptyComponent={<EmptyState title="Arşiv boş" hint="Arşivlediğin sohbetler burada görünür." />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })}
              className="flex-row items-center px-5 py-3"
            >
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
              {item.is_muted ? <BellOff size={15} color="#9ca3af" className="ml-2" /> : null}
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  showActions(item);
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
    </SafeAreaView>
  );
}
