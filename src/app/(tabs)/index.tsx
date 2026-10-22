import { BellRing, Plus, UserPlus } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommentsSheet } from '@/components/CommentsSheet';
import { PostCard } from '@/components/PostCard';
import { PostComposer } from '@/components/PostComposer';
import { ShareSheet } from '@/components/ShareSheet';
import { StoriesBar, type StoriesBarHandle } from '@/components/StoriesBar';
import { EmptyState } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useNotifications } from '@/context/NotificationsContext';
import { supabase } from '@/lib/supabase';
import { fetchProfiles } from '@/services/profiles';
import type { Attachment, PostView } from '@/types';

export default function Home() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { unreadCount } = useNotifications();
  const { postId } = useLocalSearchParams<{ postId?: string }>();
  const [posts, setPosts] = useState<PostView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<PostView | null>(null);
  const storiesRef = useRef<StoriesBarHandle>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
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
  }, [user]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (postId) setCommentPostId(postId);
  }, [postId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), storiesRef.current?.reload()]);
    setRefreshing(false);
  };

  const toggleLike = useCallback(
    async (post: PostView) => {
      if (!user) return;
      const nextLiked = !post.liked;
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, liked: nextLiked, likeCount: p.likeCount + (nextLiked ? 1 : -1) } : p,
        ),
      );
      const { error } = nextLiked
        ? await supabase.from('likes').insert({ post_id: post.id, user_id: user.id })
        : await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', user.id);
      if (error) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id ? { ...p, liked: post.liked, likeCount: post.likeCount } : p,
          ),
        );
        Alert.alert('Beğeni güncellenemedi', error.message);
      }
    },
    [user],
  );

  const toggleArchive = useCallback(
    async (post: PostView) => {
      if (!user || post.author_id !== user.id) return;
      const nextArchived = !post.is_archived;
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, is_archived: nextArchived } : p)),
      );
      const { error } = await supabase
        .from('posts')
        .update({ is_archived: nextArchived })
        .eq('id', post.id)
        .eq('author_id', user.id);
      if (error) {
        setPosts((prev) =>
          prev.map((p) => (p.id === post.id ? { ...p, is_archived: post.is_archived } : p)),
        );
        Alert.alert('Gönderi güncellenemedi', error.message);
      }
    },
    [user],
  );

  const toggleComments = useCallback(
    async (post: PostView) => {
      if (!user || post.author_id !== user.id) return;
      const nextDisabled = !post.commentsDisabled;
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, commentsDisabled: nextDisabled } : p)),
      );
      const { error } = await supabase
        .from('posts')
        .update({ comments_disabled: nextDisabled })
        .eq('id', post.id)
        .eq('author_id', user.id);
      if (error) {
        setPosts((prev) =>
          prev.map((p) => (p.id === post.id ? { ...p, commentsDisabled: post.commentsDisabled } : p)),
        );
        Alert.alert('Yorum ayarı güncellenemedi', error.message);
      }
    },
    [user],
  );

  const toggleLikeCount = useCallback(
    async (post: PostView) => {
      if (!user || post.author_id !== user.id) return;
      const nextHide = !post.hideLikeCount;
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, hideLikeCount: nextHide } : p)),
      );
      const { error } = await supabase
        .from('posts')
        .update({ hide_like_count: nextHide })
        .eq('id', post.id)
        .eq('author_id', user.id);
      if (error) {
        setPosts((prev) =>
          prev.map((p) => (p.id === post.id ? { ...p, hideLikeCount: post.hideLikeCount } : p)),
        );
        Alert.alert('Beğeni ayarı güncellenemedi', error.message);
      }
    },
    [user],
  );

  const changeCommentCount = useCallback((postId: string, delta: number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount + delta) } : p,
      ),
    );
  }, []);

  const openComments = useCallback((p: PostView) => setCommentPostId(p.id), []);
  const openShare = useCallback((p: PostView) => setShareTarget(p), []);

  const attachment: Attachment | null = shareTarget
    ? {
        kind: 'post',
        id: shareTarget.id,
        title: shareTarget.body ? shareTarget.body.slice(0, 80) : shareTarget.file_name ?? 'Gönderi',
        subtitle: `@${shareTarget.author?.username ?? ''}`,
        image: shareTarget.media_type === 'image' ? shareTarget.media_url : null,
      }
    : null;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-gray-900">
      <View className="px-5 pt-2">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-2xl font-extrabold text-gray-900 dark:text-white">KampüsHub</Text>
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => router.push('/search')}
              accessibilityLabel="Arkadaş bul"
              className="h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 shadow-sm dark:bg-violet-950"
            >
              <UserPlus size={21} color="#7c3aed" strokeWidth={2.5} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/notifications')}
              accessibilityLabel="Bildirimler"
              className="h-11 w-11 items-center justify-center rounded-2xl bg-primary-500 shadow-sm"
            >
              <BellRing size={21} color="#ffffff" strokeWidth={2.5} />
              {unreadCount > 0 ? (
                <View className="absolute -right-1.5 -top-1.5 min-w-5 items-center rounded-full border-2 border-white bg-pink-500 px-1 dark:border-gray-900">
                  <Text className="text-[10px] font-extrabold text-white">{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              onPress={() => setComposerOpen(true)}
              accessibilityLabel="Gönderi oluştur"
              className="h-11 w-11 items-center justify-center rounded-2xl bg-gray-900 shadow-sm dark:bg-white"
            >
              <Plus size={23} color="#0ea5e9" strokeWidth={2.8} />
            </Pressable>
          </View>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator className="mt-10" color="#0ea5e9" />
      ) : (
        <FlatList
          data={posts.filter((p) => !p.is_archived)}
          keyExtractor={(p) => p.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={<StoriesBar ref={storiesRef} />}
          ListEmptyComponent={
            <EmptyState title={t('noPosts')} hint={t('firstPostHint')} />
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onLike={toggleLike}
              onComment={openComments}
              onShare={openShare}
              onArchive={toggleArchive}
              onToggleComments={toggleComments}
              onToggleLikeCount={toggleLikeCount}
            />
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}

      <PostComposer visible={composerOpen} onClose={() => setComposerOpen(false)} onPosted={load} />
      <CommentsSheet postId={commentPostId} onClose={() => setCommentPostId(null)} onCountChange={changeCommentCount} />
      <ShareSheet
        attachment={attachment}
        shareText={attachment ? `${attachment.title}\n${attachment.subtitle ?? ''}\nKampüsHub` : ''}
        onClose={() => setShareTarget(null)}
      />
    </SafeAreaView>
  );
}
