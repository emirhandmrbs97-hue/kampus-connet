import { AtSign, Bell, Heart, MessageCircle, UserRoundPlus, VenetianMask, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { timeAgo } from '@/lib/format';
import { StorageImage } from '@/components/StorageImage';
import { useTheme } from '@/context/ThemeContext';
import type { NotificationActivity } from './hooks/useRealtimeNotifications';

type NotificationFilter = 'all' | 'unread' | 'confessions';

const FILTERS: { id: NotificationFilter; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'unread', label: 'Okunmamış' },
  { id: 'confessions', label: 'İtiraflar' },
];

function notificationTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Dün';
  if (sameDay) {
    const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (minutes < 1) return 'Şimdi';
    if (minutes < 60) return `${minutes} dk`;
    return `${Math.floor(minutes / 60)} sa`;
  }
  const days = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (days < 7) return `${days} g`;
  return timeAgo(iso);
}

export function NotificationCenter({
  visible,
  activities,
  onClose,
  onPressActivity,
  onMarkAllRead,
  onRefresh,
}: {
  visible: boolean;
  activities: NotificationActivity[];
  onClose: () => void;
  onPressActivity: (activity: NotificationActivity) => void;
  onMarkAllRead: () => Promise<boolean>;
  onRefresh: () => Promise<void>;
}) {
  const { isDark } = useTheme();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const filtered = useMemo(
    () =>
      activities.filter((activity) => {
        if (filter === 'unread') return !activity.isRead;
        if (filter === 'confessions') return activity.relatedType === 'confession';
        return true;
      }),
    [activities, filter],
  );

  const refresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      Alert.alert('Bildirimler yenilenemedi', error instanceof Error ? error.message : 'Bir hata oluştu.');
    } finally {
      setRefreshing(false);
    }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      const succeeded = await onMarkAllRead();
      if (!succeeded) Alert.alert('İşlem tamamlanamadı', 'Bildirimler okundu olarak işaretlenemedi.');
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-950">
        <View className="border-b border-gray-100 dark:border-gray-800">
          <View className="flex-row items-center px-4 pb-3 pt-2">
            <Text className="flex-1 text-xl font-extrabold text-gray-900 dark:text-white">Bildirimler</Text>
            <Pressable
              onPress={() => void markAllRead()}
              disabled={markingAll || !activities.some((activity) => !activity.isRead)}
              accessibilityRole="button"
              accessibilityLabel="Tümünü Okundu İşaretle"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              className="mr-2 min-h-9 flex-row items-center justify-center rounded-full bg-blue-50 px-3 dark:bg-blue-950"
            >
              {markingAll ? <ActivityIndicator size="small" color="#3b82f6" /> : null}
              <Text className="text-[11px] font-semibold text-blue-600 dark:text-blue-300">
                Tümünü Okundu İşaretle
              </Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Bildirimleri kapat"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              className="h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"
            >
              <X size={19} color={isDark ? '#d1d5db' : '#6b7280'} />
            </Pressable>
          </View>
          <FlatList
            horizontal
            data={FILTERS}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}
            renderItem={({ item }) => {
              const selected = filter === item.id;
              return (
                <Pressable
                  onPress={() => setFilter(item.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  className={`rounded-full px-4 py-2 ${
                    selected ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-100 dark:bg-gray-800'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      selected ? 'text-white' : 'text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              tintColor={isDark ? '#93c5fd' : '#2563eb'}
              colors={['#2563eb']}
            />
          }
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View className="ml-[76px] h-px bg-gray-100 dark:bg-gray-800" />}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center px-8 py-20">
              <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-900">
                <Bell size={27} color={isDark ? '#6b7280' : '#9ca3af'} />
              </View>
              <Text className="text-center text-sm font-medium text-gray-500 dark:text-gray-400">
                Henüz yeni bildirimin yok
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isConfession = item.relatedType === 'confession';
            const Icon = isConfession
              ? VenetianMask
              : item.category === 'likes'
                ? Heart
                : item.category === 'comments'
                  ? MessageCircle
                  : item.category === 'requests'
                    ? UserRoundPlus
                    : AtSign;
            const badgeColor = isConfession
              ? '#8b5cf6'
              : item.category === 'likes'
                ? '#ec4899'
                : item.category === 'comments'
                  ? '#3b82f6'
                  : item.category === 'requests'
                    ? '#0ea5e9'
                    : '#8b5cf6';
            const initial = item.name.trim().charAt(0).toUpperCase() || '?';

            return (
              <Pressable
                onPress={() => onPressActivity(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.name} ${item.action}`}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.7 : 1,
                  backgroundColor: item.isRead
                    ? 'transparent'
                    : isDark
                      ? 'rgba(59,130,246,0.12)'
                      : 'rgba(59,130,246,0.08)',
                })}
                className="min-h-[82px] flex-row items-center px-4 py-3.5"
              >
                <View className="relative h-12 w-12">
                  {isConfession ? (
                    <View className="h-12 w-12 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-950">
                      <VenetianMask size={22} color="#8b5cf6" />
                    </View>
                  ) : item.avatarUrl ? (
                    <StorageImage uri={item.avatarUrl} className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-800" />
                  ) : (
                    <View className="h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950">
                      <Text className="font-bold text-blue-700 dark:text-blue-200">{initial}</Text>
                    </View>
                  )}
                  <View
                    style={{ backgroundColor: badgeColor, borderColor: isDark ? '#030712' : '#fff' }}
                    className="absolute -bottom-0.5 -right-0.5 h-[21px] w-[21px] items-center justify-center rounded-full border-2"
                  >
                    <Icon
                      size={11}
                      color="#fff"
                      fill={!isConfession && item.category === 'likes' ? '#fff' : 'transparent'}
                    />
                  </View>
                </View>

                <View className="ml-3.5 min-w-0 flex-1">
                  <Text numberOfLines={2} className="text-[13px] leading-[19px] text-gray-700 dark:text-gray-200">
                    <Text className="font-bold text-gray-900 dark:text-white">{item.name}</Text>
                    {` ${item.action}`}
                  </Text>
                  {item.preview ? (
                    <Text numberOfLines={2} className="mt-1 text-xs leading-[17px] text-gray-500 dark:text-gray-400">
                      {item.preview}
                    </Text>
                  ) : null}
                </View>

                <View className="ml-2 min-w-[32px] items-end">
                  <Text className="text-[10px] text-gray-400 dark:text-gray-500">{notificationTime(item.createdAt)}</Text>
                  {!item.isRead ? (
                    <View className="mt-2 h-2 w-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500" />
                  ) : null}
                </View>
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}
