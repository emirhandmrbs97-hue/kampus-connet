import { router } from 'expo-router';
import { ChevronLeft, UserRoundPlus } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Button, EmptyState } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { goBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

type FollowRequest = {
  id: string;
  follower_id: string;
  created_at: string;
  profile: Profile;
};

const isMissingFollowRequestsTable = (error: { code?: string } | null) =>
  error?.code === 'PGRST205' || error?.code === '42P01';

export default function FollowRequestsScreen() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [migrationMissing, setMigrationMissing] = useState(false);

  const loadRequests = useCallback(async () => {
    if (!user) return;
    try {
      const { data: requestRows, error } = await supabase
        .from('follow_requests')
        .select('id, follower_id, created_at')
        .eq('following_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (isMissingFollowRequestsTable(error)) {
        setMigrationMissing(true);
        setRequests([]);
        return;
      }
      if (error) throw error;
      setMigrationMissing(false);

      const requesterIds = (requestRows ?? []).map((request) => request.follower_id);
      if (requesterIds.length === 0) {
        setRequests([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', requesterIds);
      if (profilesError) throw profilesError;
      const profileMap = new Map(((profiles ?? []) as Profile[]).map((profile) => [profile.id, profile]));
      setRequests(
        (requestRows ?? []).flatMap((request) => {
          const profile = profileMap.get(request.follower_id);
          return profile ? [{ ...request, profile }] : [];
        }),
      );
    } catch (error) {
      console.error('Takip istekleri yüklenemedi:', error);
      Alert.alert('İstekler yüklenemedi', error instanceof Error ? error.message : 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void Promise.resolve().then(loadRequests);
  }, [loadRequests]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`follow-requests-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follow_requests',
          filter: `following_id=eq.${user.id}`,
        },
        () => void loadRequests(),
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Takip istekleri için Realtime bağlantısı kurulamadı:', status);
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadRequests, user]);

  const respond = async (request: FollowRequest, accept: boolean) => {
    if (busyRequestId) return;
    setBusyRequestId(request.id);
    const { error } = await supabase.rpc('respond_to_follow_request', {
      p_request_id: request.id,
      p_accept: accept,
    });
    setBusyRequestId(null);
    if (error) {
      Alert.alert(accept ? 'İstek onaylanamadı' : 'İstek reddedilemedi', error.message);
      return;
    }
    setRequests((current) => current.filter((item) => item.id !== request.id));
  };

  const refresh = async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-row items-center px-5 pb-4 pt-2">
        <Pressable onPress={() => goBack('/(tabs)/profile')} hitSlop={10}>
          <ChevronLeft size={24} color="#374151" />
        </Pressable>
        <Text className="ml-3 text-xl font-extrabold text-gray-900 dark:text-white">Takip İstekleri</Text>
      </View>
      {loading ? (
        <ActivityIndicator className="mt-10" color="#0ea5e9" />
      ) : migrationMissing ? (
        <EmptyState
          title="Veritabanı güncellemesi gerekli"
          hint="supabase/migrations/20261016200000_follow_request_system.sql dosyasını Supabase SQL Editor’da çalıştır."
          icon={<UserRoundPlus size={28} color="#9ca3af" />}
        />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(request) => request.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
          ListEmptyComponent={
            <EmptyState
              title="Bekleyen istek yok"
              hint="Yeni takip istekleri burada görünecek."
              icon={<UserRoundPlus size={28} color="#9ca3af" />}
            />
          }
          renderItem={({ item }) => (
            <View className="flex-row items-center border-b border-gray-100 py-4 dark:border-gray-800">
              <Pressable
                onPress={() => router.push({ pathname: '/profile/[id]', params: { id: item.profile.id } })}
                className="flex-1 flex-row items-center"
              >
                <Avatar uri={item.profile.avatar_url} name={item.profile.full_name} size={48} />
                <View className="ml-3 flex-1">
                  <Text numberOfLines={1} className="font-semibold text-gray-900 dark:text-white">
                    {item.profile.full_name || item.profile.username}
                  </Text>
                  <Text numberOfLines={1} className="text-sm text-gray-500 dark:text-gray-400">
                    @{item.profile.username} · {new Date(item.created_at).toLocaleDateString('tr-TR')}
                  </Text>
                </View>
              </Pressable>
              <View className="ml-2 flex-row gap-2">
                <Button
                  title="Onayla"
                  onPress={() => void respond(item, true)}
                  loading={busyRequestId === item.id}
                  disabled={busyRequestId !== null}
                  className="px-3 py-2"
                />
                <Button
                  title="Reddet"
                  variant="outline"
                  onPress={() => void respond(item, false)}
                  disabled={busyRequestId !== null}
                  className="px-3 py-2"
                />
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
