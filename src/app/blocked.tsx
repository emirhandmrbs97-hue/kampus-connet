import { ChevronLeft, UserX } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, EmptyState } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { goBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

export default function BlockedUsers() {
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBlockedUsers = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: blocks, error } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', user.id);

    if (error) {
      Alert.alert('Hata', 'Engellenen kullanıcılar yüklenemedi');
      setLoading(false);
      return;
    }

    const blockedIds = (blocks ?? []).map((b: any) => b.blocked_id);

    if (blockedIds.length === 0) {
      setBlockedUsers([]);
      setLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('id', blockedIds);

    setBlockedUsers((profiles ?? []) as Profile[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadBlockedUsers();
  }, [loadBlockedUsers]);

  const unblockUser = async (userId: string) => {
    const { error } = await supabase
      .from('blocks')
      .delete()
      .match({ blocker_id: user?.id, blocked_id: userId });

    if (error) {
      Alert.alert('Hata', 'Kullanıcı engeli kaldırılamadı');
    } else {
      loadBlockedUsers();
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-row items-center px-5 pt-2 mb-4">
        <Pressable onPress={() => goBack()} className="mr-4">
          <ChevronLeft size={24} color="#374151" className="dark:text-gray-300" />
        </Pressable>
        <Text className="text-2xl font-extrabold text-gray-900 dark:text-white">Engellenen Kullanıcılar</Text>
      </View>

      {loading ? (
        <View className="mt-10 items-center">
          <Text className="text-gray-500 dark:text-gray-400">Yükleniyor...</Text>
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          keyExtractor={(u) => u.id}
          ListEmptyComponent={
            <EmptyState
              title="Engellenen kullanıcı yok"
              hint="Henüz kimseyi engellemedin."
            />
          }
          renderItem={({ item }) => (
            <View className="flex-row items-center border-b border-gray-100 px-5 py-4 dark:border-gray-700">
              <Avatar uri={item.avatar_url} name={item.full_name} size={48} />
              <View className="ml-3 flex-1">
                <Text className="font-semibold text-gray-900 dark:text-white">{item.full_name || item.username}</Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400">@{item.username}</Text>
              </View>
              <Pressable
                onPress={() => {
                  Alert.alert(
                    'Engeli Kaldır',
                    `${item.full_name || item.username} kullanıcısının engelini kaldırmak istediğine emin misin?`,
                    [
                      { text: 'İptal', style: 'cancel' },
                      { text: 'Kaldır', onPress: () => unblockUser(item.id), style: 'destructive' },
                    ],
                  );
                }}
                className="rounded-lg bg-primary-500 px-4 py-2"
              >
                <Text className="text-sm font-semibold text-white">Engeli Kaldır</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
