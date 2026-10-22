import { router } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useCallback, useEffect, useState } from 'react';

import { Avatar, Button, EmptyState, Sheet } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

type ConnectionKind = 'followers' | 'following';
type Connection = {
  profile: Profile;
  isFollowing: boolean;
  requestPending: boolean;
};

const isMissingFollowRequestsTable = (error: { code?: string } | null) =>
  error?.code === 'PGRST205' || error?.code === '42P01';

export function ProfileConnectionsSheet({
  profileId,
  kind,
  onClose,
}: {
  profileId: string;
  kind: ConnectionKind | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [connectionsLoadedWithRequests, setConnectionsLoadedWithRequests] = useState(true);

  const load = useCallback(async () => {
    if (!kind || !user) return;
    try {
      const relationshipResult =
        kind === 'followers'
          ? await supabase.from('follows').select('follower_id').eq('following_id', profileId)
          : await supabase.from('follows').select('following_id').eq('follower_id', profileId);
      if (relationshipResult.error) throw relationshipResult.error;

      const targetIds = (relationshipResult.data ?? []).map((row) =>
        'follower_id' in row ? row.follower_id : row.following_id,
      );
      if (targetIds.length === 0) {
        setConnections([]);
        return;
      }

      const [{ data: profiles, error: profilesError }, { data: myFollows, error: followsError }, { data: myRequests, error: requestsError }] =
        await Promise.all([
          supabase.from('profiles').select('*').in('id', targetIds),
          supabase.from('follows').select('following_id').eq('follower_id', user.id).in('following_id', targetIds),
          supabase
            .from('follow_requests')
            .select('following_id')
            .eq('follower_id', user.id)
            .eq('status', 'pending')
            .in('following_id', targetIds),
        ]);
      if (profilesError) throw profilesError;
      if (followsError) throw followsError;
      if (requestsError && !isMissingFollowRequestsTable(requestsError)) throw requestsError;
      setConnectionsLoadedWithRequests(!isMissingFollowRequestsTable(requestsError));

      const followingIds = new Set((myFollows ?? []).map((row) => row.following_id));
      const requestIds = new Set((myRequests ?? []).map((row) => row.following_id));
      const profileMap = new Map(((profiles ?? []) as Profile[]).map((profile) => [profile.id, profile]));
      setConnections(
        targetIds.flatMap((targetId) => {
          const profile = profileMap.get(targetId);
          return profile
            ? [{ profile, isFollowing: followingIds.has(targetId), requestPending: requestIds.has(targetId) }]
            : [];
        }),
      );
    } catch (error) {
      console.error('Takip listesi yüklenemedi:', error);
      Alert.alert('Liste yüklenemedi', error instanceof Error ? error.message : 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, [kind, profileId, user]);

  useEffect(() => {
    if (kind) void Promise.resolve().then(load);
  }, [kind, load]);

  const toggleFollow = async (connection: Connection) => {
    if (!user || busyUserId) return;
    const target = connection.profile;
    setBusyUserId(target.id);
    try {
      if (connection.isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', target.id);
        if (error) throw error;
        setConnections((current) =>
          current.map((item) =>
            item.profile.id === target.id ? { ...item, isFollowing: false } : item,
          ),
        );
      } else if (connection.requestPending) {
        const { error } = await supabase
          .from('follow_requests')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', target.id)
          .eq('status', 'pending');
        if (error) throw error;
        setConnections((current) =>
          current.map((item) =>
            item.profile.id === target.id ? { ...item, requestPending: false } : item,
          ),
        );
      } else if (target.is_private) {
        if (!connectionsLoadedWithRequests) {
          throw new Error(
            'Gizli hesap takip istekleri etkin değil. Supabase SQL Editor’da migration 20261016200000_follow_request_system.sql dosyasını çalıştır.',
          );
        }
        const { error } = await supabase.from('follow_requests').insert({
          follower_id: user.id,
          following_id: target.id,
          status: 'pending',
        });
        if (error) throw error;
        setConnections((current) =>
          current.map((item) =>
            item.profile.id === target.id ? { ...item, requestPending: true } : item,
          ),
        );
      } else {
        const { error } = await supabase.from('follows').insert({
          follower_id: user.id,
          following_id: target.id,
        });
        if (error) throw error;
        setConnections((current) =>
          current.map((item) =>
            item.profile.id === target.id ? { ...item, isFollowing: true } : item,
          ),
        );
      }
    } catch (error) {
      Alert.alert('Takip işlemi başarısız', error instanceof Error ? error.message : 'Bir hata oluştu.');
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <Sheet
      visible={kind !== null}
      onClose={onClose}
      title={kind === 'followers' ? 'Takipçiler' : 'Takip edilenler'}
      tall
    >
      {loading ? (
        <ActivityIndicator className="mt-8" color="#0ea5e9" />
      ) : (
        <FlatList
          data={connections}
          keyExtractor={(item) => item.profile.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
          ListEmptyComponent={<EmptyState title="Henüz kullanıcı yok" />}
          renderItem={({ item }) => (
            <View className="flex-row items-center py-3">
              <Pressable
                onPress={() => {
                  onClose();
                  router.push({ pathname: '/profile/[id]', params: { id: item.profile.id } });
                }}
                className="flex-1 flex-row items-center"
              >
                <Avatar uri={item.profile.avatar_url} name={item.profile.full_name} size={46} />
                <View className="ml-3 flex-1">
                  <Text numberOfLines={1} className="font-semibold text-gray-900 dark:text-white">
                    {item.profile.full_name || item.profile.username}
                  </Text>
                  <Text numberOfLines={1} className="text-sm text-gray-500 dark:text-gray-400">
                    @{item.profile.username}
                  </Text>
                </View>
              </Pressable>
              {user?.id !== item.profile.id ? (
                <Button
                  title={
                    item.isFollowing
                      ? 'Takiptesin'
                      : item.requestPending
                        ? 'İstek Gönderildi'
                        : item.profile.is_private
                          ? 'İstek Gönder'
                          : 'Takip Et'
                  }
                  variant={item.isFollowing || item.requestPending ? 'outline' : 'primary'}
                  onPress={() => void toggleFollow(item)}
                  loading={busyUserId === item.profile.id}
                  disabled={busyUserId !== null}
                  className="px-3 py-2"
                />
              ) : null}
            </View>
          )}
        />
      )}
    </Sheet>
  );
}
