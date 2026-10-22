import { router } from 'expo-router';
import { Bell, CheckCheck, ChevronLeft, Heart, MessageCircle, UserPlus } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Button, EmptyState } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { timeAgo } from '@/lib/format';
import { goBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { fetchProfiles } from '@/services/profiles';
import type { NotificationRow, Profile } from '@/types';

let notificationChannelSequence = 0;

const isMissingNotificationsTable = (error: { code?: string } | null) =>
  error?.code === 'PGRST205' || error?.code === '42P01';
const isMissingFollowRequestsTable = (error: { code?: string } | null) =>
  error?.code === 'PGRST205' || error?.code === '42P01';

function NotificationIcon({ type }: { type: string }) {
  if (type === 'like') return <Heart size={18} color="#ef4444" />;
  if (type === 'follow' || type === 'follow_request') return <UserPlus size={18} color="#0ea5e9" />;
  if (
    type === 'message' ||
    type === 'offer' ||
    type === 'listing_inquiry' ||
    type === 'listing_offer' ||
    type === 'comment' ||
    type === 'reply'
  ) {
    return <MessageCircle size={18} color="#0ea5e9" />;
  }
  return <Bell size={18} color="#0ea5e9" />;
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const { refreshUnreadCount } = useNotifications();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notificationsTableMissing, setNotificationsTableMissing] = useState(false);
  const [pendingFollowRequests, setPendingFollowRequests] = useState<Record<string, string>>({});
  const [requestResults, setRequestResults] = useState<Record<string, 'accepted' | 'rejected'>>({});
  const [hiddenRequestNotifications, setHiddenRequestNotifications] = useState<Set<string>>(
    () => new Set(),
  );
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id,recipient_id,actor_id,type,title,body,related_type,related_id,created_at,read_at')
        .eq('recipient_id', user.id)
        .neq('type', 'message')
        .order('created_at', { ascending: false })
        .limit(100);
      if (isMissingNotificationsTable(error)) {
        setNotificationsTableMissing(true);
        setNotifications([]);
        return;
      }
      if (error) throw error;
      setNotificationsTableMissing(false);
      const rows = (data ?? []) as NotificationRow[];
      const { data: requestRows, error: requestError } = await supabase
        .from('follow_requests')
        .select('id, follower_id')
        .eq('following_id', user.id)
        .eq('status', 'pending');
      if (requestError && !isMissingFollowRequestsTable(requestError)) throw requestError;
      setPendingFollowRequests(
        Object.fromEntries((requestRows ?? []).map((request) => [request.follower_id, request.id])),
      );
      setNotifications(rows);
      setProfiles(await fetchProfiles(rows.map((row) => row.actor_id ?? '')));
      await refreshUnreadCount();
    } catch (error) {
      console.error('Bildirimler yüklenemedi:', error);
      Alert.alert(
        'Bildirimler yüklenemedi',
        error instanceof Error ? error.message : JSON.stringify(error),
      );
    } finally {
      setLoading(false);
    }
  }, [refreshUnreadCount, user]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  useEffect(() => {
    if (!user || notificationsTableMissing) return;
    const channel = supabase
      .channel(`notification-center-${user.id}-${++notificationChannelSequence}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` },
        () => void load(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follow_requests', filter: `following_id=eq.${user.id}` },
        () => void load(),
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Bildirim merkezi Realtime bağlantısı kurulamadı:', status);
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, notificationsTableMissing, user]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openNotification = async (item: NotificationRow) => {
    if (!item.read_at) {
      const readAt = new Date().toISOString();
      const { error } = await supabase.from('notifications').update({ read_at: readAt }).eq('id', item.id);
      if (error) {
        Alert.alert('Bildirim güncellenemedi', error.message);
        return;
      }
      setNotifications((current) =>
        current.map((notification) => (notification.id === item.id ? { ...notification, read_at: readAt } : notification)),
      );
      await refreshUnreadCount();
    }

    if (item.related_type === 'chat' && item.related_id) {
      router.push({ pathname: '/chat/[id]', params: { id: item.related_id } });
    } else if (item.related_type === 'listing' && item.related_id) {
      router.push({ pathname: '/listing/[id]', params: { id: item.related_id } });
    } else if (item.related_type === 'profile' && item.related_id) {
      router.push({ pathname: '/profile/[id]', params: { id: item.related_id } });
    } else if (item.related_type === 'post' && item.related_id) {
      router.push({ pathname: '/(tabs)', params: { postId: item.related_id } });
    } else if (item.related_type === 'confession' && item.related_id) {
      router.push({ pathname: '/(tabs)/confessions', params: { confessionId: item.related_id } });
    }
  };

  const markAllRead = async () => {
    if (!user) return;
    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('recipient_id', user.id)
      .neq('type', 'message')
      .is('read_at', null);
    if (error) {
      Alert.alert('Bildirimler güncellenemedi', error.message);
      return;
    }
    setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? readAt })));
    await refreshUnreadCount();
  };

  const respondToFollowRequest = async (
    notification: NotificationRow,
    requestId: string,
    accept: boolean,
  ) => {
    if (busyRequestId) return;
    setBusyRequestId(requestId);
    try {
      const { error } = await supabase.rpc('respond_to_follow_request', {
        p_request_id: requestId,
        p_accept: accept,
      });
      if (error) throw error;

      if (accept) {
        setRequestResults((current) => ({ ...current, [notification.id]: 'accepted' }));
      } else {
        setHiddenRequestNotifications((current) => new Set(current).add(notification.id));
      }
      const actorId = notification.actor_id;
      if (actorId) {
        setPendingFollowRequests((current) => {
          const next = { ...current };
          delete next[actorId];
          return next;
        });
      }
      await refreshUnreadCount();
    } catch (error) {
      console.error('Takip isteği bildirimi yanıtlanamadı:', error);
      Alert.alert('İstek yanıtlanamadı', error instanceof Error ? error.message : JSON.stringify(error));
    } finally {
      setBusyRequestId(null);
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-gray-900">
      <View className="mb-3 flex-row items-center justify-between px-5 pt-2">
        <View className="flex-row items-center">
          <Pressable onPress={() => goBack()} className="mr-3">
            <ChevronLeft size={24} color="#374151" />
          </Pressable>
          <Text className="text-2xl font-extrabold text-gray-900 dark:text-white">Bildirimler</Text>
        </View>
        <Pressable onPress={() => void markAllRead()} accessibilityLabel="Tümünü okundu işaretle">
          <CheckCheck size={22} color="#0ea5e9" />
        </Pressable>
      </View>
      {loading ? (
        <ActivityIndicator className="mt-10" color="#0ea5e9" />
      ) : notificationsTableMissing ? (
        <EmptyState
          title="Bildirim veritabanı kurulmamış"
          hint="Supabase SQL Editor’da supabase/migrations/20261016230000_notifications_table.sql dosyasını çalıştır."
          icon={<Bell size={28} color="#9ca3af" />}
        />
      ) : (
        <FlatList
          data={notifications.filter((item) => !hiddenRequestNotifications.has(item.id))}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
          ListEmptyComponent={<EmptyState title="Yeni bildirim yok" hint="Sosyal hareketler burada görünecek." />}
          renderItem={({ item }) => {
            const actor = item.actor_id ? profiles[item.actor_id] : undefined;
            const requestId = item.actor_id ? pendingFollowRequests[item.actor_id] : undefined;
            const isFollowRequest =
              (item.type === 'follow_request' || item.type === 'follow') && !!requestId;
            return (
              <View
                className={`border-b border-gray-100 px-5 py-3.5 dark:border-gray-800 ${item.read_at ? '' : 'bg-primary-50/70 dark:bg-gray-800/70'}`}
              >
                <Pressable
                  onPress={() => void openNotification(item)}
                  className="flex-row items-center"
                  accessibilityRole="button"
                >
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      if (item.actor_id) router.push({ pathname: '/profile/[id]', params: { id: item.actor_id } });
                    }}
                  >
                    <Avatar uri={actor?.avatar_url} name={actor?.full_name ?? actor?.username} size={46} />
                  </Pressable>
                  <View className="ml-3 flex-1">
                    <Text className="font-semibold text-gray-900 dark:text-white">
                      {isFollowRequest && actor
                        ? `${actor.full_name || `@${actor.username}`} seni takip etmek istiyor.`
                        : item.title}
                    </Text>
                    {isFollowRequest && actor ? (
                      <Text className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">@{actor.username}</Text>
                    ) : (
                      <Text className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">{item.body}</Text>
                    )}
                    <Text className="mt-1 text-xs text-gray-400">{timeAgo(item.created_at)}</Text>
                  </View>
                  <View className="ml-2 h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                    <NotificationIcon type={item.type} />
                  </View>
                  {!item.read_at ? <View className="ml-2 h-2 w-2 rounded-full bg-primary-500" /> : null}
                </Pressable>
                {isFollowRequest && requestId ? (
                  requestResults[item.id] === 'accepted' ? (
                    <Text className="ml-[58px] mt-2 text-sm font-semibold text-primary-600">
                      Kabul Edildi
                    </Text>
                  ) : (
                    <View className="ml-[58px] mt-3 flex-row gap-2">
                      <Button
                        title="Kabul Et"
                        onPress={() => void respondToFollowRequest(item, requestId, true)}
                        loading={busyRequestId === requestId}
                        disabled={busyRequestId !== null}
                        className="flex-1 py-2"
                      />
                      <Button
                        title="Reddet"
                        variant="outline"
                        onPress={() => void respondToFollowRequest(item, requestId, false)}
                        disabled={busyRequestId !== null}
                        className="flex-1 py-2"
                      />
                    </View>
                  )
                ) : null}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
