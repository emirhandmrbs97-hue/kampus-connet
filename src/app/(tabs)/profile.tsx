import { Camera, Edit, Grid, ImageIcon, Settings } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ActionSheet, Avatar, Button, Field, FullScreenImage, Sheet } from '@/components/ui';
import { StoryViewer } from '@/components/StoryViewer';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import { supabase } from '@/lib/supabase';
import { pickImage } from '@/services/mediaPicker';
import { countRows } from '@/services/profiles';
import { uploadMedia } from '@/services/storageService';
import type { PostRow, PostView, StoryGroup, StoryRow } from '@/types';
import { fetchProfiles } from '@/services/profiles';



export default function Profile() {
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();

  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [posts, setPosts] = useState<PostView[]>([]);
  const [hasStory, setHasStory] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [fullScreenImageVisible, setFullScreenImageVisible] = useState(false);
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [viewerStart, setViewerStart] = useState<number | null>(null);

  const loadStats = useCallback(async () => {
    if (!user) return;
    const [posts, followers, following] = await Promise.all([
      countRows('posts', 'author_id', user.id),
      countRows('follows', 'following_id', user.id),
      countRows('follows', 'follower_id', user.id),
    ]);
    setStats({ posts, followers, following });
  }, [user]);

  const loadPosts = useCallback(async () => {
    if (!user) return;
    setLoadingPosts(true);
    const { data } = await supabase
      .from('posts')
      .select('*')
      .eq('author_id', user.id)
      .order('created_at', { ascending: false });
    const rows = (data ?? []) as PostRow[];
    const ids = rows.map((r) => r.id);

    const [profiles, likesRes, commentsRes] = await Promise.all([
      fetchProfiles(rows.map((r) => r.author_id)),
      ids.length ? supabase.from('likes').select('post_id,user_id').in('post_id', ids) : Promise.resolve({ data: [] }),
      ids.length ? supabase.from('comments').select('post_id').in('post_id', ids) : Promise.resolve({ data: [] }),
    ]);

    const likes = (likesRes.data ?? []) as { post_id: string; user_id: string }[];
    const comments = (commentsRes.data ?? []) as { post_id: string }[];

    setPosts(
      rows.map((r) => ({
        ...r,
        author: profiles[r.author_id],
        likeCount: likes.filter((l) => l.post_id === r.id).length,
        liked: likes.some((l) => l.post_id === r.id && l.user_id === user.id),
        commentCount: comments.filter((c) => c.post_id === r.id).length,
      })),
    );
    setLoadingPosts(false);
  }, [user]);

  const checkStoryStatus = useCallback(async () => {
    if (!user) return;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('stories')
      .select('*')
      .eq('author_id', user.id)
      .gte('created_at', since)
      .order('created_at', { ascending: true });
    const rows = (data ?? []) as StoryRow[];
    setHasStory(rows.length > 0);

    if (rows.length > 0) {
      const profiles = await fetchProfiles([user.id]);
      setStoryGroups([
        {
          author: profiles[user.id] || { id: user.id, full_name: profile?.full_name || '', username: profile?.username || '', avatar_url: profile?.avatar_url },
          items: rows,
        },
      ]);
    } else {
      setStoryGroups([]);
    }
  }, [user, profile]);

  useEffect(() => {
    loadStats();
    loadPosts();
    checkStoryStatus();
  }, [loadStats, loadPosts, checkStoryStatus]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadPosts(), checkStoryStatus()]);
    setRefreshing(false);
  };

  const changeAvatar = async () => {
    const picked = await pickImage({ square: true });
    if (!picked) return;
    const media = await uploadMedia(picked.uri, { kind: 'image', folder: 'avatars' });
    const err = await updateProfile({ avatar_url: media.url });
    if (err) Alert.alert('Profil resmi güncellenemedi', err);
  };

  const handleAvatarPress = () => {
    if (hasStory) {
      setActionSheetVisible(true);
    } else if (profile?.avatar_url) {
      setFullScreenImageVisible(true);
    }
  };

  const handleViewStory = () => {
    setActionSheetVisible(false);
    if (storyGroups.length > 0) {
      setViewerStart(0);
    }
  };

  const handleViewProfilePhoto = () => {
    setActionSheetVisible(false);
    if (profile?.avatar_url) {
      setFullScreenImageVisible(true);
    }
  };

  const closeStoryViewer = () => setViewerStart(null);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-row items-center justify-between px-5 pt-2">
        <Text className="text-2xl font-extrabold text-gray-900 dark:text-white">Profil</Text>
        <Pressable onPress={() => router.push('/settings')} className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
          <Settings size={22} className="text-gray-600 dark:text-gray-300" />
        </Pressable>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        numColumns={3}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View className="px-5 pt-4 pb-10">
            <View className="flex-row items-start">
              <View className="mr-4">
                <Pressable onPress={handleAvatarPress}>
                  <Avatar uri={profile?.avatar_url} name={profile?.full_name} size={96} hasStory={hasStory} />
                </Pressable>
                <Pressable onPress={changeAvatar} className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-primary-500 dark:border-gray-900" style={{ right: -4, bottom: -4 }}>
                  <Camera size={15} color="#fff" />
                </Pressable>
              </View>
              <View className="flex-1">
                <Text className="text-xl font-extrabold text-gray-900 dark:text-white">
                  {profile?.full_name || 'Kullanıcı'}
                </Text>
                <Text className="text-base text-gray-500 dark:text-gray-400">@{profile?.username}</Text>
                <View className="mt-3 flex-row gap-6">
                  <View>
                    <Text className="text-lg font-bold text-gray-900 dark:text-white">{stats.posts}</Text>
                    <Text className="text-sm text-gray-500 dark:text-gray-400">Gönderi</Text>
                  </View>
                  <View>
                    <Text className="text-lg font-bold text-gray-900 dark:text-white">{stats.followers}</Text>
                    <Text className="text-sm text-gray-500 dark:text-gray-400">Takipçi</Text>
                  </View>
                  <View>
                    <Text className="text-lg font-bold text-gray-900 dark:text-white">{stats.following}</Text>
                    <Text className="text-sm text-gray-500 dark:text-gray-400">Takip</Text>
                  </View>
                </View>
              </View>
            </View>

            <View className="mt-6 flex-row items-center border-b border-gray-200 dark:border-gray-700 pb-3">
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-900 dark:text-white">Gönderiler</Text>
              </View>
              <Pressable onPress={() => {}}>
                <Grid size={20} className="text-gray-600 dark:text-gray-300" />
              </Pressable>
            </View>

            {loadingPosts && (
              <View className="mt-10 items-center">
                <Text className="text-gray-500 dark:text-gray-400">Yükleniyor...</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          !loadingPosts ? (
            <View className="mt-10 items-center">
              <Text className="text-gray-500 dark:text-gray-400">Henüz gönderi yok</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View className="m-0.5 aspect-square flex-1">
            {item.media_url ? (
              <Image
                source={{ uri: item.media_url }}
                className="h-full w-full"
                resizeMode="cover"
              />
            ) : (
              <View className="h-full w-full items-center justify-center bg-gray-100 dark:bg-gray-800">
                <Text className="text-xs text-gray-500 dark:text-gray-400" numberOfLines={3}>
                  {item.body}
                </Text>
              </View>
            )}
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 24 }}
      />

      <ActionSheet
        visible={actionSheetVisible}
        onClose={() => setActionSheetVisible(false)}
        options={[
          {
            label: 'Hikayeyi Görüntüle',
            icon: <Camera size={20} color="#0ea5e9" />,
            onPress: handleViewStory,
          },
          {
            label: 'Profil Fotoğrafını Gör',
            icon: <ImageIcon size={20} color="#0ea5e9" />,
            onPress: handleViewProfilePhoto,
          },
        ]}
      />

      <FullScreenImage
        visible={fullScreenImageVisible}
        onClose={() => setFullScreenImageVisible(false)}
        uri={profile?.avatar_url ?? null}
      />

      <StoryViewer
        visible={viewerStart !== null}
        groups={storyGroups}
        startIndex={viewerStart ?? 0}
        onClose={closeStoryViewer}
        onSeen={() => {}}
      />
    </SafeAreaView>
  );
}
