import { MoreVertical, Pencil, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, TextInput, View, type TextInputInstance } from 'react-native';
import { X } from 'lucide-react-native';

import { ActionSheet, Avatar, EmptyState, Sheet } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { timeAgo } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { fetchProfiles } from '@/services/profiles';
import type { Profile } from '@/types';

type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id: string | null;
  body: string;
  created_at: string;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return 'Bilinmeyen bir hata oluştu.';
}

function getErrorDetails(error: unknown) {
  if (!error || typeof error !== 'object') return { message: getErrorMessage(error) };
  const details = error as { code?: unknown; details?: unknown; hint?: unknown };
  return {
    message: getErrorMessage(error),
    code: details.code,
    details: details.details,
    hint: details.hint,
  };
}

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
  const inputRef = useRef<TextInputInstance | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedComment, setSelectedComment] = useState<CommentRow | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const replyingToComment = comments.find((comment) => comment.id === replyingToCommentId) ?? null;

  const commentsByParent = useMemo(() => {
    const grouped = new Map<string, CommentRow[]>();
    for (const comment of comments) {
      if (!comment.parent_comment_id) continue;
      const children = grouped.get(comment.parent_comment_id) ?? [];
      children.push(comment);
      grouped.set(comment.parent_comment_id, children);
    }
    return grouped;
  }, [comments]);
  const rootComments = useMemo(
    () => comments.filter((comment) => !comment.parent_comment_id),
    [comments],
  );

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('id, post_id, author_id, parent_comment_id, body, created_at')
        .eq('post_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as CommentRow[];
      setProfiles(await fetchProfiles(rows.map((row) => row.author_id)));
      setComments(rows);
    } catch (error) {
      console.warn('[comments] Failed to load comments:', getErrorDetails(error));
      Alert.alert('Yorumlar yüklenemedi', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (postId) {
      setText('');
      setSelectedComment(null);
      setEditingCommentId(null);
      setReplyingToCommentId(null);
      load(postId);
    }
  }, [postId, load]);

  const send = async () => {
    const body = text.trim();
    if (!postId || !user || !body || sending) return;
    setSending(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          author_id: user.id,
          body,
          parent_comment_id: replyingToComment?.id ?? null,
        })
        .select('id, post_id, author_id, parent_comment_id, body, created_at')
        .single();
      if (error) throw error;
      if (!data) throw new Error('Supabase yorum kaydı döndürmedi.');

      setComments((current) => [...current, data as CommentRow]);
      setText('');
      setReplyingToCommentId(null);
      onCountChange(postId, 1);
      void fetchProfiles([user.id])
        .then((authorProfiles) => setProfiles((previous) => ({ ...previous, ...authorProfiles })))
        .catch((profileError: unknown) => {
          console.warn('[comments] Failed to load comment author profile:', getErrorDetails(profileError));
        });
    } catch (error) {
      console.warn('[comments] Comment submission failed:', {
        ...getErrorDetails(error),
        postId,
        parentCommentId: replyingToComment?.id ?? null,
        authorId: user.id,
      });
      Alert.alert('Yorum gönderilemedi', getErrorMessage(error));
    } finally {
      setSending(false);
    }
  };

  const startReplying = (comment: CommentRow) => {
    setReplyingToCommentId(comment.id);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const startEditing = (comment: CommentRow) => {
    setEditingCommentId(comment.id);
    setEditText(comment.body);
  };

  const saveEdit = async (comment: CommentRow) => {
    const body = editText.trim();
    if (!user || !body || savingEdit) return;
    setSavingEdit(true);
    const { data, error } = await supabase
      .from('comments')
      .update({ body })
      .eq('id', comment.id)
      .eq('author_id', user.id)
      .select('id')
      .maybeSingle();
    setSavingEdit(false);
    if (error || !data) {
      Alert.alert('Yorum güncellenemedi', error?.message ?? 'Bu yorumu düzenleme iznin olmayabilir.');
      return;
    }
    setComments((current) => current.map((item) => (item.id === comment.id ? { ...item, body } : item)));
    setEditingCommentId(null);
    setEditText('');
  };

  const confirmDelete = (comment: CommentRow) => {
    if (!user || !postId) return;
    Alert.alert('Yorumu sil', 'Bu yorumu silmek istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          const removedComments = new Map<string, CommentRow>([[comment.id, comment]]);
          let foundChild = true;
          while (foundChild) {
            foundChild = false;
            for (const item of comments) {
              if (
                item.parent_comment_id &&
                removedComments.has(item.parent_comment_id) &&
                !removedComments.has(item.id)
              ) {
                removedComments.set(item.id, item);
                foundChild = true;
              }
            }
          }
          const removedIds = new Set(removedComments.keys());
          setComments((current) => current.filter((item) => !removedIds.has(item.id)));
          onCountChange(postId, -removedIds.size);
          void supabase
            .from('comments')
            .delete()
            .eq('id', comment.id)
            .eq('author_id', user.id)
            .select('id')
            .maybeSingle()
            .then(({ data, error }) => {
              if (error || !data) {
                setComments((current) => {
                  if (current.some((item) => item.id === comment.id)) return current;
                  return [...current, ...removedComments.values()].sort(
                    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
                  );
                });
                onCountChange(postId, removedIds.size);
                Alert.alert('Yorum silinemedi', error?.message ?? 'Bu yorumu silme iznin olmayabilir.');
              }
            });
        },
      },
    ]);
  };

  const renderComment = (comment: CommentRow): ReactNode => (
    <CommentItem
      key={comment.id}
      comment={comment}
      profiles={profiles}
      currentUserId={user?.id}
      editingCommentId={editingCommentId}
      editText={editText}
      savingEdit={savingEdit}
      setEditText={setEditText}
      setEditingCommentId={setEditingCommentId}
      saveEdit={(item) => void saveEdit(item)}
      setSelectedComment={setSelectedComment}
      onReply={startReplying}
    >
      {(commentsByParent.get(comment.id) ?? []).map(renderComment)}
    </CommentItem>
  );

  return (
    <Sheet visible={!!postId} onClose={onClose} title="Yorumlar" tall>
      <View className="flex-1">
        {loading ? (
          <ActivityIndicator className="mt-8" color="#0ea5e9" />
        ) : (
          <FlatList
          data={rootComments}
            keyExtractor={(c) => c.id}
            ListEmptyComponent={<EmptyState title="Henüz yorum yok" hint="İlk yorumu sen yaz." />}
          renderItem={({ item }) => renderComment(item)}
          />
        )}
        {replyingToComment ? (
          <View className="mb-2 flex-row items-center rounded-xl bg-primary-50 px-3 py-2 dark:bg-gray-800">
          <Text numberOfLines={1} className="flex-1 text-xs text-primary-700 dark:text-primary-300">
            @{profiles[replyingToComment.author_id]?.username ?? 'kullanıcı'} adlı kişiye yanıt veriyorsun
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
        <View className="flex-row items-center border-t border-gray-100 pt-3 dark:border-gray-800">
          <TextInput
          ref={inputRef}
          className="mr-2 flex-1 rounded-2xl bg-gray-100 px-4 py-3 text-base text-gray-900 dark:bg-gray-800 dark:text-white"
          placeholder={replyingToComment ? 'Yanıt yaz...' : 'Yorum yaz...'}
          placeholderTextColor="#9ca3af"
          value={text}
          onChangeText={setText}
          editable={!sending}
          />
          <Pressable
          onPress={() => void send()}
          disabled={sending || !text.trim()}
          accessibilityRole="button"
          accessibilityLabel={replyingToComment ? 'Yanıt gönder' : 'Yorum gönder'}
          className={`rounded-2xl bg-primary-500 px-4 py-3 ${sending || !text.trim() ? 'opacity-50' : ''}`}
          >
          <Text className="font-semibold text-white">{sending ? 'Gönderiliyor...' : 'Gönder'}</Text>
          </Pressable>
        </View>
      </View>
      <ActionSheet
        visible={selectedComment !== null}
        onClose={() => setSelectedComment(null)}
        options={[
          {
          label: 'Yorumu Düzenle',
          icon: <Pencil size={20} color="#0ea5e9" />,
          onPress: () => {
            if (selectedComment) startEditing(selectedComment);
          },
          },
          {
          label: 'Yorumu Sil',
          icon: <Trash2 size={20} color="#dc2626" />,
          destructive: true,
          onPress: () => {
            if (selectedComment) confirmDelete(selectedComment);
          },
          },
        ]}
      />
    </Sheet>
  );
}

function CommentItem({
  comment,
  profiles,
  currentUserId,
  editingCommentId,
  editText,
  savingEdit,
  setEditText,
  setEditingCommentId,
  saveEdit,
  setSelectedComment,
  onReply,
  children,
}: {
  comment: CommentRow;
  profiles: Record<string, Profile>;
  currentUserId: string | undefined;
  editingCommentId: string | null;
  editText: string;
  savingEdit: boolean;
  setEditText: (text: string) => void;
  setEditingCommentId: (id: string | null) => void;
  saveEdit: (comment: CommentRow) => void;
  setSelectedComment: (comment: CommentRow) => void;
  onReply: (comment: CommentRow) => void;
  children?: ReactNode;
}) {
  const profile = profiles[comment.author_id];
  const isEditing = editingCommentId === comment.id;
  const authorName = profile?.username ?? 'kullanıcı';
  return (
    <View className="mb-4">
      <View className="flex-row items-start">
        <Avatar uri={profile?.avatar_url} name={profile?.full_name} size={34} />
        <View className="ml-3 flex-1">
          {isEditing ? (
          <View>
            <Text className="mb-1 text-xs font-semibold text-gray-700 dark:text-gray-300">@{authorName}</Text>
            <TextInput
              autoFocus
              multiline
              value={editText}
              onChangeText={setEditText}
              editable={!savingEdit}
              accessibilityLabel="Yorumu düzenle"
              className="min-h-12 rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-900 dark:bg-gray-800 dark:text-white"
            />
            <View className="mt-2 flex-row justify-end">
              <Pressable
                onPress={() => {
                  setEditingCommentId(null);
                  setEditText('');
                }}
                disabled={savingEdit}
                className="mr-3 rounded-xl px-3 py-2"
              >
                <Text className="text-sm font-semibold text-gray-500">İptal</Text>
              </Pressable>
              <Pressable
                onPress={() => saveEdit(comment)}
                disabled={savingEdit || !editText.trim()}
                className={`rounded-xl bg-primary-500 px-3 py-2 ${!editText.trim() || savingEdit ? 'opacity-50' : ''}`}
              >
                <Text className="text-sm font-semibold text-white">{savingEdit ? 'Kaydediliyor...' : 'Kaydet'}</Text>
              </Pressable>
            </View>
          </View>
          ) : (
          <Text className="text-sm text-gray-900 dark:text-white">
            <Text className="font-semibold">{authorName} </Text>
            {comment.body}
          </Text>
          )}
          <View className="mt-1 flex-row items-center">
          <Text className="text-xs text-gray-500 dark:text-gray-400">{timeAgo(comment.created_at)}</Text>
          <Pressable
            onPress={() => onReply(comment)}
            accessibilityRole="button"
            accessibilityLabel={`@${authorName} adlı kişiye cevapla`}
            className="ml-3"
          >
            <Text className="text-xs font-semibold text-primary-600">Cevapla</Text>
          </Pressable>
          </View>
        </View>
        {comment.author_id === currentUserId && !isEditing ? (
          <Pressable
          onPress={() => setSelectedComment(comment)}
          accessibilityRole="button"
          accessibilityLabel="Yorum seçenekleri"
          hitSlop={8}
          className="ml-2 h-8 w-8 items-center justify-center rounded-full"
          >
          <MoreVertical size={18} color="#9ca3af" />
          </Pressable>
        ) : null}
      </View>
      {children ? <View className="ml-4 border-l-2 border-gray-200 pl-3 dark:border-gray-700">{children}</View> : null}
    </View>
  );
}
