import { Archive, FileText, Heart, MessageCircle, MoreHorizontal, Send, Unlock, EyeOff } from 'lucide-react-native';
import { memo, useRef, useState } from 'react';
import { Animated, Image, Pressable, Text, View } from 'react-native';

import { ActionSheet, Avatar } from '@/components/ui';
import { timeAgo } from '@/lib/format';
import { openFile } from '@/lib/openFile';
import type { PostView } from '@/types';

function PostCardBase({
  post,
  onLike,
  onComment,
  onShare,
  onArchive,
  onToggleComments,
  onToggleLikeCount,
}: {
  post: PostView;
  onLike: (post: PostView) => void;
  onComment: (post: PostView) => void;
  onShare: (post: PostView) => void;
  onArchive?: (post: PostView) => void;
  onToggleComments?: (post: PostView) => void;
  onToggleLikeCount?: (post: PostView) => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const [menuVisible, setMenuVisible] = useState(false);

  const handleArchive = () => {
    if (onArchive) onArchive(post);
    setMenuVisible(false);
  };

  const handleToggleComments = () => {
    if (onToggleComments) onToggleComments(post);
    setMenuVisible(false);
  };

  const handleToggleLikeCount = () => {
    if (onToggleLikeCount) onToggleLikeCount(post);
    setMenuVisible(false);
  };

  const like = () => {
    if (!post.liked) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.5, speed: 40, bounciness: 12, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, speed: 20, bounciness: 8, useNativeDriver: true }),
      ]).start();
    }
    onLike(post);
  };

  return (
    <View className="mx-4 mb-4 rounded-3xl bg-gray-50 p-4 dark:bg-gray-800">
      <View className="flex-row items-center">
        <Avatar uri={post.author?.avatar_url} name={post.author?.full_name} size={40} />
        <View className="ml-3 flex-1">
          <Text className="font-semibold text-gray-900 dark:text-white">
            {post.author?.full_name || post.author?.username || 'Kullanıcı'}
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            @{post.author?.username} · {timeAgo(post.created_at)}
          </Text>
        </View>
        <Pressable onPress={() => setMenuVisible(true)} hitSlop={8}>
          <MoreHorizontal size={22} color="#9ca3af" />
        </Pressable>
      </View>

      {post.body ? (
        <Text className="mt-3 text-base leading-6 text-gray-900 dark:text-gray-100">{post.body}</Text>
      ) : null}

      {post.media_type === 'image' && post.media_url ? (
        <Image
          source={{ uri: post.media_url }}
          className="mt-3 h-64 w-full rounded-2xl bg-gray-200 dark:bg-gray-700"
          resizeMode="cover"
        />
      ) : null}

      {post.media_type === 'pdf' && post.media_url ? (
        <Pressable
          onPress={() => openFile(post.media_url!)}
          className="mt-3 flex-row items-center rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
        >
          <View className="h-12 w-12 items-center justify-center rounded-xl bg-red-100">
            <FileText size={24} color="#dc2626" />
          </View>
          <View className="ml-3 flex-1">
            <Text numberOfLines={1} className="font-semibold text-gray-900 dark:text-white">
              {post.file_name ?? 'Belge.pdf'}
            </Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400">PDF belgesi · Açmak için dokun</Text>
          </View>
        </Pressable>
      ) : null}

      <View className="mt-4 flex-row items-center">
        <Pressable onPress={like} hitSlop={8} className="mr-6 flex-row items-center">
          <Animated.View style={{ transform: [{ scale }] }}>
            <Heart
              size={24}
              color={post.liked ? '#ef4444' : '#9ca3af'}
              fill={post.liked ? '#ef4444' : 'transparent'}
            />
          </Animated.View>
          {!post.hideLikeCount && (
            <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-300">{post.likeCount}</Text>
          )}
        </Pressable>
        <Pressable onPress={() => onComment(post)} hitSlop={8} className="mr-6 flex-row items-center">
          <MessageCircle size={24} color="#9ca3af" />
          <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-300">{post.commentCount}</Text>
        </Pressable>
        <Pressable onPress={() => onShare(post)} hitSlop={8} className="ml-auto">
          <Send size={22} color="#9ca3af" />
        </Pressable>
      </View>

      {post.commentsDisabled && (
        <Text className="mt-2 text-xs text-gray-500 dark:text-gray-400">Yorumlar kapatıldı</Text>
      )}

      <ActionSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        options={[
          {
            label: post.is_archived ? 'Arşivden Çıkar' : 'Arşivle',
            icon: <Archive size={20} color="#0ea5e9" />,
            onPress: handleArchive,
          },
          {
            label: post.commentsDisabled ? 'Yorum Yapmayı Aç' : 'Yorum Yapmayı Kapat',
            icon: post.commentsDisabled ? <Unlock size={20} color="#0ea5e9" /> : <EyeOff size={20} color="#0ea5e9" />,
            onPress: handleToggleComments,
          },
          {
            label: post.hideLikeCount ? 'Beğeni Sayısını Göster' : 'Beğeni Sayısını Gizle',
            icon: <EyeOff size={20} color="#0ea5e9" />,
            onPress: handleToggleLikeCount,
          },
        ]}
      />
    </View>
  );
}

export const PostCard = memo(PostCardBase);
