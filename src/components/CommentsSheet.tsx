import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Check, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react-native';
import { router } from 'expo-router';

import { Avatar, EmptyState, Sheet } from '@/components/ui';
import { MentionText } from '@/components/MentionText';
import { useAuth } from '@/context/AuthContext';
import { timeAgo } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { fetchProfiles } from '@/services/profiles';
import { searchMentionCandidates, type MentionCandidate } from '@/services/mentions';
import type { CommentRow, Profile } from '@/types';

export function CommentsSheet({
  postId,
  onClose,
  onCountChange,
}: {
  postId: string | null;
  onClose: () => void;
  onCountChange: (postId: string, delta: number) => void;
}) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [postOwnerId, setPostOwnerId] = useState<string | null>(null);
  const [commentsDisabled, setCommentsDisabled] = useState(false);
  const [actionCommentId, setActionCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingCommentId, setSavingCommentId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<CommentRow | null>(null);
  const [mentionCandidates, setMentionCandidates] = useState<MentionCandidate[]>([]);

  const searchMentions = useCallback(async (value: string) => {
    const match = value.match(/(?:^|\s)@([a-zA-Z0-9._]{1,20})$/);
    if (!match) {
      setMentionCandidates([]);
      return;
    }
    try {
      setMentionCandidates(await searchMentionCandidates(match[1] ?? ''));
    } catch (error) {
      console.error('Yorum mention araması yapılamadı:', error);
      setMentionCandidates([]);
    }
  }, []);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const [{ data, error }, { data: post, error: postError }] = await Promise.all([
        supabase
          .from('comments')
          .select('*')
          .eq('post_id', id)
          .order('created_at', { ascending: true }),
        supabase.from('posts').select('author_id,comments_disabled').eq('id', id).maybeSingle(),
      ]);
      if (error) throw error;
      if (postError) throw postError;
      const rows = (data ?? []) as CommentRow[];
      setProfiles(await fetchProfiles(rows.map((r) => r.author_id)));
      setComments(rows);
      setPostOwnerId(post?.author_id ?? null);
      setCommentsDisabled(post?.comments_disabled ?? false);
    } catch (error) {
      Alert.alert('Yorumlar yüklenemedi', error instanceof Error ? error.message : 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (postId) {
      setText('');
      setActionCommentId(null);
      setEditingCommentId(null);
      setPostOwnerId(null);
      load(postId);
    }
  }, [postId, load]);

  const send = async () => {
    const normalizedText = text.trim();
    if (!postId || !user || !normalizedText) return;
    if (commentsDisabled) {
      Alert.alert('Yorumlar kapalı', 'Bu gönderi için yorumlar kapatıldı.');
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          author_id: user.id,
          body: normalizedText,
        })
        .select()
        .single();

      if (error) throw error;
      if (!data) {
        Alert.alert('Yorum gönderilemedi', 'Sunucudan yorum bilgisi alınamadı.');
        return;
      }

      await fetchProfiles([user.id]).then((p) => setProfiles((prev) => ({ ...prev, ...p })));
      setComments((c) => [...c, data as CommentRow]);
      setText('');
      setReplyTo(null);
      setMentionCandidates([]);
      onCountChange(postId, 1);
    } catch (error) {
      console.error('Yorum gönderilemedi:', error);
      Alert.alert('Yorum gönderilemedi', error instanceof Error ? error.message : 'Bir hata oluştu.');
    } finally {
      setSending(false);
    }
  };

  const canSubmitComment = !commentsDisabled && !!text.trim() && !sending;

  const startEditing = (comment: CommentRow) => {
    setActionCommentId(null);
    setEditingCommentId(comment.id);
    setEditText(comment.body);
  };

  const saveEdit = async (comment: CommentRow) => {
    const body = editText.trim();
    if (!body) {
      Alert.alert('Yorum boş olamaz', 'Yorumunu silmek istiyorsan silme seçeneğini kullan.');
      return;
    }
    if (body === comment.body) {
      setEditingCommentId(null);
      return;
    }

    setSavingCommentId(comment.id);
    const { data, error } = await supabase
      .from('comments')
      .update({ body, is_edited: true, updated_at: new Date().toISOString() })
      .eq('id', comment.id)
      .select('*')
      .single();
    setSavingCommentId(null);
    if (error || !data) {
      Alert.alert('Yorum güncellenemedi', error?.message ?? 'Bir hata oluştu.');
      return;
    }

    setComments((current) => current.map((item) => (item.id === comment.id ? (data as CommentRow) : item)));
    setEditingCommentId(null);
    setEditText('');
  };

  const confirmDelete = (comment: CommentRow) => {
    if (!postId) return;
    setActionCommentId(null);
    Alert.alert('Yorum silinsin mi?', 'Bu işlem geri alınamaz.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const { error } = await supabase.from('comments').delete().eq('id', comment.id);
            if (error) {
              Alert.alert('Yorum silinemedi', error.message);
              return;
            }
            const removedIds = new Set([comment.id]);
            let foundDescendant = true;
            while (foundDescendant) {
              foundDescendant = false;
              for (const item of comments) {
                if (item.parent_comment_id && removedIds.has(item.parent_comment_id) && !removedIds.has(item.id)) {
                  removedIds.add(item.id);
                  foundDescendant = true;
                }
              }
            }
            setComments((current) => current.filter((item) => !removedIds.has(item.id)));
            if (editingCommentId === comment.id) setEditingCommentId(null);
            onCountChange(postId, -removedIds.size);
          })();
        },
      },
    ]);
  };

  return (
    <Sheet visible={!!postId} onClose={onClose} title="Yorumlar" tall>
      <View className="flex-1">
        {loading ? (
          <ActivityIndicator className="mt-8" color="#0ea5e9" />
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(c) => c.id}
            ListEmptyComponent={<EmptyState title="Henüz yorum yok" hint="İlk yorumu sen yaz." />}
            renderItem={({ item }) => {
              const p = profiles[item.author_id];
              const isCommentOwner = item.author_id === user?.id;
              const isPostOwner = postOwnerId === user?.id;
              const canEdit = isCommentOwner;
              const canDelete = isCommentOwner || isPostOwner;
              const isEditing = editingCommentId === item.id;
              return (
                <Pressable
                  onLongPress={() => {
                    if (canEdit || canDelete) setActionCommentId(item.id);
                  }}
                  delayLongPress={350}
                  className="mb-4 flex-row"
                >
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: '/profile/[id]', params: { id: item.author_id } })
                    }
                    accessibilityRole="link"
                  >
                    <Avatar uri={p?.avatar_url} name={p?.full_name} size={34} />
                  </Pressable>
                  <View className="ml-3 flex-1">
                    {isEditing ? (
                      <>
                        <Text className="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
                          @{p?.username ?? 'kullanıcı'} yorumunu düzenle
                        </Text>
                        <TextInput
                          autoFocus
                          multiline
                          value={editText}
                          onChangeText={setEditText}
                          className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                        <View className="mt-2 flex-row justify-end gap-2">
                          <Pressable
                            onPress={() => setEditingCommentId(null)}
                            className="flex-row items-center rounded-full bg-gray-100 px-3 py-2 dark:bg-gray-800"
                          >
                            <X size={15} color="#6b7280" />
                            <Text className="ml-1 text-xs font-medium text-gray-700 dark:text-gray-200">Vazgeç</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => saveEdit(item)}
                            disabled={savingCommentId === item.id}
                            className="flex-row items-center rounded-full bg-primary-500 px-3 py-2"
                          >
                            {savingCommentId === item.id ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Check size={15} color="#fff" />
                            )}
                            <Text className="ml-1 text-xs font-semibold text-white">Kaydet</Text>
                          </Pressable>
                        </View>
                      </>
                    ) : (
                      <>
                        <Text className="text-sm text-gray-900 dark:text-white">
                          <Text
                            className="font-semibold"
                            onPress={() =>
                              router.push({ pathname: '/profile/[id]', params: { id: item.author_id } })
                            }
                          >
                            {p?.username ?? 'kullanıcı'}{' '}
                          </Text>
                          <MentionText>{item.body}</MentionText>
                        </Text>
                        <View className="mt-0.5 flex-row items-center">
                          <Text className="text-xs text-gray-500 dark:text-gray-400">
                            {timeAgo(item.created_at)}
                          </Text>
                          {item.is_edited ? (
                            <Text className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">(düzenlendi)</Text>
                          ) : null}
                        </View>
                        <Pressable
                          onPress={() => {
                            setReplyTo(item);
                            setText(`@${p?.username ?? ''} `);
                            setActionCommentId(null);
                          }}
                          className="mt-1 self-start"
                        >
                          <Text className="text-xs font-semibold text-gray-500 dark:text-gray-400">Yanıtla</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                  {!isEditing && (canEdit || canDelete) ? (
                    <Pressable
                      onPress={() => setActionCommentId(item.id)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel="Yorum seçenekleri"
                      className="ml-1 h-8 w-8 items-center justify-center rounded-full"
                    >
                      <MoreHorizontal size={19} color="#9ca3af" />
                    </Pressable>
                  ) : null}
                </Pressable>
              );
            }}
          />
        )}
        {actionCommentId ? (
          <View className="mb-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            {comments
              .filter((comment) => comment.id === actionCommentId)
              .map((comment) => {
                const isCommentOwner = comment.author_id === user?.id;
                const canDelete = isCommentOwner || postOwnerId === user?.id;
                return (
                  <View key={comment.id} className="flex-row gap-2">
                    {isCommentOwner ? (
                      <Pressable
                        onPress={() => startEditing(comment)}
                        className="flex-1 flex-row items-center justify-center rounded-xl bg-gray-50 py-3 dark:bg-gray-700"
                      >
                        <Pencil size={16} color="#0ea5e9" />
                        <Text className="ml-2 font-semibold text-gray-800 dark:text-gray-100">Yorumu düzenle</Text>
                      </Pressable>
                    ) : null}
                    {canDelete ? (
                      <Pressable
                        onPress={() => confirmDelete(comment)}
                        className="flex-1 flex-row items-center justify-center rounded-xl bg-red-50 py-3 dark:bg-red-950"
                      >
                        <Trash2 size={16} color="#dc2626" />
                        <Text className="ml-2 font-semibold text-red-600">Yorumu sil</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => setActionCommentId(null)}
                      accessibilityLabel="Menüyü kapat"
                      className="h-11 w-11 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700"
                    >
                      <X size={17} color="#6b7280" />
                    </Pressable>
                  </View>
                );
              })}
          </View>
        ) : null}
        {!commentsDisabled && mentionCandidates.length > 0 ? (
          <View className="mb-2 max-h-36 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            {mentionCandidates.map((candidate) => (
              <Pressable
                key={candidate.id}
                onPress={() => {
                  setText((current) =>
                    current.replace(/(?:^|\s)@[a-zA-Z0-9._]{1,20}$/, (match) => {
                      const prefix = match.startsWith(' ') ? ' ' : '';
                      return `${prefix}@${candidate.username} `;
                    }),
                  );
                  setMentionCandidates([]);
                }}
                className="border-b border-gray-100 px-4 py-2.5 dark:border-gray-700"
              >
                <Text className="font-semibold text-gray-900 dark:text-white">@{candidate.username}</Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400">{candidate.full_name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {!commentsDisabled && replyTo ? (
          <View className="mb-2 flex-row items-center justify-between rounded-xl bg-primary-50 px-3 py-2 dark:bg-gray-800">
            <Text className="text-xs text-primary-700 dark:text-primary-300">
              Yanıt: @{profiles[replyTo.author_id]?.username ?? 'kullanıcı'}
            </Text>
            <Pressable onPress={() => setReplyTo(null)}>
              <Text className="text-xs font-semibold text-gray-500">Kapat</Text>
            </Pressable>
          </View>
        ) : null}
        {commentsDisabled ? (
          <Text className="border-t border-gray-100 pt-3 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
            Bu gönderi için yorumlar kapatıldı
          </Text>
        ) : (
          <View className="flex-row items-center border-t border-gray-100 pt-3 dark:border-gray-800">
            <TextInput
              className="mr-2 flex-1 rounded-2xl bg-gray-100 px-4 py-3 text-base text-gray-900 dark:bg-gray-800 dark:text-white"
              placeholder="Yorum yaz..."
              placeholderTextColor="#9ca3af"
              value={text}
              onChangeText={(value) => {
                setText(value);
                void searchMentions(value);
              }}
            />
            <Pressable
              onPress={() => void send()}
              disabled={!canSubmitComment}
              className={`rounded-2xl bg-primary-500 px-4 py-3 ${!canSubmitComment ? 'opacity-50' : ''}`}
            >
              <Text className="font-semibold text-white">Gönder</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Sheet>
  );
}
