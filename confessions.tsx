import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Platform, Pressable, RefreshControl, Share, Text, TextInput, View, type TextInputInstance } from 'react-native';
import { Heart, ImagePlus, MessageCircle, MoreVertical, Send, Share2, VenetianMask, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionSheet, EmptyState, Sheet } from '@/components/ui';
import { ImageViewerModal } from '@/components/ImageViewerModal';
import { StorageImage } from '@/components/StorageImage';
import { NativeAdCard } from './components/NativeAdCard';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/format';
import { pickImage } from '@/services/mediaPicker';
import { fetchProfiles } from '@/services/profiles';
import { uploadMedia } from '@/services/storageService';
import type { Profile } from '@/types';
import { UniversityPickerModal } from './UniversityPickerModal';

type ConfessionRow = {
  id: string;
  university_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
};

type ConfessionFeedItem = { type: 'confession'; confession: ConfessionRow } | { type: 'ad'; id: string };

type ConfessionComment = {
  id: string;
  confession_id: string;
  user_id: string;
  parent_id: string | null;
  comment_text: string;
  created_at: string;
  author?: Profile;
};

type ConfessionLikeEvent = {
  confession_id: string;
  user_id: string;
  created_at: string;
};

const rememberRealtimeEvent = (events: Set<string>, key: string) => {
  if (events.has(key)) return false;
  events.add(key);
  if (events.size > 2000) {
    const oldest = events.values().next().value;
    if (oldest) events.delete(oldest);
  }
  return true;
};

