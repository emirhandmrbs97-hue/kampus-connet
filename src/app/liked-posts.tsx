import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommentsSheet } from '@/components/CommentsSheet';
import { EmptyState } from '@/components/ui';
import { PostCard } from '@/components/PostCard';
import { useAuth } from '@/context/AuthContext';
import { goBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { fetchProfiles } from '@/services/profiles';
import type { PostRow, PostView } from '@/types';

export default function LikedPostsScreen() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostView[]>([]);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPosts = useCallback(async () => {
    if (!user) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: ownLikes, error: likesError } = await supabase
        .from('likes')
        .select('post_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (likesError) throw likesError;
      const postIds = (ownLikes ?? []).map((like) => like.post_id);
      if (!postIds.length) {
        setPosts([]);
        return;
      }

      const { data: postData, error: postsError } = await supabase.from('posts').select('*').in('id', postIds);
      if (postsError) throw postsError;
      const rows = (postData ?? []) as PostRow[];
      const [profiles, allLikesResult, commentsResult] = await Promise.all([
        fetchProfiles(rows.map((post) => post.author_id)),
        supabase.from('likes').select('post_id,user_id').in('post_id', postIds),
        supabase.from('comments').select('post_id').in('post_id', postIds),
      ]);
      if (allLikesResult.error) throw allLikesResult.error;
      if (commentsResult.error) throw commentsResult.error;

      const allLikes = allLikesResult.data ?? [];
      const comments = commentsResult.data ?? [];
      const order = new Map(postIds.map((id, index) => [id, index]));
      setPosts(
        rows
          .sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0))
          .map((post) => ({
            ...post,
            author: profiles[post.author_id],
            likeCount: allLikes.filter((like) => like.post_id === post.id).length,
            liked: allLikes.some((like) => like.post_id === post.id && like.user_id === user.id),
            commentCount: comments.filter((comment) => comment.post_id === post.id).length,
            is_archived: post.is_archived ?? false,
            commentsDisabled: post.comments_disabled ?? false,
            hideLikeCount: post.hide_like_count ?? false,
          })),
      );
    } catch (error) {
      console.error('Beğenilen gönderiler yüklenemedi:', error);
      Alert.alert('Gönderiler yüklenemedi', error instanceof Error ? error.message : 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const refresh = async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  };

  const unlikePost = async (post: PostView) => {
    if (!user) return;
    const { error } = await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', user.id);
    if (error) {
      Alert.alert('Beğeni kaldırılamadı', error.message);
      return;
    }
    setPosts((current) => current.filter((item) => item.id !== post.id));
  };

  const updatePostSetting = async (post: PostView, field: 'is_archived' | 'comments_disabled' | 'hide_like_count', value: boolean) => {
    if (!user || post.author_id !== user.id) {
      Alert.alert('İşlem yapılamadı', 'Bu ayarı yalnızca gönderi sahibi değiştirebilir.');
      return;
    }
    const { error } = await supabase.from('posts').update({ [field]: value }).eq('id', post.id).eq('author_id', user.id);
    if (error) {
      Alert.alert('Gönderi güncellenemedi', error.message);
      return;
    }
    if (field === 'is_archived' && value) {
      setPosts((current) => current.filter((item) => item.id !== post.id));
      return;
    }
    setPosts((current) =>
      current.map((item) =>
        item.id === post.id
          ? {
              ...item,
              ...(field === 'is_archived' ? { is_archived: value } : {}),
              ...(field === 'comments_disabled' ? { commentsDisabled: value } : {}),
              ...(field === 'hide_like_count' ? { hideLikeCount: value } : {}),
            }
          : item,
      ),
    );
  };

  const changeCommentCount = (postId: string, delta: number) => {
    setPosts((current) =>
      current.map((post) => (post.id === postId ? { ...post, commentCount: Math.max(0, post.commentCount + delta) } : post)),
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-gray-900">
      <View className="mb-4 flex-row items-center px-5 pt-2">
        <Pressable onPress={() => goBack()} className="mr-4">
          <ChevronLeft size={24} color="#374151" />
        </Pressable>
        <Text className="text-2xl font-extrabold text-gray-900 dark:text-white">Beğenilen gönderiler</Text>
      </View>
      {loading ? (
        <ActivityIndicator className="mt-10" color="#0ea5e9" />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(post) => post.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
          ListEmptyComponent={<EmptyState title="Henüz beğeni yok" hint="Beğendiğin gönderiler burada görünür." />}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onLike={(post) => void unlikePost(post)}
              onComment={(post) => setCommentPostId(post.id)}
              onShare={(post) => {
                void Share.share({
                  message: post.body || post.media_url || 'KampüsHub gönderisi',
                  title: 'Gönderiyi paylaş',
                }).catch((error: unknown) => {
                  Alert.alert('Gönderi paylaşılamadı', error instanceof Error ? error.message : 'Bir hata oluştu.');
                });
              }}
              onArchive={(post) => void updatePostSetting(post, 'is_archived', !post.is_archived)}
              onToggleComments={(post) =>
                void updatePostSetting(post, 'comments_disabled', !post.commentsDisabled)
              }
              onToggleLikeCount={(post) =>
                void updatePostSetting(post, 'hide_like_count', !post.hideLikeCount)
              }
            />
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
      <CommentsSheet
        postId={commentPostId}
        onClose={() => setCommentPostId(null)}
        onCountChange={changeCommentCount}
      />
    </SafeAreaView>
  );
}
