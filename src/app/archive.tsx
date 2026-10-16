import { Archive, ChevronLeft } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { EmptyState } from '@/components/ui';
import { PostCard } from '@/components/PostCard';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { fetchProfiles } from '@/services/profiles';
import type { PostRow, PostView } from '@/types';

export default function ArchiveScreen() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPosts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('posts')
      .select('*')
      .eq('author_id', user.id)
      .eq('is_archived', true)
      .order('created_at', { ascending: false });
    const rows = (data ?? []) as any[];
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
        is_archived: r.is_archived || false,
        commentsDisabled: r.comments_disabled || false,
        hideLikeCount: r.hide_like_count || false,
      })),
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  };

  const toggleArchive = useCallback(
    async (post: PostView) => {
      if (!user) return;
      const { error } = await supabase
        .from('posts')
        .update({ is_archived: false })
        .eq('id', post.id);
      if (error) {
        Alert.alert('Hata', 'Gönderi arşivden çıkarılamadı');
      } else {
        loadPosts();
      }
    },
    [user, loadPosts],
  );

  const toggleComments = useCallback(
    async (post: PostView) => {
      if (!user) return;
      const nextDisabled = !post.commentsDisabled;
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, commentsDisabled: nextDisabled } : p)),
      );
      const { error } = await supabase
        .from('posts')
        .update({ comments_disabled: nextDisabled })
        .eq('id', post.id);
      if (error) {
        setPosts((prev) =>
          prev.map((p) => (p.id === post.id ? { ...p, commentsDisabled: post.commentsDisabled } : p)),
        );
      }
    },
    [user],
  );

  const toggleLikeCount = useCallback(
    async (post: PostView) => {
      if (!user) return;
      const nextHide = !post.hideLikeCount;
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, hideLikeCount: nextHide } : p)),
      );
      const { error } = await supabase
        .from('posts')
        .update({ hide_like_count: nextHide })
        .eq('id', post.id);
      if (error) {
        setPosts((prev) =>
          prev.map((p) => (p.id === post.id ? { ...p, hideLikeCount: post.hideLikeCount } : p)),
        );
      }
    },
    [user],
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-row items-center px-5 pt-2 mb-4">
        <Pressable onPress={() => router.back()} className="mr-4">
          <ChevronLeft size={24} color="#374151" className="dark:text-gray-300" />
        </Pressable>
        <Text className="text-2xl font-extrabold text-gray-900 dark:text-white">Arşiv</Text>
      </View>

      {loading ? (
        <View className="mt-10 items-center">
          <Text className="text-gray-500 dark:text-gray-400">Yükleniyor...</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <EmptyState
              title="Arşiv boş"
              hint="Henüz arşivlenmiş gönderi yok."
            />
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onLike={() => {}}
              onComment={() => {}}
              onShare={() => {}}
              onArchive={toggleArchive}
              onToggleComments={toggleComments}
              onToggleLikeCount={toggleLikeCount}
            />
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </SafeAreaView>
  );
}
