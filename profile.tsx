import { router, useFocusEffect } from 'expo-router';
import { Settings as SettingsIcon } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Button, EmptyState } from '@/components/ui';
import { StorageImage } from '@/components/StorageImage';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import { timeAgo } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { pickImage } from '@/services/mediaPicker';
import { countRows } from '@/services/profiles';
import { uploadMedia } from '@/services/storageService';
import type { PostRow } from '@/types';

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View className="items-center">
      <Text className="text-xl font-extrabold text-gray-900 dark:text-white">{value}</Text>
      <Text className="text-sm text-gray-500 dark:text-gray-400">{label}</Text>
    </View>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();

  const [counts, setCounts] = useState({ posts: 0, followers: 0, following: 0 });
  const [myPosts, setMyPosts] = useState<PostRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [posts, followers, following, mine] = await Promise.all([
      countRows('posts', 'author_id', user.id),
      countRows('follows', 'following_id', user.id),
      countRows('follows', 'follower_id', user.id),
      supabase
        .from('posts')
        .select('*')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30),
    ]);
    setCounts({ posts, followers, following });
    setMyPosts(((mine.data ?? []) as PostRow[]).filter((p) => !p.is_archived));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const changeAvatar = async () => {
    const picked = await pickImage({ square: true });
    if (!picked) return;
    setBusy(true);
    try {
      const media = await uploadMedia(picked.uri, {
        kind: 'image',
        folder: 'avatars',
        fileName: picked.fileName,
        mimeType: picked.mimeType,
      });
      const error = await updateProfile({ avatar_url: media.path });
      if (error) Alert.alert('Fotoğraf güncellenemedi', error);
    } catch (e) {
      Alert.alert('Fotoğraf güncellenemedi', e instanceof Error ? e.message : 'Bir hata oluştu.');
    } finally {
      setBusy(false);
    }
  };

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator color="#0ea5e9" />
      </SafeAreaView>
    );
  }

  const header = (
    <View>
      <View className="items-center px-5 pb-4 pt-6">
        <Pressable onPress={changeAvatar} disabled={busy}>
          <Avatar uri={profile.avatar_url} name={profile.full_name} size={96} />
        </Pressable>
        <Text className="mt-3 text-xl font-extrabold text-gray-900 dark:text-white">
          {profile.full_name || profile.username}
        </Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400">@{profile.username}</Text>
        {profile.is_private ? (
          <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">Gizli hesap</Text>
        ) : null}
        <Text className="mt-2 text-xs text-gray-400">Fotoğrafı değiştirmek için dokun</Text>
      </View>

      <View className="flex-row justify-around border-y border-gray-100 py-4 dark:border-gray-800">
        <Stat value={counts.posts} label="Gönderi" />
        <Stat value={counts.followers} label="Takipçi" />
        <Stat value={counts.following} label="Takip" />
      </View>

      <Text className="px-5 pb-2 pt-5 text-lg font-bold text-gray-900 dark:text-white">Gönderilerim</Text>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-row items-center justify-between px-5 pt-2">
        <Text className="text-2xl font-extrabold text-gray-900 dark:text-white">Profil</Text>
        <Pressable onPress={() => router.push('/settings')} hitSlop={10}>
          <SettingsIcon size={24} color="#9ca3af" />
        </Pressable>
      </View>

      <FlatList
        data={myPosts}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        ListEmptyComponent={<EmptyState title="Henüz gönderin yok" hint="Ana sayfadan ilk gönderini paylaş." />}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View className="mx-5 mb-3 flex-row rounded-2xl bg-gray-50 p-3 dark:bg-gray-800">
            {item.media_type === 'image' && item.media_url ? (
              <StorageImage uri={item.media_url} className="mr-3 h-16 w-16 rounded-xl" resizeMode="cover" />
            ) : null}
            <View className="flex-1">
              <Text numberOfLines={3} className="text-gray-900 dark:text-gray-100">
                {item.body || item.file_name || 'Medya'}
              </Text>
              <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">{timeAgo(item.created_at)}</Text>
            </View>
          </View>
        )}
        ListFooterComponent={
          <View className="mt-4 px-5">
            <Button title="Ayarlar" variant="soft" onPress={() => router.push('/settings')} />
          </View>
        }
      />
    </SafeAreaView>
  );
}