export default function ConfessionsScreen() {
  const { user } = useAuth();
  const { confessionId: confessionParam, notificationId: notificationParam } = useLocalSearchParams<{
    confessionId?: string | string[];
    notificationId?: string | string[];
  }>();
  const targetConfessionId = Array.isArray(confessionParam) ? confessionParam[0] : confessionParam;
  const notificationId = Array.isArray(notificationParam) ? notificationParam[0] : notificationParam;
  const feedRef = useRef<FlatList<ConfessionFeedItem>>(null);
  const commentInputRef = useRef<TextInputInstance | null>(null);
  const activeConfessionRef = useRef<ConfessionRow | null>(null);
  const processedRealtimeEvents = useRef(new Set<string>());
  const pendingLikeIds = useRef(new Set<string>());
  const [universityFilter, setUniversityFilter] = useState<string | null>(null);
  const [postUniversity, setPostUniversity] = useState<string | null>(null);
  const [pickerTarget, setPickerTarget] = useState<'filter' | 'post' | null>(null);
  const [universityPickerOpen, setUniversityPickerOpen] = useState(false);
  const [confessions, setConfessions] = useState<ConfessionRow[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likeNames, setLikeNames] = useState<Record<string, string[]>>({});
  const [content, setContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [weeklyCount, setWeeklyCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeConfession, setActiveConfession] = useState<ConfessionRow | null>(null);
  const [comments, setComments] = useState<ConfessionComment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentSending, setCommentSending] = useState(false);
  const [selectedComment, setSelectedComment] = useState<ConfessionComment | null>(null);
  const [highlightedConfessionId, setHighlightedConfessionId] = useState<string | null>(null);
  const replyingToComment = comments.find((comment) => comment.id === replyingToCommentId) ?? null;
  const confessionFeedItems = useMemo<ConfessionFeedItem[]>(() => {
    const items: ConfessionFeedItem[] = [];
    confessions.forEach((confession, index) => {
      items.push({ type: 'confession', confession });
      if (index % 10 === 9) {
        items.push({ type: 'ad', id: `ad-confessions-${index + 1}` });
      }
    });
    return items;
  }, [confessions]);

  const updateConfessionCounts = useCallback((confessionId: string, likesDelta: number, commentsDelta: number) => {
    setConfessions((current) =>
      current.map((item) =>
        item.id === confessionId
          ? {
              ...item,
              like_count: Math.max(0, item.like_count + likesDelta),
              comment_count: Math.max(0, item.comment_count + commentsDelta),
            }
          : item,
      ),
    );
    setActiveConfession((current) =>
      current?.id === confessionId
        ? {
            ...current,
            like_count: Math.max(0, current.like_count + likesDelta),
            comment_count: Math.max(0, current.comment_count + commentsDelta),
          }
        : current,
    );
    if (activeConfessionRef.current?.id === confessionId) {
      activeConfessionRef.current = {
        ...activeConfessionRef.current,
        like_count: Math.max(0, activeConfessionRef.current.like_count + likesDelta),
        comment_count: Math.max(0, activeConfessionRef.current.comment_count + commentsDelta),
      };
    }
  }, []);

  const syncLikeNames = useCallback(async (confessionId: string) => {
    const { data, error } = await supabase
      .from('confession_likes')
      .select('user_id')
      .eq('confession_id', confessionId);
    if (error) {
      console.error('[confessions] Failed to sync like names:', error.message);
      return;
    }
    const profiles = await fetchProfiles((data ?? []).map((like) => like.user_id));
    const names = (data ?? [])
      .map((like) => profiles[like.user_id]?.full_name || profiles[like.user_id]?.username)
      .filter((name): name is string => !!name);
    setLikeNames((current) => ({ ...current, [confessionId]: names }));
  }, []);

  useEffect(() => {
    if (!targetConfessionId) return;
    setUniversityFilter(null);
    setHighlightedConfessionId(targetConfessionId);
  }, [targetConfessionId, notificationId]);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    let query = supabase
      .from('confessions_feed')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (universityFilter) query = query.eq('university_id', universityFilter);
    const { data, error } = await query;
    if (error) {
      setLoadError(error.message);
      setConfessions([]);
      setLoading(false);
      return;
    }

    let rows = (data ?? []) as ConfessionRow[];
    if (targetConfessionId && !rows.some((row) => row.id === targetConfessionId)) {
      const { data: target, error: targetError } = await supabase
        .from('confessions_feed')
        .select('*')
        .eq('id', targetConfessionId)
        .maybeSingle();
      if (targetError) {
        console.error('[confessions] Failed to load notification target:', targetError.message);
      } else if (target) {
        rows = [...rows, target as ConfessionRow].sort(
          (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
        );
      }
    }
    setConfessions(rows);
    if (user && rows.length) {
      const { data: likes, error: likesError } = await supabase
        .from('confession_likes')
        .select('confession_id, user_id')
        .in('confession_id', rows.map((row) => row.id));
      if (likesError) {
        console.error('[confessions] Failed to load confession likes:', likesError.message);
      } else {
        const likeRows = likes ?? [];
        const { data: myLikes, error: myLikesError } = await supabase
          .from('confession_likes')
          .select('confession_id')
          .eq('user_id', user.id)
          .in('confession_id', rows.map((row) => row.id));
        if (myLikesError) {
          console.error('[confessions] Failed to load current-user likes:', myLikesError.message);
        } else {
          setLikedIds(new Set((myLikes ?? []).map((like) => like.confession_id)));
        }
        const profiles = await fetchProfiles((likeRows as { user_id: string }[]).map((like) => like.user_id));
        const namesByConfession: Record<string, string[]> = {};
        for (const like of likeRows as { confession_id: string; user_id: string }[]) {
          const profile = profiles[like.user_id];
          const name = profile?.full_name || profile?.username;
          if (name) (namesByConfession[like.confession_id] ??= []).push(name);
        }
        setLikeNames(namesByConfession);
      }
    } else {
      setLikedIds(new Set());
      setLikeNames({});
    }
    setLoading(false);
  }, [targetConfessionId, universityFilter, user]);

  const loadWeeklyQuota = useCallback(async () => {
    if (!user) {
      setWeeklyCount(0);
      return;
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from('confession_quota_tracker')
      .select('confession_id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', since);
    if (error) {
      console.error('[confessions] Failed to load weekly quota:', error.message);
      return;
    }
    setWeeklyCount(Math.min(count ?? 0, 2));
  }, [user]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`confessions-feed-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'confessions' }, (payload) => {
        const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Partial<ConfessionRow>;
        if (!row.id) return;

        if (payload.eventType === 'DELETE') {
          setConfessions((current) => current.filter((item) => item.id !== row.id));
          if (activeConfessionRef.current?.id === row.id) {
            activeConfessionRef.current = null;
            setActiveConfession(null);
            setComments([]);
          }
          return;
        }

        const changed = payload.new as ConfessionRow;
        if (universityFilter && changed.university_id !== universityFilter) return;
        if (payload.eventType === 'INSERT') {
          const eventKey = `confession:INSERT:${changed.id}`;
          if (!rememberRealtimeEvent(processedRealtimeEvents.current, eventKey)) return;
          void supabase
            .from('confessions_feed')
            .select('*')
            .eq('id', changed.id)
            .maybeSingle()
            .then(({ data, error }) => {
              if (error) {
                console.error('[confessions] Failed to load realtime confession:', error.message);
                return;
              }
              if (!data) return;
              setConfessions((current) => {
                if (current.some((item) => item.id === changed.id)) return current;
                return [data as ConfessionRow, ...current].sort(
                  (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
                );
              });
            });
          return;
        }

        setConfessions((current) =>
          current.map((item) =>
            item.id === changed.id
              ? {
                  ...item,
                  university_id: changed.university_id,
                  content: changed.content,
                  image_url: changed.image_url,
                  created_at: changed.created_at,
                }
              : item,
          ),
        );
        setActiveConfession((current) =>
          current?.id === changed.id
            ? {
                ...current,
                university_id: changed.university_id,
                content: changed.content,
                image_url: changed.image_url,
                created_at: changed.created_at,
              }
            : current,
        );
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'confession_likes' }, (payload) => {
        const like = (payload.eventType === 'DELETE' ? payload.old : payload.new) as ConfessionLikeEvent;
        if (!like.confession_id || !like.user_id || like.user_id === user.id) return;
        const eventKey = `like:${payload.eventType}:${like.confession_id}:${like.user_id}:${like.created_at ?? ''}`;
        if (!rememberRealtimeEvent(processedRealtimeEvents.current, eventKey)) return;

        if (payload.eventType === 'INSERT') updateConfessionCounts(like.confession_id, 1, 0);
        if (payload.eventType === 'DELETE') updateConfessionCounts(like.confession_id, -1, 0);
        void syncLikeNames(like.confession_id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'confession_comments' }, (payload) => {
        const comment = (payload.eventType === 'DELETE' ? payload.old : payload.new) as ConfessionComment;
        if (!comment.id || !comment.confession_id) return;
        if (payload.eventType !== 'UPDATE') {
          const eventKey = `comment:${payload.eventType}:${comment.id}:${comment.created_at ?? ''}`;
          if (!rememberRealtimeEvent(processedRealtimeEvents.current, eventKey)) return;
        }

        if (payload.eventType === 'INSERT') {
          if (comment.user_id === user.id) return;
          updateConfessionCounts(comment.confession_id, 0, 1);
          if (activeConfessionRef.current?.id !== comment.confession_id) return;
          void fetchProfiles([comment.user_id]).then((profiles) => {
            if (activeConfessionRef.current?.id !== comment.confession_id) return;
            setComments((current) =>
              current.some((item) => item.id === comment.id)
                ? current
                : [...current, { ...comment, author: profiles[comment.user_id] }],
            );
          });
          return;
        }

        if (payload.eventType === 'UPDATE') {
          if (activeConfessionRef.current?.id === comment.confession_id) {
            setComments((current) =>
              current.map((item) =>
                item.id === comment.id
                  ? { ...item, comment_text: comment.comment_text, parent_id: comment.parent_id }
                  : item,
              ),
            );
          }
          return;
        }

        if (comment.user_id === user.id) return;
        updateConfessionCounts(comment.confession_id, 0, -1);
        if (activeConfessionRef.current?.id === comment.confession_id) {
          setComments((current) => current.filter((item) => item.id !== comment.id));
        }
      })
      .subscribe((status, error) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[confessions] Realtime subscription failed:', error?.message ?? status);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [syncLikeNames, universityFilter, updateConfessionCounts, user]);

  useEffect(() => {
    if (!highlightedConfessionId) return;
    const index = confessionFeedItems.findIndex(
      (item) => item.type === 'confession' && item.confession.id === highlightedConfessionId,
    );
    if (index < 0) return;
    const frame = requestAnimationFrame(() => {
      feedRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.1 });
    });
    return () => cancelAnimationFrame(frame);
  }, [confessionFeedItems, highlightedConfessionId]);

  useEffect(() => {
    void loadWeeklyQuota();
  }, [loadWeeklyQuota]);

  const submitConfession = async () => {
    const body = content.trim();
    if (!postUniversity) {
      Alert.alert('Üniversite seç', 'İtiraf paylaşmak için önce üniversiteni seç.');
      return;
    }
    if (body.length < 5) {
      Alert.alert('İtiraf çok kısa', 'İtirafın en az 5 karakter olmalı.');
      return;
    }
    if (submitting || !user) return;

    setSubmitting(true);
    try {
      const imageUrl = selectedImage
        ? (await uploadMedia(selectedImage, { kind: 'image', folder: 'confessions' })).path
        : null;
      const { data: confessionId, error } = await supabase.rpc('create_confession', {
        p_university_id: postUniversity,
        p_content: body,
        p_image_url: imageUrl,
      });
      if (error) {
        if (error.message.includes('weekly_quota_exceeded')) {
          setWeeklyCount(2);
          Alert.alert('Haftalık hak doldu', 'Bu hafta için itiraf haklarını doldurdun (2/2).');
        } else {
          Alert.alert('İtiraf paylaşılamadı', error.message);
        }
        return;
      }

      const optimisticConfession: ConfessionRow = {
        id: confessionId,
        university_id: postUniversity,
        content: body,
        image_url: imageUrl,
        created_at: new Date().toISOString(),
        like_count: 0,
        comment_count: 0,
      };
      if (!universityFilter || universityFilter === postUniversity) {
        setConfessions((current) => current.some((item) => item.id === confessionId)
          ? current
          : [optimisticConfession, ...current]);
        setLikeNames((current) => ({ ...current, [confessionId]: [] }));
        void supabase
          .from('confessions_feed')
          .select('*')
          .eq('id', confessionId)
          .maybeSingle()
          .then(({ data, error: feedError }) => {
            if (feedError) {
              console.error('[confessions] Failed to reconcile new confession:', feedError.message);
              return;
            }
            if (data) {
              setConfessions((current) => current.map((item) =>
                item.id === confessionId ? data as ConfessionRow : item,
              ));
            }
          });
      }
      setContent('');
      setSelectedImage(null);
      setWeeklyCount((count) => Math.min(count + 1, 2));
      await loadWeeklyQuota();
    } catch (error) {
      Alert.alert('İtiraf paylaşılamadı', error instanceof Error ? error.message : 'Beklenmeyen bir hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  const chooseImage = async () => {
    try {
      const image = await pickImage();
      if (image) setSelectedImage(image.uri);
    } catch (error) {
      Alert.alert('Fotoğraf seçilemedi', error instanceof Error ? error.message : 'Galerin açılamadı.');
    }
  };

  const shareConfession = async (confession: ConfessionRow) => {
    const message = [confession.content, confession.image_url].filter(Boolean).join('\n\n');
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
        if (navigator.share) {
          await navigator.share({ text: message });
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(message);
          Alert.alert('Kopyalandı', 'İtiraf ve görsel bağlantısı panoya kopyalandı.');
        } else {
          throw new Error('Bu tarayıcı paylaşım veya pano erişimini desteklemiyor.');
        }
        return;
      }
      await Share.share({ message });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      Alert.alert('İtiraf paylaşılamadı', error instanceof Error ? error.message : 'Paylaşım açılamadı.');
    }
  };

  const toggleLike = async (confession: ConfessionRow) => {
    if (!user || pendingLikeIds.current.has(confession.id)) return;
    pendingLikeIds.current.add(confession.id);
    const liked = likedIds.has(confession.id);
    setLikedIds((current) => {
      const next = new Set(current);
      if (liked) next.delete(confession.id);
      else next.add(confession.id);
      return next;
    });
    updateConfessionCounts(confession.id, liked ? -1 : 1, 0);

    try {
      const result = liked
        ? await supabase
            .from('confession_likes')
            .delete()
            .eq('confession_id', confession.id)
            .eq('user_id', user.id)
        : await supabase.from('confession_likes').insert({ confession_id: confession.id, user_id: user.id });
      if (result.error) throw new Error(result.error.message);
      void syncLikeNames(confession.id);
    } catch (error) {
      setLikedIds((current) => {
        const next = new Set(current);
        if (liked) next.add(confession.id);
        else next.delete(confession.id);
        return next;
      });
      updateConfessionCounts(confession.id, liked ? 1 : -1, 0);
      Alert.alert('Beğeni kaydedilemedi', error instanceof Error ? error.message : 'Beğeni kaydedilemedi.');
    } finally {
      pendingLikeIds.current.delete(confession.id);
    }
  };

  const openComments = async (confession: ConfessionRow) => {
    activeConfessionRef.current = confession;
    setActiveConfession(confession);
    setComments([]);
    setCommentDraft('');
    setReplyingToCommentId(null);
    setCommentsLoading(true);
    const { data, error } = await supabase
      .from('confession_comments')
      .select('id, confession_id, user_id, parent_id, comment_text, created_at')
      .eq('confession_id', confession.id)
      .order('created_at', { ascending: true });
    setCommentsLoading(false);
    if (error) {
      Alert.alert('Yorumlar yüklenemedi', error.message);
      return;
    }
    const rows = (data ?? []) as ConfessionComment[];
    const profiles = await fetchProfiles(rows.map((comment) => comment.user_id));
    const loadedComments = rows.map((comment) => ({ ...comment, author: profiles[comment.user_id] }));
    setComments((current) => {
      const loadedIds = new Set(loadedComments.map((comment) => comment.id));
      const realtimeComments = current.filter((comment) =>
        comment.confession_id === confession.id && !comment.id.startsWith('optimistic-') && !loadedIds.has(comment.id),
      );
      return [...loadedComments, ...realtimeComments].sort(
        (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
      );
    });
  };

  const addComment = async () => {
    const body = commentDraft.trim();
    if (!activeConfession || !user || !body || commentSending) return;
    const parentId = replyingToComment?.id ?? null;
    setCommentSending(true);
    const confessionId = activeConfession.id;
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticComment: ConfessionComment = {
      id: optimisticId,
      confession_id: confessionId,
      user_id: user.id,
      parent_id: parentId,
      comment_text: body,
      created_at: new Date().toISOString(),
    };
    setComments((current) => [...current, optimisticComment]);
    setCommentDraft('');
    setReplyingToCommentId(null);
    updateConfessionCounts(confessionId, 0, 1);
    try {
      const { data, error } = await supabase
        .from('confession_comments')
        .insert({
          confession_id: confessionId,
          user_id: user.id,
          parent_id: parentId,
          comment_text: body,
        })
        .select('id, confession_id, user_id, parent_id, comment_text, created_at')
        .single();
      if (error || !data) throw new Error(error?.message ?? 'Yorum kaydedilemedi.');
      const comment = data as ConfessionComment;
      const profiles = await fetchProfiles([comment.user_id]);
      setComments((current) => current.map((item) =>
        item.id === optimisticId ? { ...comment, author: profiles[comment.user_id] } : item,
      ));
    } catch (error) {
      setComments((current) => current.filter((comment) => comment.id !== optimisticId));
      updateConfessionCounts(confessionId, 0, -1);
      setCommentDraft(body);
      setReplyingToCommentId(parentId);
      Alert.alert('Yorum gönderilemedi', error instanceof Error ? error.message : 'Yorum kaydedilemedi.');
    } finally {
      setCommentSending(false);
    }
  };

  const deleteComment = (comment: ConfessionComment) => {
    if (!user || !activeConfession) return;
    Alert.alert('Yorumu sil', 'Bu yorumu silmek istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          const confessionId = activeConfession.id;
          const removedIds = new Set([comment.id]);
          let foundChild = true;
          while (foundChild) {
            foundChild = false;
            for (const item of comments) {
              if (item.parent_id && removedIds.has(item.parent_id) && !removedIds.has(item.id)) {
                removedIds.add(item.id);
                foundChild = true;
              }
            }
          }
          setComments((current) => current.filter((item) => !removedIds.has(item.id)));
          if (replyingToCommentId && removedIds.has(replyingToCommentId)) setReplyingToCommentId(null);
          updateConfessionCounts(confessionId, 0, -removedIds.size);
          void supabase
            .from('confession_comments')
            .delete()
            .eq('id', comment.id)
            .eq('user_id', user.id)
            .then(({ error }) => {
              if (!error) return;
              Alert.alert('Yorum silinemedi', error.message);
              void openComments(activeConfession);
              void loadFeed();
            });
        },
      },
    ]);
  };

  const renderComment = (comment: ConfessionComment): ReactNode => {
    const replies = commentsByParent.get(comment.id) ?? [];
    const authorName = comment.author?.username || comment.author?.full_name || 'Kullanıcı';
    return (
      <View key={comment.id} className="mb-3">
        <View className="flex-row items-start rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">
            <Text className="text-xs font-bold text-primary-700 dark:text-primary-300">
              {authorName.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View className="ml-2.5 flex-1">
            <Text className="text-xs font-bold text-gray-800 dark:text-gray-200">{authorName}</Text>
            <Text className="mt-1 text-sm leading-5 text-gray-800 dark:text-gray-100">{comment.comment_text}</Text>
            <View className="mt-1.5 flex-row items-center">
              <Text className="text-[11px] text-gray-400">{timeAgo(comment.created_at)}</Text>
              <Pressable
                onPress={() => {
                  setReplyingToCommentId(comment.id);
                  requestAnimationFrame(() => commentInputRef.current?.focus());
                }}
                accessibilityRole="button"
                accessibilityLabel={`${authorName} adlı kişiye cevapla`}
                className="ml-3"
              >
                <Text className="text-xs font-semibold text-primary-600">Cevapla</Text>
              </Pressable>
            </View>
          </View>
          {comment.user_id === user?.id ? (
            <Pressable
              onPress={() => setSelectedComment(comment)}
              accessibilityRole="button"
              accessibilityLabel="Yorum seçenekleri"
              hitSlop={8}
            >
              <MoreVertical size={18} color="#9ca3af" />
            </Pressable>
          ) : null}
        </View>
        {replies.length ? (
          <View className="ml-4 border-l-2 border-gray-200 pl-3 dark:border-gray-700">
            {replies.map(renderComment)}
          </View>
        ) : null}
      </View>
    );
  };

  const commentsByParent = new Map<string, ConfessionComment[]>();
  for (const comment of comments) {
    if (!comment.parent_id) continue;
    const siblings = commentsByParent.get(comment.parent_id) ?? [];
    siblings.push(comment);
    commentsByParent.set(comment.parent_id, siblings);
  }
  const rootComments = comments.filter((comment) => !comment.parent_id);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-row items-center px-5 pb-3 pt-2">
        <VenetianMask size={25} color="#0ea5e9" />
        <Text className="ml-2 text-2xl font-extrabold text-gray-900 dark:text-white">İtiraf</Text>
      </View>

      <Pressable
        onPress={() => {
          setPickerTarget('filter');
          setUniversityPickerOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Üniversite filtresi: ${universityFilter ?? 'Tüm Üniversiteler'}`}
        className="mx-4 mb-3 flex-row items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800"
      >
        <View>
          <Text className="text-[11px] text-gray-500 dark:text-gray-400">Üniversite filtresi</Text>
          <Text className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">{universityFilter ?? 'Tüm Üniversiteler'}</Text>
        </View>
        <Text className="text-primary-600">Filtrele</Text>
      </Pressable>

      <View className="mx-4 mb-3 flex-row items-center justify-between rounded-xl bg-primary-50 px-4 py-2.5 dark:bg-gray-800">
        <Text className="text-sm font-semibold text-gray-700 dark:text-gray-200">Haftalık itiraf hakkı</Text>
        <Text className={`text-sm font-extrabold ${weeklyCount >= 2 ? 'text-red-500' : 'text-primary-600'}`}>
          {weeklyCount}/2
        </Text>
      </View>

      <View className="mx-4 mb-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
        <Text className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">İtirafını paylaş</Text>
        <Pressable
          onPress={() => {
            setPickerTarget('post');
            setUniversityPickerOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={`İtirafın üniversitesi: ${postUniversity ?? 'Üniversite seç'}`}
          className="mb-2 flex-row items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900"
        >
          <Text className="text-sm text-gray-700 dark:text-gray-200">{postUniversity ?? 'Üniversite seç'}</Text>
          <Text className="text-primary-600">Seç</Text>
        </Pressable>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="İtirafını anonim olarak paylaş..."
          placeholderTextColor="#9ca3af"
          multiline
          maxLength={2000}
          accessibilityLabel="Anonim itiraf metni"
          className="min-h-20 text-sm leading-5 text-gray-900 dark:text-white"
        />
        {selectedImage ? (
          <View className="mt-2 self-start">
            <Image source={{ uri: selectedImage }} className="h-28 w-28 rounded-xl" />
            <Pressable
              onPress={() => setSelectedImage(null)}
              accessibilityRole="button"
              accessibilityLabel="Seçilen fotoğrafı kaldır"
              className="absolute -right-2 -top-2 h-7 w-7 items-center justify-center rounded-full bg-gray-900/80"
            >
              <X size={16} color="#fff" />
            </Pressable>
          </View>
        ) : null}
        <View className="mt-2 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Text className="mr-3 text-xs text-gray-400">{content.length}/2000</Text>
            <Pressable
              onPress={() => void chooseImage()}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="İtirafa fotoğraf ekle"
              className="h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-gray-700"
            >
              <ImagePlus size={19} color="#0ea5e9" />
            </Pressable>
          </View>
          <Pressable
            onPress={() => void submitConfession()}
            disabled={submitting || content.trim().length < 5}
            accessibilityRole="button"
            className={`flex-row items-center rounded-full bg-primary-500 px-4 py-2 ${submitting || content.trim().length < 5 ? 'opacity-50' : ''}`}
          >
            {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Send size={15} color="#fff" />}
            <Text className="ml-2 text-sm font-semibold text-white">{submitting ? 'Paylaşılıyor' : 'Anonim paylaş'}</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm text-gray-500 dark:text-gray-400">İtiraflar yükleniyor...</Text>
        </View>
      ) : (
        <FlatList
          ref={feedRef}
          data={confessionFeedItems}
          keyExtractor={(item) => item.type === 'ad' ? item.id : item.confession.id}
          onScrollToIndexFailed={({ index }) => {
            feedRef.current?.scrollToOffset({ offset: index * 340, animated: true });
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await loadFeed();
                setRefreshing(false);
              }}
            />
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 }}
          ListEmptyComponent={
            loadError ? (
              <EmptyState title="İtiraflar yüklenemedi" hint={loadError} />
            ) : (
              <EmptyState
                title="Henüz itiraf yok"
                hint={universityFilter ? 'Bu üniversite için ilk anonim itirafı sen paylaş.' : 'Tüm üniversitelerin itirafları burada görünür.'}
              />
            )
          }
          renderItem={({ item }) => item.type === 'ad' ? (
            <NativeAdCard />
          ) : (
            <View
              className={`mb-3 rounded-2xl bg-white p-4 dark:bg-gray-800 ${
                item.confession.id === highlightedConfessionId
                  ? 'border-2 border-primary-400'
                  : 'border border-gray-100 dark:border-gray-800'
              }`}
            >
              <View className="mb-3 flex-row items-center">
                <View className="h-9 w-9 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">
                  <VenetianMask size={19} color="#0ea5e9" />
                </View>
                <View className="ml-2.5 flex-1">
                  <Text className="text-sm font-bold text-gray-900 dark:text-white">Anonim</Text>
                  <Text className="text-xs text-gray-500 dark:text-gray-400">{timeAgo(item.confession.created_at)}</Text>
                </View>
              </View>
              <Text className="text-[15px] leading-6 text-gray-800 dark:text-gray-100">{item.confession.content}</Text>
              {item.confession.image_url ? (
                <Pressable
                  onPress={() => setViewingImage(item.confession.image_url)}
                  accessibilityRole="button"
                  accessibilityLabel="İtiraf fotoğrafını büyüt"
                  className="mt-3 overflow-hidden rounded-xl"
                >
                  <StorageImage uri={item.confession.image_url} resizeMode="cover" className="h-64 w-full" />
                </Pressable>
              ) : null}
              <View className="mt-4 flex-row border-t border-gray-100 pt-3 dark:border-gray-700">
                <Pressable
                  onPress={() => void toggleLike(item.confession)}
                  accessibilityRole="button"
                  accessibilityLabel={likedIds.has(item.confession.id) ? 'Beğeniyi kaldır' : 'İtirafı beğen'}
                  className="mr-6 flex-row items-center"
                >
                  <Heart size={18} color={likedIds.has(item.confession.id) ? '#ef4444' : '#9ca3af'} fill={likedIds.has(item.confession.id) ? '#ef4444' : 'transparent'} />
                  <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-300">{item.confession.like_count}</Text>
                </Pressable>
                <Pressable
                  onPress={() => void openComments(item.confession)}
                  accessibilityRole="button"
                  accessibilityLabel="Yorumları gör"
                  className="flex-row items-center"
                >
                  <MessageCircle size={18} color="#9ca3af" />
                  <Text className="ml-1.5 text-sm text-gray-600 dark:text-gray-300">{item.confession.comment_count}</Text>
                </Pressable>
                <Pressable
                  onPress={() => void shareConfession(item.confession)}
                  accessibilityRole="button"
                  accessibilityLabel="İtirafı paylaş"
                  className="ml-auto flex-row items-center"
                >
                  <Share2 size={18} color="#0ea5e9" />
                  <Text className="ml-1.5 text-sm text-primary-600">Paylaş</Text>
                </Pressable>
              </View>
              {likeNames[item.confession.id]?.length ? (
                <Text className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {likeNames[item.confession.id].slice(0, 3).join(', ')}
                  {likeNames[item.confession.id].length > 3 ? ` ve ${likeNames[item.confession.id].length - 3} kişi` : ''} beğendi
                </Text>
              ) : null}
            </View>
          )}
        />
      )}

      <UniversityPickerModal
        visible={universityPickerOpen}
        selectedUniversity={pickerTarget === 'post' ? postUniversity : universityFilter}
        onSelect={(selected) => {
          if (pickerTarget === 'post') setPostUniversity(selected);
          else setUniversityFilter(selected);
        }}
        onClose={() => {
          setUniversityPickerOpen(false);
          setPickerTarget(null);
        }}
      />

      <ImageViewerModal
        visible={viewingImage !== null}
        uri={viewingImage}
        onClose={() => setViewingImage(null)}
      />

      <Sheet
        visible={activeConfession !== null}
        onClose={() => {
          activeConfessionRef.current = null;
          setActiveConfession(null);
        }}
        title="Yorumlar"
        tall
      >
        <View className="flex-1">
          {commentsLoading ? (
            <Text className="mt-6 text-center text-sm text-gray-500">Yorumlar yükleniyor...</Text>
          ) : (
            <FlatList
              data={rootComments}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={<EmptyState title="Henüz yorum yok" hint="İlk yorumu sen yaz." />}
              renderItem={({ item }) => renderComment(item)}
            />
          )}
          {replyingToComment ? (
            <View className="mb-2 flex-row items-center rounded-xl bg-primary-50 px-3 py-2 dark:bg-gray-800">
              <Text numberOfLines={1} className="flex-1 text-xs text-primary-700 dark:text-primary-300">
                @{replyingToComment.author?.username || 'kullanıcı'} adlı kişiye yanıt veriyorsun
              </Text>
              <Pressable
                onPress={() => setReplyingToCommentId(null)}
                accessibilityRole="button"
                accessibilityLabel="Yanıtlamayı iptal et"
                hitSlop={8}
                className="ml-2 h-7 w-7 items-center justify-center"
              >
                <X size={15} color="#0ea5e9" />
              </Pressable>
            </View>
          ) : null}
          <View className="flex-row items-end border-t border-gray-100 pt-3 dark:border-gray-800">
            <TextInput
              ref={commentInputRef}
              value={commentDraft}
              onChangeText={setCommentDraft}
              placeholder="Anonim yorum yaz..."
              placeholderTextColor="#9ca3af"
              multiline
              maxLength={1000}
              accessibilityLabel="Anonim yorum yaz"
              className="mr-2 max-h-24 min-h-11 flex-1 rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-900 dark:bg-gray-800 dark:text-white"
            />
            <Pressable
              onPress={() => void addComment()}
              disabled={commentSending || !commentDraft.trim()}
              accessibilityRole="button"
              accessibilityLabel="Yorum gönder"
              className={`h-11 w-11 items-center justify-center rounded-full bg-primary-500 ${
                commentSending || !commentDraft.trim() ? 'opacity-50' : ''
              }`}
            >
              <Send size={17} color="#fff" />
            </Pressable>
          </View>
        </View>
        <ActionSheet
          visible={selectedComment !== null}
          onClose={() => setSelectedComment(null)}
          options={[
            {
              label: 'Yorumu Sil',
              icon: <MoreVertical size={20} color="#dc2626" />,
              destructive: true,
              onPress: () => {
                if (selectedComment) deleteComment(selectedComment);
              },
            },
          ]}
        />
      </Sheet>
    </SafeAreaView>
  );
}
