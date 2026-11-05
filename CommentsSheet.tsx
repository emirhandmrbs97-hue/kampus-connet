import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';

import { Avatar, EmptyState, Sheet } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { timeAgo } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { fetchProfiles } from '@/services/profiles';
import type { Profile } from '@/types';

type CommentRow = { id: string; post_id: string; author_id: string; body: string; created_at: string };

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

  const load = useCallback(async (id: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', id)
      .order('created_at', { ascending: true });
    const rows = (data ?? []) as CommentRow[];
    setProfiles(await fetchProfiles(rows.map((r) => r.author_id)));
    setComments(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (postId) {
      setText('');
      load(postId);
    }
  }, [postId, load]);

  const send = async () => {
    if (!postId || !user || !text.trim()) return;
    setSending(true);
    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: postId, author_id: user.id, body: text.trim() })
      .select()
      .single();
    setSending(false);
    if (error || !data) return;
    await fetchProfiles([user.id]).then((p) => setProfiles((prev) => ({ ...prev, ...p })));
    setComments((c) => [...c, data as CommentRow]);
    setText('');
    onCountChange(postId, 1);
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
              return (
                <View className="mb-4 flex-row">
                  <Avatar uri={p?.avatar_url} name={p?.full_name} size={34} />
                  <View className="ml-3 flex-1">
                    <Text className="text-sm text-gray-900 dark:text-white">
                      <Text className="font-semibold">{p?.username ?? 'kullanıcı'} </Text>
                      {item.body}
                    </Text>
                    <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {timeAgo(item.created_at)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}
        <View className="flex-row items-center border-t border-gray-100 pt-3 dark:border-gray-800">
          <TextInput
            className="mr-2 flex-1 rounded-2xl bg-gray-100 px-4 py-3 text-base text-gray-900 dark:bg-gray-800 dark:text-white"
            placeholder="Yorum yaz..."
            placeholderTextColor="#9ca3af"
            value={text}
            onChangeText={setText}
          />
          <Pressable
            onPress={send}
            disabled={sending || !text.trim()}
            className={`rounded-2xl bg-primary-500 px-4 py-3 ${!text.trim() ? 'opacity-50' : ''}`}
          >
            <Text className="font-semibold text-white">Gönder</Text>
          </Pressable>
        </View>
      </View>
    </Sheet>
  );
}
