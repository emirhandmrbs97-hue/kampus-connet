import { router, useLocalSearchParams } from 'expo-router';
import { Clock3, Feather, Heart, MessageCircle, Send, Share2, Sparkles, UserRound } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AcademicSelectSheet } from '@/components/AcademicSelectSheet';
import { Avatar, Button, EmptyState, Sheet } from '@/components/ui';
import { TURKISH_UNIVERSITY_NAMES } from '@/constants/academicData';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/lib/supabase';
import { fetchProfiles } from '@/services/profiles';
import type { Profile } from '@/types';

type Confession = {
  id: string;
  university_id: string;
  content: string;
  created_at: string;
  weekly_quota_tracker: number;
};

type ConfessionComment = {
  id: string;
  confession_id: string;
  user_id: string;
  comment_text: string;
  created_at: string;
};

export default function ConfessionsScreen() {
  const { confessionId } = useLocalSearchParams<{ confessionId?: string }>();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedConfessions, setLikedConfessions] = useState<Record<string, boolean>>({});
  const [likingConfessions, setLikingConfessions] = useState<Record<string, boolean>>({});
  const [filterUniversity, setFilterUniversity] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'filter' | 'post'>('filter');
  const [composeOpen, setComposeOpen] = useState(false);
  const [postUniversity, setPostUniversity] = useState('');
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeConfession, setActiveConfession] = useState<Confession | null>(null);
  const [comments, setComments] = useState<ConfessionComment[]>([]);
  const [commentProfiles, setCommentProfiles] = useState<Record<string, Profile>>({});
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const openedConfessionId = useRef<string | null>(null);

  const loadConfessions = useCallback(async () => {
    try {
      let query = supabase
        .from('confessions')
        .select('id,university_id,content,created_at,weekly_quota_tracker')
        .order('created_at', { ascending: false })
        .limit(100);
      if (filterUniversity) query = query.eq('university_id', filterUniversity);
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as Confession[];
      setConfessions(rows);

      if (!rows.length) {
        setCommentCounts({});
        setLikeCounts({});
        setLikedConfessions({});
        return;
      }
      const confessionIds = rows.map((row) => row.id);
      const [commentsResult, likesResult] = await Promise.all([
        supabase.from('confession_comments').select('confession_id').in('confession_id', confessionIds),
        supabase.from('confession_likes').select('confession_id,user_id').in('confession_id', confessionIds),
      ]);
      const { data: commentRows, error: commentsError } = commentsResult;
      if (commentsError) throw commentsError;
      const counts: Record<string, number> = {};
      for (const comment of commentRows ?? []) {
        counts[comment.confession_id] = (counts[comment.confession_id] ?? 0) + 1;
      }
      setCommentCounts(counts);
      if (likesResult.error) throw likesResult.error;
      const likes: Record<string, number> = {};
      const ownLikes: Record<string, boolean> = {};
      for (const like of likesResult.data ?? []) {
        likes[like.confession_id] = (likes[like.confession_id] ?? 0) + 1;
        if (like.user_id === user?.id) ownLikes[like.confession_id] = true;
      }
      setLikeCounts(likes);
      setLikedConfessions(ownLikes);
    } catch (error) {
      console.error('İtiraflar yüklenemedi:', error);
      Alert.alert('İtiraflar yüklenemedi', error instanceof Error ? error.message : 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, [filterUniversity, user]);

  useEffect(() => {
    void loadConfessions();
  }, [loadConfessions]);

  const refresh = async () => {
    setRefreshing(true);
    await loadConfessions();
    setRefreshing(false);
  };

  const openComposer = () => {
    setPostUniversity(filterUniversity);
    setContent('');
    setComposeOpen(true);
  };

  const openUniversityPicker = (target: 'filter' | 'post') => {
    setPickerTarget(target);
    setPickerOpen(true);
  };

  const postConfession = async () => {
    const text = content.trim();
    if (!user) {
      Alert.alert('Giriş gerekli', 'İtiraf paylaşmak için hesabınıza giriş yapın.');
      return;
    }
    if (!postUniversity) {
      Alert.alert('Üniversite seçin', 'İtirafınızı hangi üniversite akışında paylaşacağınızı seçin.');
      return;
    }
    if (text.length < 5) {
      Alert.alert('İtiraf çok kısa', 'En az 5 karakter yazın.');
      return;
    }

    setPosting(true);
    try {
      const { error } = await supabase.rpc('create_confession', {
        p_university_id: postUniversity,
        p_content: text,
      });
      if (error) {
        if (error.message.includes('weekly_quota_exceeded')) {
          Alert.alert('Haftalık itiraf hakkınız doldu', '7 gün içinde en fazla 2 itiraf paylaşabilirsiniz.');
          return;
        }
        throw error;
      }
      setComposeOpen(false);
      setContent('');
      await loadConfessions();
    } catch (error) {
      console.error('İtiraf paylaşılamadı:', error);
      Alert.alert('İtiraf paylaşılamadı', error instanceof Error ? error.message : 'Bir hata oluştu.');
    } finally {
      setPosting(false);
    }
  };

  const openComments = useCallback(async (confession: Confession) => {
    await Promise.resolve();
    setActiveConfession(confession);
    setCommentText('');
    setCommentsLoading(true);
    try {
      const { data, error } = await supabase
        .from('confession_comments')
        .select('id,confession_id,user_id,comment_text,created_at')
        .eq('confession_id', confession.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as ConfessionComment[];
      setComments(rows);
      setCommentProfiles(await fetchProfiles(rows.map((row) => row.user_id)));
    } catch (error) {
      console.error('İtiraf yorumları yüklenemedi:', error);
      Alert.alert('Yorumlar yüklenemedi', error instanceof Error ? error.message : 'Bir hata oluştu.');
      setActiveConfession(null);
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!confessionId || openedConfessionId.current === confessionId) return;
    const confession = confessions.find((item) => item.id === confessionId);
    if (confession) {
      openedConfessionId.current = confessionId;
      void Promise.resolve().then(() => openComments(confession));
      return;
    }
    if (loading) return;
    let active = true;
    void supabase
      .from('confessions')
      .select('id,university_id,content,created_at,weekly_quota_tracker')
      .eq('id', confessionId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Bildirime bağlı itiraf yüklenemedi:', error);
          Alert.alert('İtiraf açılamadı', error.message);
          return;
        }
        if (data) {
          openedConfessionId.current = confessionId;
          void openComments(data as Confession);
        }
      });
    return () => {
      active = false;
    };
  }, [confessionId, confessions, loading, openComments]);

  const sendComment = async () => {
    const text = commentText.trim();
    if (!user || !activeConfession || !text) return;
    setSendingComment(true);
    try {
      const { data, error } = await supabase
        .from('confession_comments')
        .insert({ confession_id: activeConfession.id, user_id: user.id, comment_text: text })
        .select('id,confession_id,user_id,comment_text,created_at')
        .single();
      if (error) throw error;
      const row = data as ConfessionComment;
      setComments((current) => [...current, row]);
      setCommentText('');
      setCommentCounts((current) => ({
        ...current,
        [activeConfession.id]: (current[activeConfession.id] ?? 0) + 1,
      }));
      if (!commentProfiles[user.id]) {
        const profiles = await fetchProfiles([user.id]);
        setCommentProfiles((current) => ({ ...current, ...profiles }));
      }
    } catch (error) {
      console.error('Yorum gönderilemedi:', error);
      Alert.alert('Yorum gönderilemedi', error instanceof Error ? error.message : 'Bir hata oluştu.');
    } finally {
      setSendingComment(false);
    }
  };

  const toggleConfessionLike = async (confession: Confession) => {
    if (!user) {
      Alert.alert('Giriş gerekli', 'İtirafı beğenmek için hesabına giriş yap.');
      return;
    }
    if (likingConfessions[confession.id]) return;

    const wasLiked = likedConfessions[confession.id] ?? false;
    setLikingConfessions((current) => ({ ...current, [confession.id]: true }));
    setLikedConfessions((current) => ({ ...current, [confession.id]: !wasLiked }));
    setLikeCounts((current) => ({
      ...current,
      [confession.id]: Math.max(0, (current[confession.id] ?? 0) + (wasLiked ? -1 : 1)),
    }));

    try {
      const result = wasLiked
        ? await supabase
            .from('confession_likes')
            .delete()
            .eq('confession_id', confession.id)
            .eq('user_id', user.id)
        : await supabase
            .from('confession_likes')
            .insert({ confession_id: confession.id, user_id: user.id });
      if (result.error) throw result.error;
    } catch (error) {
      setLikedConfessions((current) => ({ ...current, [confession.id]: wasLiked }));
      setLikeCounts((current) => ({
        ...current,
        [confession.id]: Math.max(0, (current[confession.id] ?? 0) + (wasLiked ? 1 : -1)),
      }));
      console.error('İtiraf beğenisi güncellenemedi:', error);
      Alert.alert('Beğeni kaydedilemedi', error instanceof Error ? error.message : 'Bir hata oluştu.');
    } finally {
      setLikingConfessions((current) => ({ ...current, [confession.id]: false }));
    }
  };

  const shareConfession = async (confession: Confession) => {
    try {
      await Share.share({
        message: `${confession.content}\n\n— ${confession.university_id} öğrencilerinden anonim bir itiraf`,
        title: 'Anonim itiraf',
      });
    } catch (error) {
      Alert.alert('İtiraf paylaşılamadı', error instanceof Error ? error.message : 'Bir hata oluştu.');
    }
  };

  const closeComments = () => {
    setActiveConfession(null);
    setComments([]);
    setCommentProfiles({});
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-gray-50 dark:bg-[#11111b]">
      <View className="px-5 pt-3">
        <View className="mb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-xs font-bold uppercase tracking-[2px] text-fuchsia-600 dark:text-fuchsia-300">{t('confessEyebrow')}</Text>
            <Text className="mt-1 text-3xl font-black text-gray-950 dark:text-white">{t('confessions')}</Text>
          </View>
          <Pressable
            onPress={openComposer}
            className="flex-row items-center rounded-2xl bg-fuchsia-600 px-4 py-3 shadow-md shadow-fuchsia-200 dark:shadow-none"
          >
            <Feather size={17} color="#fff" />
            <Text className="ml-2 font-extrabold text-white">{t('confess')}</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => openUniversityPicker('filter')}
          className="mb-4 flex-row items-center justify-between rounded-3xl border border-fuchsia-100 bg-white px-4 py-3.5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl bg-fuchsia-50 dark:bg-fuchsia-950">
            <Sparkles size={19} color="#c026d3" />
          </View>
          <View className="flex-1">
            <Text className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{t('discoverFeed')}</Text>
            <Text numberOfLines={1} className="mt-0.5 font-extrabold text-gray-900 dark:text-white">
              {filterUniversity || t('allUniversities')}
            </Text>
          </View>
          <Text className="rounded-full bg-fuchsia-50 px-3 py-1.5 text-xs font-bold text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300">{t('change')}</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator className="mt-10" color="#c026d3" />
      ) : (
        <FlatList
          data={confessions}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}
          ListEmptyComponent={
            <EmptyState
              title={t('noConfessions')}
              hint={t('firstConfessionHint')}
              icon={<Feather size={32} color="#c026d3" />}
            />
          }
          renderItem={({ item }) => (
            <View className="mb-3.5 rounded-[28px] border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <View className="mb-3 flex-row items-center">
                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-fuchsia-50 dark:bg-fuchsia-950">
                  <UserRound size={20} color="#c026d3" strokeWidth={2.4} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="font-extrabold text-gray-900 dark:text-white">{t('anonymousStudent')}</Text>
                  <Text numberOfLines={1} className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{item.university_id}</Text>
                </View>
                <View className="flex-row items-center rounded-full bg-gray-50 px-2.5 py-1.5 dark:bg-gray-800">
                  <Clock3 size={13} color="#9ca3af" />
                  <Text className="ml-1 text-[10px] font-semibold text-gray-400">{new Date(item.created_at).toLocaleDateString('tr-TR')}</Text>
                </View>
              </View>
              <Text className="text-[15px] leading-6 text-gray-800 dark:text-gray-100">{item.content}</Text>
              <View className="mt-4 flex-row items-center border-t border-gray-100 pt-3 dark:border-gray-800">
                <Pressable
                  onPress={() => void toggleConfessionLike(item)}
                  disabled={likingConfessions[item.id]}
                  accessibilityRole="button"
                  accessibilityLabel={likedConfessions[item.id] ? 'İtirafı beğenmekten vazgeç' : 'İtirafı beğen'}
                  className={`mr-2 flex-row items-center rounded-full px-3 py-2 ${likedConfessions[item.id] ? 'bg-rose-50 dark:bg-rose-950' : 'bg-gray-50 dark:bg-gray-800'}`}
                >
                  <Heart
                    size={19}
                    color={likedConfessions[item.id] ? '#f43f5e' : '#6b7280'}
                    fill={likedConfessions[item.id] ? '#f43f5e' : 'transparent'}
                  />
                  <Text                   className="ml-1.5 text-xs font-bold text-gray-600 dark:text-gray-300">
                    {likeCounts[item.id] ?? 0}
                  </Text>
                </Pressable>
                <Pressable onPress={() => void openComments(item)} className="mr-2 flex-row items-center rounded-full bg-gray-50 px-3 py-2 dark:bg-gray-800">
                  <MessageCircle size={18} color="#8b5cf6" />
                  <Text className="ml-1.5 text-xs font-bold text-gray-600 dark:text-gray-300">{commentCounts[item.id] ?? 0}</Text>
                </Pressable>
                <Pressable onPress={() => void shareConfession(item)} className="ml-auto flex-row items-center rounded-full bg-gray-50 px-3 py-2 dark:bg-gray-800">
                  <Share2 size={16} color="#6b7280" />
                  <Text className="ml-1.5 text-xs font-bold text-gray-600 dark:text-gray-300">{t('share')}</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      <AcademicSelectSheet
        visible={pickerOpen}
        title={t('selectUniversity')}
        options={TURKISH_UNIVERSITY_NAMES}
        selectedValue={pickerTarget === 'filter' ? filterUniversity : postUniversity}
        onSelect={(value) => {
          if (pickerTarget === 'filter') {
            if (value !== filterUniversity) {
              setLoading(true);
              setFilterUniversity(value);
            }
          }
          else setPostUniversity(value);
        }}
        onClose={() => setPickerOpen(false)}
        allowClear
      />
      <Sheet visible={composeOpen} onClose={() => setComposeOpen(false)} title={t('anonymousShare')}>
        <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">{t('selectUniversity')}</Text>
        <Pressable
          onPress={() => openUniversityPicker('post')}
          className="mb-4 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 dark:border-gray-700 dark:bg-gray-900"
        >
          <Text className="text-gray-900 dark:text-white">{postUniversity || t('selectUniversity')}</Text>
        </Pressable>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder={t('confessionPlaceholder')}
          placeholderTextColor="#9ca3af"
          multiline
          maxLength={2000}
          textAlignVertical="top"
          className="mb-2 min-h-36 rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4 text-base text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-xs text-gray-500 dark:text-gray-400">{t('anonymousIdentity')}</Text>
          <Text className="text-xs text-gray-400">{content.length}/2000</Text>
        </View>
        <Text className="mb-3 text-xs text-gray-500 dark:text-gray-400">7 günde en fazla 2 itiraf paylaşabilirsin.</Text>
        <Button title={t('anonymousShare')} onPress={() => void postConfession()} loading={posting} className="bg-fuchsia-600" />
      </Sheet>
      <Sheet
        visible={activeConfession !== null}
        onClose={closeComments}
        title={t('confessionComments')}
        tall
      >
        {commentsLoading ? (
          <ActivityIndicator className="mt-8" color="#0ea5e9" />
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 12 }}
            ListEmptyComponent={<EmptyState title="Henüz yorum yok" hint="İlk yorumu sen yaz." />}
            renderItem={({ item }) => {
              const profile = commentProfiles[item.user_id];
              return (
                <View className="mb-4 flex-row items-start">
                  <Pressable onPress={() => router.push({ pathname: '/profile/[id]', params: { id: item.user_id } })}>
                    <Avatar uri={profile?.avatar_url} name={profile?.full_name ?? profile?.username} size={38} />
                  </Pressable>
                  <View className="ml-3 flex-1 rounded-2xl bg-gray-100 p-3 dark:bg-gray-800">
                    <Pressable onPress={() => router.push({ pathname: '/profile/[id]', params: { id: item.user_id } })}>
                      <Text className="mb-1 font-semibold text-primary-700 dark:text-primary-300">
                        @{profile?.username ?? 'kullanıcı'}
                      </Text>
                    </Pressable>
                    <Text className="text-gray-900 dark:text-gray-100">{item.comment_text}</Text>
                  </View>
                </View>
              );
            }}
            ListFooterComponent={
              <View className="mt-2 flex-row items-end gap-2">
                <TextInput
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder={t('writeComment')}
                  placeholderTextColor="#9ca3af"
                  multiline
                  className="max-h-28 min-h-12 flex-1 rounded-2xl bg-gray-100 px-4 py-3 text-gray-900 dark:bg-gray-800 dark:text-white"
                />
                <Pressable
                  onPress={() => void sendComment()}
                  disabled={!commentText.trim() || sendingComment}
                  className="h-12 w-12 items-center justify-center rounded-full bg-primary-500 disabled:opacity-50"
                >
                  {sendingComment ? <ActivityIndicator color="#fff" /> : <Send size={18} color="#fff" />}
                </Pressable>
              </View>
            }
          />
        )}
      </Sheet>
    </SafeAreaView>
  );
}
