import { router } from 'expo-router';
import { ChevronDown, Plus, ShoppingBag } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CATEGORIES, NewListingModal } from '@/components/NewListingModal';
import { EmptyState } from '@/components/ui';
import { StorageImage } from '@/components/StorageImage';
import { NativeAdCard } from './components/NativeAdCard';
import { UniversityPickerModal } from './UniversityPickerModal';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { ListingRow } from '@/types';

const FILTERS = ['Tümü', ...CATEGORIES];

type MarketplaceListItem =
  | { type: 'listings'; key: string; listings: ListingRow[] }
  | { type: 'ad'; key: string };

export default function Marketplace() {
  const [items, setItems] = useState<ListingRow[]>([]);
  const [filter, setFilter] = useState('Tümü');
  const [universityFilter, setUniversityFilter] = useState<string | null>(null);
  const [universities, setUniversities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [universityPickerOpen, setUniversityPickerOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const latestLoad = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++latestLoad.current;
    setLoading(true);
    setLoadError(null);
    let listingsQuery = supabase
      .from('listings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(100);
    if (universityFilter) listingsQuery = listingsQuery.eq('university', universityFilter);

    const [{ data, error }, { data: campusRows, error: campusError }] = await Promise.all([
      listingsQuery,
      supabase
        .from('listings')
        .select('university')
        .eq('status', 'active')
        .not('university', 'is', null)
        .order('university')
        .limit(1000),
    ]);
    if (requestId !== latestLoad.current) return;
    setLoading(false);
    if (error) {
      setItems([]);
      setLoadError(error.message);
      return;
    }

    const names = new Set(
      (campusRows ?? [])
        .map((row) => row.university?.trim())
        .filter((name): name is string => !!name),
    );
    setUniversities([...names].sort((a, b) => a.localeCompare(b, 'tr')));
    if (campusError) console.error('[marketplace] Failed to load universities:', campusError.message);
    setItems((data ?? []) as ListingRow[]);
  }, [universityFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = filter === 'Tümü' ? items : items.filter((i) => i.category === filter);
  const listItems = useMemo<MarketplaceListItem[]>(() => {
    const result: MarketplaceListItem[] = [];
    for (let index = 0; index < visible.length; index += 2) {
      const endIndex = Math.min(index + 2, visible.length);
      result.push({
        type: 'listings',
        key: `listing-row-${visible[index].id}`,
        listings: visible.slice(index, endIndex),
      });
      if (endIndex % 10 === 0) {
        result.push({ type: 'ad', key: `ad-marketplace-${endIndex}` });
      }
    }
    return result;
  }, [visible]);

  const renderListing = (item: ListingRow) => (
    <Pressable
      onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })}
      className="m-1.5 flex-1 overflow-hidden rounded-3xl bg-gray-50 dark:bg-gray-800"
    >
      {item.image_url ? (
        <StorageImage uri={item.image_url} className="h-36 w-full" resizeMode="cover" />
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
        <View className="mt-2 flex-row flex-wrap gap-1.5">
          <View className="self-start rounded-full bg-primary-50 px-2.5 py-1 dark:bg-gray-700">
            <Text className="text-xs text-primary-700 dark:text-primary-300">{item.category}</Text>
          </View>
          {item.university ? (
            <View className="self-start rounded-full bg-gray-100 px-2.5 py-1 dark:bg-gray-700">
              <Text numberOfLines={1} className="max-w-[120px] text-xs text-gray-600 dark:text-gray-300">
                {item.university}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );

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
        <Text className="px-5 pt-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Üniversite</Text>
        <Pressable
          onPress={() => setUniversityPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Üniversite filtresi: ${universityFilter ?? 'Tüm Üniversiteler'}`}
          className="mx-5 mt-2 flex-row items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800"
        >
          <Text numberOfLines={1} className="mr-3 flex-1 text-sm font-semibold text-gray-900 dark:text-white">
            {universityFilter ?? 'Tüm Üniversiteler'}
          </Text>
          <ChevronDown size={18} color="#6b7280" />
        </Pressable>
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
          data={listItems}
          keyExtractor={(item) => item.key}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                try {
                  await load();
                } finally {
                  setRefreshing(false);
                }
              }}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title={loadError ? 'İlanlar yüklenemedi' : 'İlan bulunamadı'}
              hint={loadError ?? 'Sağ üstteki + ile ilk ilanı sen ver.'}
            />
          }
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
          renderItem={({ item }) => item.type === 'ad' ? (
            <NativeAdCard />
          ) : (
            <View className="flex-row">
              {renderListing(item.listings[0])}
              {item.listings[1] ? renderListing(item.listings[1]) : <View className="m-1.5 flex-1" />}
            </View>
          )}
        />
      )}

      <NewListingModal visible={newOpen} onClose={() => setNewOpen(false)} onCreated={load} />
      <UniversityPickerModal
        visible={universityPickerOpen}
        selectedUniversity={universityFilter}
        additionalUniversities={universities}
        onSelect={setUniversityFilter}
        onClose={() => setUniversityPickerOpen(false)}
      />
    </SafeAreaView>
  );
}
