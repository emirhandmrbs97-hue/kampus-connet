import { router, useLocalSearchParams } from 'expo-router';
import {
  Ban,
  ChevronLeft,
  Flag,
  Grid2X2,
  MoreHorizontal,
  UserRoundCheck,
} from 'lucide-react-native';
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

import { ProfileConnectionsSheet } from '@/components/ProfileConnectionsSheet';
import { StorageImage } from '@/components/StorageImage';
import { ActionSheet, Avatar, Button, EmptyState } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { goBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { startConversation } from '@/services/chat';
import type { PostRow, Profile } from '@/types';

type ProfileStats = {
  posts: number;
  followers: number;
  following: number;
};

const EMPTY_STATS: ProfileStats = { posts: 0, followers: 0, following: 0 };
const REPORT_REASONS = ['Spam', 'Sahte hesap', 'Taciz veya zorbalık', 'Uygunsuz içerik'] as const;
const isMissingFollowRequestsTable = (error: { code?: string } | null) =>
  error?.code === 'PGRST205' || error?.code === '42P01';

function getSupabaseErrorMessage(error: unknown) {
  if (error && typeof error === 'object') {
    const details = error as { message?: string; details?: string | null; hint?: string | null; code?: string };
    return [details.message, details.details, details.hint, details.code && `Kod: ${details.code}`]
      .filter(Boolean)
      .join('\n') || JSON.stringify(error);
  }
  return error instanceof Error ? error.message : String(error);
}

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [stats, setStats] = useState<ProfileStats>(EMPTY_STATS);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followRequestPending, setFollowRequestPending] = useState(false);
  const [followRequestsAvailable, setFollowRequestsAvailable] = useState(true);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [connectionsKind, setConnectionsKind] = useState<'followers' | 'following' | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyAction, setBusyAction] = useState<'follow' | 'message' | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [reportReasonsVisible, setReportReasonsVisible] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!id) return;
    try {
      const { data: profileData, error: profileError } = id.startsWith('@')
        ? await supabase
            .from('profiles')
            .select('*')
            .ilike('username', id.slice(1))
            .maybeSingle()
        : await supabase
            .from('profiles')
            .select('*')
            .eq('id', id)
            .maybeSingle();
      if (profileError) throw profileError;
      if (!profileData) {
        setProfile(null);
        setPosts([]);
        setStats(EMPTY_STATS);
        setIsFollowing(false);
        setFollowRequestPending(false);
        setPendingRequestsCount(0);
        return;
      }

      const targetId = profileData.id;
      const [
        postResult,
        postCountResult,
        followerCountResult,
        followingCountResult,
        followResult,
        followRequestResult,
        incomingRequestsResult,
      ] =
        await Promise.all([
          supabase
            .from('posts')
            .select('*')
            .eq('author_id', targetId)
            .eq('is_archived', false)
            .order('created_at', { ascending: false }),
          supabase
            .from('posts')
            .select('id', { count: 'exact', head: true })
            .eq('author_id', targetId)
            .eq('is_archived', false),
          supabase
            .from('follows')
            .select('follower_id', { count: 'exact', head: true })
            .eq('following_id', targetId),
          supabase
            .from('follows')
            .select('following_id', { count: 'exact', head: true })
            .eq('follower_id', targetId),
          user && user.id !== targetId
            ? supabase
                .from('follows')
                .select('follower_id')
                .eq('follower_id', user.id)
                .eq('following_id', targetId)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          user && user.id !== targetId
            ? supabase
                .from('follow_requests')
                .select('status')
                .eq('follower_id', user.id)
                .eq('following_id', targetId)
                .eq('status', 'pending')
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          user?.id === targetId
            ? supabase
                .from('follow_requests')
                .select('id', { count: 'exact', head: true })
                .eq('following_id', targetId)
                .eq('status', 'pending')
            : Promise.resolve({ data: null, count: 0, error: null }),
        ]);

      if (postResult.error) throw postResult.error;
      if (postCountResult.error) throw postCountResult.error;
      if (followerCountResult.error) throw followerCountResult.error;
      if (followingCountResult.error) throw followingCountResult.error;
      if (followResult.error) throw followResult.error;
      const followRequestsTableMissing =
        isMissingFollowRequestsTable(followRequestResult.error) ||
        isMissingFollowRequestsTable(incomingRequestsResult.error);
      if (followRequestResult.error && !isMissingFollowRequestsTable(followRequestResult.error)) {
        throw followRequestResult.error;
      }
      if (incomingRequestsResult.error && !isMissingFollowRequestsTable(incomingRequestsResult.error)) {
        throw incomingRequestsResult.error;
      }

      setProfile(profileData as Profile);
      setPosts((postResult.data ?? []) as PostRow[]);
      setStats({
        posts: postCountResult.count ?? 0,
        followers: followerCountResult.count ?? 0,
        following: followingCountResult.count ?? 0,
      });
      setIsFollowing(!!followResult.data);
      setFollowRequestsAvailable(!followRequestsTableMissing);
      setFollowRequestPending(!followRequestsTableMissing && !!followRequestResult.data);
      setPendingRequestsCount(followRequestsTableMissing ? 0 : incomingRequestsResult.count ?? 0);
    } catch (error) {
      console.error('Kullanıcı profili yüklenemedi:', error);
      Alert.alert('Profil yüklenemedi', error instanceof Error ? error.message : 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    void Promise.resolve().then(loadProfile);
  }, [loadProfile]);

  const profileId = profile?.id;

  useEffect(() => {
    if (!profileId) return;
    const refreshProfile = () => void loadProfile();
    const channel = supabase
      .channel(`public-profile-${profileId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter: `following_id=eq.${profileId}` },
        (payload) => {
          void loadProfile();
          if (payload.new && 'follower_id' in payload.new && payload.new.follower_id === user?.id) {
            setIsFollowing(true);
          }
          if (payload.old && 'follower_id' in payload.old && payload.old.follower_id === user?.id) {
            setIsFollowing(false);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter: `follower_id=eq.${profileId}` },
        () => void loadProfile(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts', filter: `author_id=eq.${profileId}` },
        refreshProfile,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follow_requests', filter: `following_id=eq.${profileId}` },
        refreshProfile,
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Profil istatistikleri için Realtime bağlantısı kurulamadı:', status);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadProfile, profileId, user?.id]);

  const refresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const toggleFollow = async () => {
    if (!user || !profile || busyAction) return;
    if (profile.is_private && !isFollowing) {
      if (!followRequestsAvailable) {
        Alert.alert(
          'Veritabanı güncellemesi gerekli',
          'Gizli hesap takip istekleri etkin değil. supabase/migrations/20261016200000_follow_request_system.sql dosyasını Supabase SQL Editor’da çalıştır.',
        );
        return;
      }
      setBusyAction('follow');
      try {
        if (followRequestPending) {
          const { error } = await supabase
            .from('follow_requests')
            .delete()
            .eq('follower_id', user.id)
            .eq('following_id', profile.id)
            .eq('status', 'pending');
          if (error) throw error;
          setFollowRequestPending(false);
        } else {
          const { error } = await supabase.from('follow_requests').insert({
            follower_id: user.id,
            following_id: profile.id,
            status: 'pending',
          });
          if (error) {
            console.error('Takip isteği Supabase’e kaydedilemedi:', error);
            if (error.code === '23505') {
              const { data, error: lookupError } = await supabase
                .from('follow_requests')
                .select('id')
                .eq('follower_id', user.id)
                .eq('following_id', profile.id)
                .eq('status', 'pending')
                .maybeSingle();
              if (lookupError) throw lookupError;
              if (data) {
                setFollowRequestPending(true);
                return;
              }
            }
            throw error;
          }
          setFollowRequestPending(true);
        }
      } catch (error) {
        console.error('Gizli hesap takip isteği işlemi başarısız:', error);
        Alert.alert(
          'Takip isteği gönderilemedi',
          getSupabaseErrorMessage(error),
        );
      } finally {
        setBusyAction(null);
      }
      return;
    }
    const wasFollowing = isFollowing;
    setBusyAction('follow');
    setIsFollowing(!wasFollowing);
    setStats((current) => ({
      ...current,
      followers: Math.max(0, current.followers + (wasFollowing ? -1 : 1)),
    }));

    const result = wasFollowing
      ? await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', profile.id)
      : await supabase.from('follows').insert({ follower_id: user.id, following_id: profile.id });

    setBusyAction(null);
    if (result.error) {
      setIsFollowing(wasFollowing);
      setStats((current) => ({
        ...current,
        followers: Math.max(0, current.followers + (wasFollowing ? 1 : -1)),
      }));
      Alert.alert('Takip işlemi başarısız', result.error.message);
    }
  };

  const messageUser = async () => {
    if (!profile || busyAction) return;
    setBusyAction('message');
    const { id: conversationId, error } = await startConversation(profile.id);
    setBusyAction(null);
    if (error || !conversationId) {
      Alert.alert('Sohbet açılamadı', error ?? 'Bir hata oluştu.');
      return;
    }
    router.push({ pathname: '/chat/[id]', params: { id: conversationId } });
  };

  const blockUser = () => {
    if (!user || !profile) return;
    Alert.alert('Hesap engellensin mi?', `@${profile.username} artık seninle etkileşime giremez.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Engelle',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const { error } = await supabase
              .from('blocks')
              .insert({ blocker_id: user.id, blocked_id: profile.id });
            if (error) {
              Alert.alert('Hesap engellenemedi', error.message);
              return;
            }
            Alert.alert('Hesap engellendi', `@${profile.username} engellendi.`);
            router.replace('/(tabs)');
          })();
        },
      },
    ]);
  };

  const reportUser = (reason: (typeof REPORT_REASONS)[number]) => {
    if (!user || !profile) return;
    void (async () => {
      const { error } = await supabase.from('user_reports').insert({
        reporter_id: user.id,
        reported_user_id: profile.id,
        reason,
      });
      if (error) {
        Alert.alert('Şikayet gönderilemedi', error.message);
        return;
      }
      Alert.alert('Şikayet gönderildi', 'Bildirimin incelenmek üzere ekibimize iletildi.');
    })();
  };

  const privateProfile = !!profile?.is_private && profile.id !== user?.id && !isFollowing;
  const isOwnProfile = profile?.id === user?.id;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-gray-900">
      <View className="mb-3 flex-row items-center justify-between px-5 pt-2">
        <View className="flex-row items-center">
          <Pressable onPress={() => goBack()} className="mr-4">
            <ChevronLeft size={24} color="#374151" />
          </Pressable>
          <Text className="text-xl font-extrabold text-gray-900 dark:text-white">Kullanıcı profili</Text>
        </View>
        {profile && !isOwnProfile ? (
          <Pressable
            onPress={() => setActionSheetVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Profil seçenekleri"
            hitSlop={10}
          >
            <MoreHorizontal size={24} color="#6b7280" />
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator className="mt-10" color="#0ea5e9" />
      ) : !profile ? (
        <EmptyState title="Kullanıcı bulunamadı" />
      ) : (
        <>
          <FlatList
            data={privateProfile ? [] : posts}
            keyExtractor={(post) => post.id}
            numColumns={3}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
            ListHeaderComponent={
              <View className="px-5 pb-5">
                <View className="flex-row items-center">
                  <Avatar uri={profile.avatar_url} name={profile.full_name} size={84} />
                  <View className="ml-6 flex-1 flex-row justify-around">
                    <View className="items-center">
                      <Text className="text-lg font-bold text-gray-900 dark:text-white">{stats.posts}</Text>
                      <Text className="text-xs text-gray-500 dark:text-gray-400">Gönderi</Text>
                    </View>
                    <Pressable
                      onPress={() => setConnectionsKind('followers')}
                      className="items-center"
                      accessibilityRole="button"
                    >
                      <Text className="text-lg font-bold text-gray-900 dark:text-white">{stats.followers}</Text>
                      <Text className="text-xs text-gray-500 dark:text-gray-400">Takipçi</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setConnectionsKind('following')}
                      className="items-center"
                      accessibilityRole="button"
                    >
                      <Text className="text-lg font-bold text-gray-900 dark:text-white">{stats.following}</Text>
                      <Text className="text-xs text-gray-500 dark:text-gray-400">Takip</Text>
                    </Pressable>
                  </View>
                </View>

                <Text className="mt-4 text-lg font-bold text-gray-900 dark:text-white">
                  {profile.full_name || profile.username}
                </Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400">@{profile.username}</Text>
                {profile.bio ? (
                  <Text className="mt-2 text-sm text-gray-700 dark:text-gray-300">{profile.bio}</Text>
                ) : null}
                {profile.university || profile.department ? (
                  <View className="mt-2">
                    {profile.university ? (
                      <Text className="text-sm text-gray-600 dark:text-gray-300">{profile.university}</Text>
                    ) : null}
                    {profile.department ? (
                      <Text className="text-sm text-gray-500 dark:text-gray-400">{profile.department}</Text>
                    ) : null}
                  </View>
                ) : null}

                {!isOwnProfile ? (
                  <View className="mt-4 flex-row gap-2">
                    <Button
                      title={
                        isFollowing
                          ? 'Takiptesin'
                          : followRequestPending
                            ? 'İstek Gönderildi'
                            : profile.is_private
                              ? 'İstek Gönder'
                              : 'Takip Et'
                      }
                      variant={isFollowing || followRequestPending ? 'outline' : 'primary'}
                      onPress={() => void toggleFollow()}
                      loading={busyAction === 'follow'}
                      disabled={busyAction !== null}
                      className="flex-1"
                    />
                    <Button
                      title="Mesaj At"
                      variant="outline"
                      onPress={() => void messageUser()}
                      loading={busyAction === 'message'}
                      disabled={busyAction !== null}
                      className="flex-1"
                    />
                  </View>
                ) : (
                  <Button
                    title={`Takip İstekleri${pendingRequestsCount ? ` (${pendingRequestsCount})` : ''}`}
                    variant="outline"
                    onPress={() => router.push('/follow-requests')}
                    className="mt-4"
                  />
                )}

                {privateProfile ? (
                  <View className="mt-8 items-center">
                    <UserRoundCheck size={26} color="#9ca3af" />
                    <Text className="mt-2 font-semibold text-gray-800 dark:text-gray-200">Bu hesap gizli</Text>
                    <Text className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
                      Gönderilerini görmek için bu hesabı takip et.
                    </Text>
                  </View>
                ) : (
                  <View className="mt-6 flex-row items-center border-t border-gray-100 pt-3 dark:border-gray-800">
                    <Grid2X2 size={17} color="#0ea5e9" />
                    <Text className="ml-2 text-sm font-semibold text-gray-800 dark:text-gray-200">Gönderiler</Text>
                  </View>
                )}
              </View>
            }
            ListEmptyComponent={
              privateProfile ? null : (
                <EmptyState
                  title="Gönderi yok"
                  hint="Bu kullanıcının henüz görüntülenecek gönderisi bulunmuyor."
                />
              )
            }
            renderItem={({ item }) => (
              <View className="m-0.5 aspect-square flex-1 overflow-hidden bg-gray-100 dark:bg-gray-800">
                {item.media_type === 'image' && item.media_url ? (
                  <StorageImage uri={item.media_url} className="h-full w-full" resizeMode="cover" />
                ) : (
                  <View className="flex-1 justify-center p-2">
                    <Text numberOfLines={6} className="text-xs text-gray-800 dark:text-gray-100">
                      {item.body}
                    </Text>
                  </View>
                )}
              </View>
            )}
            contentContainerStyle={{ paddingHorizontal: 2, paddingBottom: 24 }}
          />
          <ActionSheet
            visible={actionSheetVisible}
            onClose={() => setActionSheetVisible(false)}
            options={[
              {
                label: 'Engelle',
                icon: <Ban size={20} color="#dc2626" />,
                destructive: true,
                onPress: blockUser,
              },
              {
                label: 'Şikayet Et',
                icon: <Flag size={20} color="#dc2626" />,
                destructive: true,
                onPress: () => setReportReasonsVisible(true),
              },
            ]}
          />
          <ActionSheet
            visible={reportReasonsVisible}
            onClose={() => setReportReasonsVisible(false)}
            options={REPORT_REASONS.map((reason) => ({
              label: reason,
              icon: <Flag size={18} color="#6b7280" />,
              onPress: () => reportUser(reason),
            }))}
          />
          <ProfileConnectionsSheet
            profileId={profile.id}
            kind={connectionsKind}
            onClose={() => setConnectionsKind(null)}
          />
        </>
      )}
    </SafeAreaView>
  );
}
