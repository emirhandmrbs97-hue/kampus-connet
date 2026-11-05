import { Plus } from 'lucide-react-native';
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
import { supabase } from '@/lib/supabase';
import { fetchProfiles } from '@/services/profiles';
import type { Attachment, PostRow, PostView } from '@/types';

type LikeRow = { post_id: string; user_id: string };
type CommentRow = { post_id: string };

export default function Feed() {
  const { user } = useAuth();
  const storiesRef = useRef<StoriesBarHandle>(null);

  const [posts, setPosts] = useState<PostView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [share, setShare] = useState<{ attachment: Attachment; text: string } | null>(null);

  const loadPosts = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      setLoadError(error.message);
      return;
    }
    setLoadError(null);

    // Arşivlenenleri istemci tarafında ele (sütun yoksa da çalışsın)
    const rows = ((data ?? []) as PostRow[]).filter((p) => !p.is_archived);
    const ids = rows.map((r) => r.id);

    const [profiles, likesRes, commentsRes] = await Promise.all([
      fetchProfiles(rows.map((r) => r.author_id)),
      ids.length
        ? supabase.from('likes').select('post_id, user_id').in('post_id', ids)
        : Promise.resolve({ data: [] as LikeRow[] }),
      ids.length
        ? supabase.from('comments').select('post_id').in('post_id', ids)
        : Promise.resolve({ data: [] as CommentRow[] }),
    ]);

    const likes = (likesRes.data ?? []) as LikeRow[];
    const comments = (commentsRes.data ?? []) as CommentRow[];

    const likeCount = new Map<string, number>();
    const mine = new Set<string>();
    likes.forEach((l) => {
      likeCount.set(l.post_id, (likeCount.get(l.post_id) ?? 0) + 1);
      if (l.user_id === user.id) mine.add(l.post_id);
    });
    const commentCount = new Map<string, number>();
    comments.forEach((c) => commentCount.set(c.post_id, (commentCount.get(c.post_id) ?? 0) + 1));

    setPosts(
      rows.map((r) => ({
        ...r,
        author: profiles[r.author_id],
        likeCount: likeCount.get(r.id) ?? 0,
        liked: mine.has(r.id),
        commentCount: commentCount.get(r.id) ?? 0,
        commentsDisabled: !!r.comments_disabled,
        hideLikeCount: !!r.hide_like_count,
      })),
    );
  }, [user]);

  useEffect(() => {
    loadPosts().finally(() => setLoading(false));
  }, [loadPosts]);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([loadPosts(), storiesRef.current?.reload()]);
    setRefreshing(false);
  };

  const onLike = async (post: PostView) => {
    if (!user) return;
    const liked = !post.liked;
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, liked, likeCount: p.likeCount + (liked ? 1 : -1) } : p)),
    );
    const { error } = liked
      ? await supabase.from('likes').insert({ post_id: post.id, user_id: user.id })
      : await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', user.id);
    if (error) loadPosts();
  };

  const onComment = (post: PostView) => {
    if (post.commentsDisabled) {
      Alert.alert('Yorumlar kapalı', 'Bu gönderide yorum yapılamıyor.');
      return;
    }
    setCommentsPostId(post.id);
  };

  const onCommentCountChange = (postId: string, delta: number) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, commentCount: p.commentCount + delta } : p)));
  };

  const onShare = (post: PostView) => {
    const title = post.body.trim().slice(0, 60) || post.file_name || 'Gönderi';
    setShare({
      attachment: {
        kind: 'post',
        id: post.id,
        title,
        subtitle: post.author?.username ? `@${post.author.username}` : undefined,
        image: post.media_type === 'image' ? post.media_url : null,
      },
      text: `${post.author?.username ?? 'Campus Connect'}: ${post.body.trim() || title}`,
    });
  };

  /** Yalnızca gönderi sahibi değiştirebilir; RLS engellerse 0 satır döner. */
  const updateOwnPost = async (post: PostView, patch: Record<string, boolean>) => {
    if (!user) return false;
    if (post.author_id !== user.id) {
      Alert.alert('İzin yok', 'Yalnızca kendi gönderilerini düzenleyebilirsin.');
      return false;
    }
    const { data, error } = await supabase.from('posts').update(patch).eq('id', post.id).select('id');
    if (error) {
      Alert.alert('İşlem yapılamadı', error.message);
      return false;
    }
    if (!data || data.length === 0) {
      Alert.alert('İşlem yapılamadı', 'Veritabanı izni eksik olabilir (posts için update politikası).');
      return false;
    }
    return true;
  };

  const onArchive = async (post: PostView) => {
    if (await updateOwnPost(post, { is_archived: !post.is_archived })) {
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    }
  };

  const onToggleComments = async (post: PostView) => {
    const next = !post.commentsDisabled;
    if (await updateOwnPost(post, { comments_disabled: next })) {
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, commentsDisabled: next } : p)));
    }
  };

  const onToggleLikeCount = async (post: PostView) => {
    const next = !post.hideLikeCount;
    if (await updateOwnPost(post, { hide_like_count: next })) {
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, hideLikeCount: next } : p)));
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-row items-center justify-between px-5 pb-1 pt-2">
        <Text className="text-2xl font-extrabold text-gray-900 dark:text-white">Ana sayfa</Text>
        <Pressable
          onPress={() => setComposerOpen(true)}
          className="h-10 w-10 items-center justify-center rounded-full bg-primary-500"
        >
          <Plus size={22} color="#fff" />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator className="mt-10" color="#0ea5e9" />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListHeaderComponent={<StoriesBar ref={storiesRef} />}
          ListEmptyComponent={
            loadError ? (
              <EmptyState title="Gönderiler yüklenemedi" hint={loadError} />
            ) : (
              <EmptyState title="Henüz gönderi yok" hint="Sağ üstteki + ile ilk gönderiyi sen paylaş." />
            )
          }
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onLike={onLike}
              onComment={onComment}
              onShare={onShare}
              onArchive={onArchive}
              onToggleComments={onToggleComments}
              onToggleLikeCount={onToggleLikeCount}
            />
          )}
        />
      )}

      <PostComposer visible={composerOpen} onClose={() => setComposerOpen(false)} onPosted={refresh} />
      <CommentsSheet postId={commentsPostId} onClose={() => setCommentsPostId(null)} onCountChange={onCommentCountChange} />
      <ShareSheet attachment={share?.attachment ?? null} shareText={share?.text ?? ''} onClose={() => setShare(null)} />
    </SafeAreaView>
  );
}
