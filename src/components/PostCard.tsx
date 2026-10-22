import { Archive, FileText, Heart, MessageCircle, MoreHorizontal, Send, Unlock, EyeOff, X } from 'lucide-react-native';
import { router } from 'expo-router';
import { memo, useEffect, useState } from 'react';
import { Animated, Image, Modal, Pressable, Text, View } from 'react-native';

import { StorageImage } from '@/components/StorageImage';
import { ActionSheet, Avatar } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { MentionText } from '@/components/MentionText';
import { timeAgo } from '@/lib/format';
import { openFile } from '@/lib/openFile';
import { resolveMediaUrl } from '@/services/storageService';
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
  const { user } = useAuth();
  const { t } = useLanguage();
  const [scale] = useState(() => new Animated.Value(1));
  const [menuVisible, setMenuVisible] = useState(false);
  const [fullScreenImageVisible, setFullScreenImageVisible] = useState(false);
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);
  const isAuthor = post.author_id === user?.id;
  const hideLikeCount = post.hideLikeCount ?? post.hide_like_count ?? false;
  const commentsDisabled = post.commentsDisabled ?? post.comments_disabled ?? false;

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

  useEffect(() => {
    if (post.media_url) {
      resolveMediaUrl(post.media_url)
        .then(setResolvedImageUrl)
        .catch(() => setResolvedImageUrl(null));
    } else {
      setResolvedImageUrl(null);
    }
  }, [post.media_url]);

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
        <Pressable
          onPress={() =>
            post.author?.id &&
            router.push({ pathname: '/profile/[id]', params: { id: post.author.id } })
          }
          accessibilityRole="link"
        >
          <Avatar uri={post.author?.avatar_url} name={post.author?.full_name} size={40} />
        </Pressable>
        <View className="ml-3 flex-1">
          <Pressable
            onPress={() =>
              post.author?.id &&
              router.push({ pathname: '/profile/[id]', params: { id: post.author.id } })
            }
            accessibilityRole="link"
          >
            <Text className="font-semibold text-gray-900 dark:text-white">
              {post.author?.full_name || post.author?.username || 'Kullanıcı'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() =>
              post.author?.id &&
              router.push({ pathname: '/profile/[id]', params: { id: post.author.id } })
            }
            accessibilityRole="link"
          >
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              @{post.author?.username} · {timeAgo(post.created_at)}
            </Text>
          </Pressable>
        </View>
        {isAuthor ? (
          <Pressable onPress={() => setMenuVisible(true)} hitSlop={8} accessibilityLabel={t('postOptions')}>
            <MoreHorizontal size={22} color="#9ca3af" />
          </Pressable>
        ) : null}
      </View>

      {post.body ? (
        <MentionText className="mt-3 text-base leading-6 text-gray-900 dark:text-gray-100">{post.body}</MentionText>
      ) : null}

      {post.media_type === 'image' && post.media_url ? (
        <Pressable onPress={() => setFullScreenImageVisible(true)}>
          <StorageImage
            uri={post.media_url}
            className="mt-3 h-64 w-full rounded-2xl bg-gray-200 dark:bg-gray-700"
            resizeMode="cover"
          />
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
            <Text className="text-xs text-gray-500 dark:text-gray-400">{t('pdfOpenHint')}</Text>
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
          {!hideLikeCount || isAuthor ? (
            <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-300">{post.likeCount}</Text>
          ) : (
            <Text className="ml-1.5 text-xs text-gray-500 dark:text-gray-400">{t('likeHidden')}</Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => {
            if (!commentsDisabled) onComment(post);
          }}
          disabled={commentsDisabled}
          hitSlop={8}
          className="mr-6 flex-row items-center"
          accessibilityState={{ disabled: commentsDisabled }}
        >
          <MessageCircle size={24} color="#9ca3af" />
          {!commentsDisabled ? (
            <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-300">{post.commentCount}</Text>
          ) : null}
        </Pressable>
        <Pressable onPress={() => onShare(post)} hitSlop={8} className="ml-auto">
          <Send size={22} color="#9ca3af" />
        </Pressable>
      </View>

      {commentsDisabled && (
        <Text className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t('commentsOff')}</Text>
      )}

      {isAuthor ? (
        <ActionSheet
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          options={[
            {
              label: post.is_archived ? t('restoreArchive') : t('archiveChat'),
              icon: <Archive size={20} color="#0ea5e9" />,
              onPress: handleArchive,
            },
            {
              label: commentsDisabled ? t('turnCommentsOn') : t('turnCommentsOff'),
              icon: commentsDisabled ? <Unlock size={20} color="#0ea5e9" /> : <EyeOff size={20} color="#0ea5e9" />,
              onPress: handleToggleComments,
            },
            {
              label: hideLikeCount ? t('showLikeCount') : t('hideLikeCount'),
              icon: <EyeOff size={20} color="#0ea5e9" />,
              onPress: handleToggleLikeCount,
            },
          ]}
        />
      ) : null}

      <Modal visible={fullScreenImageVisible} transparent animationType="fade" onRequestClose={() => setFullScreenImageVisible(false)}>
        <Pressable className="flex-1 bg-black" onPress={() => setFullScreenImageVisible(false)}>
          {resolvedImageUrl ? (
            <Image source={{ uri: resolvedImageUrl }} className="flex-1" resizeMode="contain" />
          ) : null}
          <Pressable
            onPress={() => setFullScreenImageVisible(false)}
            className="absolute top-8 right-4 h-10 w-10 items-center justify-center rounded-full bg-black/50"
          >
            <X size={24} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export const PostCard = memo(PostCardBase);
