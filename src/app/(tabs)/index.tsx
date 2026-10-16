import { Plus, Search, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
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

export default function Home() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostView[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<PostView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<PostView | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
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
    if (!searchQuery.trim()) {
      setFilteredPosts(posts);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = posts.filter(
        (post) =>
          post.body?.toLowerCase().includes(query) ||
          post.author?.username?.toLowerCase().includes(query) ||
          post.author?.full_name?.toLowerCase().includes(query),
      );
      setFilteredPosts(filtered);
    }
  }, [posts, searchQuery]);

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
      }
    },
    [user],
  );

  const toggleArchive = useCallback(
    async (post: PostView) => {
      if (!user) return;
      const nextArchived = !post.is_archived;
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, is_archived: nextArchived } : p)),
      );
      const { error } = await supabase
        .from('posts')
        .update({ is_archived: nextArchived })
        .eq('id', post.id);
      if (error) {
        setPosts((prev) =>
          prev.map((p) => (p.id === post.id ? { ...p, is_archived: post.is_archived } : p)),
        );
      }
    },
    [user],
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

  const changeCommentCount = useCallback((postId: string, delta: number) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, commentCount: p.commentCount + delta } : p)));
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
          <Text className="text-2xl font-extrabold text-gray-900 dark:text-white">Campus Connect</Text>
          <Pressable
            onPress={() => setComposerOpen(true)}
            className="h-10 w-10 items-center justify-center rounded-full bg-primary-500"
          >
            <Plus size={22} color="#fff" />
          </Pressable>
        </View>

        <View className="flex-row items-center rounded-xl bg-gray-100 dark:bg-gray-800 px-4 py-3">
          <Search size={20} className="text-gray-500 dark:text-gray-400" />
          <TextInput
            placeholder="Gönderi veya kullanıcı ara..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 ml-3 text-base text-gray-900 dark:text-white"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} className="ml-2">
              <X size={18} className="text-gray-500 dark:text-gray-400" />
            </Pressable>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator className="mt-10" color="#0ea5e9" />
      ) : (
        <FlatList
          data={filteredPosts.filter((p) => !p.is_archived)}
          keyExtractor={(p) => p.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={<StoriesBar ref={storiesRef} />}
          ListEmptyComponent={
            searchQuery ? (
              <EmptyState title="Sonuç bulunamadı" hint="Farklı bir arama terimi deneyin." />
            ) : (
              <EmptyState title="Henüz gönderi yok" hint="Sağ üstteki + ile ilk gönderiyi sen paylaş." />
            )
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
        shareText={attachment ? `${attachment.title}\n${attachment.subtitle ?? ''}\nCampus Connect` : ''}
        onClose={() => setShareTarget(null)}
      />
    </SafeAreaView>
  );
}
