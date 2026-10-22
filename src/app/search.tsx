import { router } from 'expo-router';
import { ChevronLeft, Search, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, EmptyState } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { goBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

export default function SearchScreen() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async () => {
    const term = query.trim().replace(/^@/, '');
    if (!user || term.length < 2) {
      setProfiles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [usernameResult, nameResult] = await Promise.all([
        supabase.from('profiles').select('*').ilike('username', `%${term}%`).limit(25),
        supabase.from('profiles').select('*').ilike('full_name', `%${term}%`).limit(25),
      ]);
      if (usernameResult.error) throw usernameResult.error;
      if (nameResult.error) throw nameResult.error;
      const combined = new Map<string, Profile>();
      for (const profile of [...(usernameResult.data ?? []), ...(nameResult.data ?? [])] as Profile[]) {
        combined.set(profile.id, profile);
      }
      setProfiles(Array.from(combined.values()).filter((profile) => profile.id !== user.id));
    } catch (error) {
      console.error('Kullanıcı araması başarısız:', error);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [query, user]);

  useEffect(() => {
    const timer = setTimeout(() => void search(), 250);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-row items-center px-5 pt-2">
        <Pressable onPress={() => goBack()} className="mr-3">
          <ChevronLeft size={24} color="#374151" />
        </Pressable>
        <Text className="text-2xl font-extrabold text-gray-900 dark:text-white">Kullanıcı ara</Text>
      </View>
      <View className="mx-5 my-4 flex-row items-center rounded-2xl bg-gray-100 px-4 py-3 dark:bg-gray-800">
        <Search size={19} color="#9ca3af" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="İsim veya kullanıcı adı"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          className="ml-3 flex-1 text-base text-gray-900 dark:text-white"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} accessibilityLabel="Aramayı temizle">
            <X size={18} color="#9ca3af" />
          </Pressable>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator className="mt-8" color="#0ea5e9" />
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={(profile) => profile.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              title={query.trim().length < 2 ? 'Kullanıcı ara' : 'Sonuç bulunamadı'}
              hint={query.trim().length < 2 ? 'En az iki karakter yaz.' : 'Başka bir isim veya kullanıcı adı dene.'}
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/profile/[id]', params: { id: item.id } })}
              className="flex-row items-center px-5 py-3"
            >
              <Avatar uri={item.avatar_url} name={item.full_name} size={48} />
              <View className="ml-3 flex-1">
                <Text className="font-semibold text-gray-900 dark:text-white">{item.full_name || item.username}</Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400">@{item.username}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
