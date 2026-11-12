import { Archive, FileText, Heart, MessageCircle, MoreHorizontal, Send, Unlock, EyeOff } from 'lucide-react-native';
import { memo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ActionSheet, Avatar } from '@/components/ui';
import { StorageImage } from '@/components/StorageImage';
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
  const likeScale = useSharedValue(1);
  const heartProgress = useSharedValue(0);
  const lastImageTap = useRef(0);
  const [menuVisible, setMenuVisible] = useState(false);
  const likeIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));
  const heartOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(heartProgress.value, [0, 0.12, 0.75, 1], [0, 1, 1, 0]),
    transform: [{ scale: interpolate(heartProgress.value, [0, 0.7, 1], [0.25, 1.2, 0.95]) }],
  }));

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

  const popHeart = () => {
    cancelAnimation(heartProgress);
    heartProgress.value = withSequence(
      withTiming(0, { duration: 1 }),
      withSpring(1, { damping: 10, stiffness: 180 }),
      withDelay(450, withTiming(0, { duration: 220 })),
    );
  };

  const animateLike = () => {
    popHeart();
    cancelAnimation(likeScale);
    likeScale.value = withSequence(
      withSpring(1.35, { damping: 6, stiffness: 240 }),
      withSpring(1, { damping: 9, stiffness: 180 }),
    );
  };

  const like = () => {
    animateLike();
    onLike(post);
  };

  const handleImagePress = () => {
    const now = Date.now();
    if (now - lastImageTap.current < 300) {
      lastImageTap.current = 0;
      popHeart();
      if (!post.liked) onLike(post);
      return;
    }
    lastImageTap.current = now;
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
        <Pressable
          onPress={() => setMenuVisible(true)}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
        >
          <MoreHorizontal size={22} color="#9ca3af" />
        </Pressable>
      </View>

      {post.body ? (
        <Text className="mt-3 text-base leading-6 text-gray-900 dark:text-gray-100">{post.body}</Text>
      ) : null}

      {post.media_type === 'image' && post.media_url ? (
        <Pressable
          onPress={handleImagePress}
          accessibilityRole="imagebutton"
          accessibilityLabel="Gönderi görselini beğenmek için iki kez dokun"
          style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}
          className="relative mt-3 overflow-hidden rounded-2xl bg-gray-200 dark:bg-gray-700"
        >
          <StorageImage
            uri={post.media_url}
            className="h-64 w-full"
            resizeMode="cover"
          />
          <Animated.View
            pointerEvents="none"
            style={heartOverlayStyle}
            className="absolute inset-0 items-center justify-center"
          >
            <Heart size={88} color="#fff" fill="#ef4444" strokeWidth={1.5} />
          </Animated.View>
        </Pressable>
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
        <Pressable
          onPress={like}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          className="mr-6 flex-row items-center"
        >
          <Animated.View style={likeIconStyle}>
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
