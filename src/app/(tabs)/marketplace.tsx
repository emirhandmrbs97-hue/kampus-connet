import { router } from 'expo-router';
import { Plus, ShoppingBag } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CATEGORIES, NewListingModal } from '@/components/NewListingModal';
import { EmptyState } from '@/components/ui';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { ListingRow } from '@/types';

const FILTERS = ['Tümü', ...CATEGORIES];

export default function Marketplace() {
  const [items, setItems] = useState<ListingRow[]>([]);
  const [filter, setFilter] = useState('Tümü');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('listings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(100);
    setItems((data ?? []) as ListingRow[]);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const visible = filter === 'Tümü' ? items : items.filter((i) => i.category === filter);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-row items-center justify-between px-5 pt-2">
        <Text className="text-2xl font-extrabold text-gray-900 dark:text-white">Pazar</Text>
        <Pressable
          onPress={() => setNewOpen(true)}
          className="h-10 w-10 items-center justify-center rounded-full bg-primary-500"
        >
          <Plus size={22} color="#fff" />
        </Pressable>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-5 py-3">
          {FILTERS.map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              className={`rounded-full px-4 py-2 ${
                filter === f ? 'bg-primary-500' : 'bg-gray-100 dark:bg-gray-800'
              }`}
            >
              <Text className={filter === f ? 'font-semibold text-white' : 'text-gray-700 dark:text-gray-300'}>
                {f}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator className="mt-10" color="#0ea5e9" />
      ) : (
        <FlatList
          data={visible}
          numColumns={2}
          keyExtractor={(i) => i.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
            />
          }
          ListEmptyComponent={<EmptyState title="İlan bulunamadı" hint="Sağ üstteki + ile ilk ilanı sen ver." />}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })}
              className="m-1.5 flex-1 overflow-hidden rounded-3xl bg-gray-50 dark:bg-gray-800"
            >
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} className="h-36 w-full" resizeMode="cover" />
              ) : (
                <View className="h-36 w-full items-center justify-center bg-gray-200 dark:bg-gray-700">
                  <ShoppingBag size={30} color="#9ca3af" />
                </View>
              )}
              <View className="p-3">
                <Text numberOfLines={1} className="font-semibold text-gray-900 dark:text-white">
                  {item.title}
                </Text>
                <Text className="mt-0.5 text-base font-extrabold text-primary-600">{formatPrice(item.price)}</Text>
                <View className="mt-2 self-start rounded-full bg-primary-50 px-2.5 py-1 dark:bg-gray-700">
                  <Text className="text-xs text-primary-700 dark:text-primary-300">{item.category}</Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}

      <NewListingModal visible={newOpen} onClose={() => setNewOpen(false)} onCreated={load} />
    </SafeAreaView>
  );
}
