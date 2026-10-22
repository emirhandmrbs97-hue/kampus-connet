import { Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';

import { Avatar, EmptyState, Sheet } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/lib/supabase';
import { startConversation } from '@/services/chat';
import type { Profile } from '@/types';

export function NewMessageSheet({
  visible,
  onClose,
  onOpenChat,
  initialQuery = '',
}: {
  visible: boolean;
  onClose: () => void;
  onOpenChat: (conversationId: string) => void;
  initialQuery?: string;
}) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
    } else if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [visible, initialQuery]);

  useEffect(() => {
    const q = query.trim().toLowerCase().replace(/^@/, '');
    if (!visible || !user || q.length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${q}%`)
        .neq('id', user.id)
        .limit(20);
      const list = (data ?? []) as Profile[];
      if (list.length) {
        const { data: f } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id)
          .in('following_id', list.map((p) => p.id));
        if (active) setFollowing(new Set((f ?? []).map((r) => r.following_id as string)));
      }
      if (active) {
        setResults(list);
        setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, visible, user]);

  const toggleFollow = async (p: Profile) => {
    if (!user) return;
    const isFollowing = following.has(p.id);
    setFollowing((s) => {
      const n = new Set(s);
      if (isFollowing) n.delete(p.id);
      else n.add(p.id);
      return n;
    });
    if (isFollowing) await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', p.id);
    else await supabase.from('follows').insert({ follower_id: user.id, following_id: p.id });
  };

  const open = async (p: Profile) => {
    const { id, error } = await startConversation(p.id);
    if (error || !id) return Alert.alert('Sohbet açılamadı', error ?? '');
    onClose();
    onOpenChat(id);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('newMessage')} tall>
      <View className="mb-3 flex-row items-center rounded-2xl bg-gray-100 px-4 dark:bg-gray-800">
        <Search size={18} color="#9ca3af" />
        <TextInput
          className="ml-2 flex-1 py-3.5 text-base text-gray-900 dark:text-white"
          placeholder={t('userSearch')}
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          autoCorrect={false}
          value={query}
          onChangeText={setQuery}
        />
      </View>
      {loading ? <ActivityIndicator color="#0ea5e9" /> : null}
      <FlatList
        data={results}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          query.trim().length >= 2 && !loading ? (
            <EmptyState title={t('userNotFound')} />
          ) : (
            <EmptyState title={t('searchUser')} hint={t('typeTwoChars')} />
          )
        }
        renderItem={({ item }) => (
          <View className="mb-2 flex-row items-center">
            <Pressable onPress={() => open(item)} className="flex-1 flex-row items-center">
              <Avatar uri={item.avatar_url} name={item.full_name} size={44} />
              <View className="ml-3 flex-1">
                <Text className="font-semibold text-gray-900 dark:text-white">{item.full_name || item.username}</Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400">@{item.username}</Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => toggleFollow(item)}
              className={`rounded-xl px-3 py-2 ${following.has(item.id) ? 'bg-gray-200 dark:bg-gray-700' : 'bg-primary-500'}`}
            >
              <Text className={following.has(item.id) ? 'text-gray-700 dark:text-gray-200' : 'font-semibold text-white'}>
                {following.has(item.id) ? t('following') : t('follow')}
              </Text>
            </Pressable>
          </View>
        )}
      />
    </Sheet>
  );
}
