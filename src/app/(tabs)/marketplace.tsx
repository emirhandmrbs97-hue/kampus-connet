import { router } from 'expo-router';
import { BookOpen, FileText, Plus, Search, ShoppingBag, Sparkles, SlidersHorizontal } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AcademicSelectSheet } from '@/components/AcademicSelectSheet';
import { CATEGORIES, NewListingModal } from '@/components/NewListingModal';
import { MyListingsSheet } from '@/components/MyListingsSheet';
import { StorageImage } from '@/components/StorageImage';
import { EmptyState } from '@/components/ui';
import { STANDARD_DEPARTMENTS, TURKISH_UNIVERSITY_NAMES } from '@/constants/academicData';
import {
  getMarketplaceCategoryLabel,
  isNoteMarketplaceCategory,
  matchesMarketplaceCategory,
  NOTE_CATEGORY_LABEL,
} from '@/constants/marketplaceCategories';
import { formatPrice } from '@/lib/format';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/lib/supabase';
import type { ListingRow } from '@/types';

const FILTERS = ['Tümü', ...CATEGORIES];
const GRADE_FILTERS = ['Tümü', '1. Sınıf', '2. Sınıf', '3. Sınıf', '4. Sınıf', 'Yüksek Lisans'];

function formatFileSize(size: number | null | undefined): string {
  if (size == null) return 'PDF';
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Marketplace() {
  const [items, setItems] = useState<ListingRow[]>([]);
  const [filter, setFilter] = useState('Tümü');
  const [search, setSearch] = useState('');
  const [universityFilter, setUniversityFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('Tümü');
  const [academicFilter, setAcademicFilter] = useState<'university' | 'department' | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [myListingsOpen, setMyListingsOpen] = useState(false);
  const { t } = useLanguage();

  const categoryLabel = (category: string) => {
    if (category === 'Kitap' || category === 'books') return t('books');
    if (category === 'İkinci El Eşya' || category === 'goods') return t('secondHand');
    if (category === 'Elektronik' || category === 'electronics') return t('electronics');
    if (category === 'Ev & Yurt') return t('housing');
    if (category === 'Giyim') return t('clothing');
    if (isNoteMarketplaceCategory(category)) return t('courseNotes');
    if (category === 'Diğer') return t('other');
    return category;
  };

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

  const visible = items.filter((item) => {
    if (filter !== 'Tümü' && !matchesMarketplaceCategory(item.category, filter)) return false;
    const noteSearch = `${item.title} ${item.description} ${item.university_name ?? ''} ${item.department_name ?? ''}`;
    if (search.trim() && !noteSearch.toLocaleLowerCase('tr-TR').includes(search.trim().toLocaleLowerCase('tr-TR'))) {
      return false;
    }
    if (filter === NOTE_CATEGORY_LABEL) {
      if (universityFilter && item.university_name !== universityFilter) return false;
      if (departmentFilter && item.department_name !== departmentFilter) return false;
      if (gradeFilter !== 'Tümü' && item.grade_level !== gradeFilter) return false;
    }
    return true;
  });
  const isNotesFilter = filter === NOTE_CATEGORY_LABEL;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-gray-50 dark:bg-[#11111b]">
      <View className="flex-row items-center justify-between px-5 pt-3">
        <View>
          <Text className="text-xs font-bold uppercase tracking-[2px] text-violet-600 dark:text-violet-300">KampüsHub</Text>
          <Text className="mt-1 text-3xl font-black text-gray-950 dark:text-white">{t('marketplace')}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => setMyListingsOpen(true)}
            className="rounded-2xl border border-gray-200 bg-white px-3.5 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <Text className="text-xs font-extrabold text-gray-800 dark:text-gray-100">{t('listings')}</Text>
          </Pressable>
          <Pressable
            onPress={() => setNewOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('newListing')}
            className="h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 shadow-md shadow-violet-300 dark:shadow-none"
          >
            <Plus size={23} color="#fff" strokeWidth={2.8} />
          </Pressable>
        </View>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-5 py-4">
          {FILTERS.map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              className={`flex-row items-center rounded-full px-4 py-2.5 ${
                filter === f ? 'bg-violet-600 shadow-sm shadow-violet-300' : 'bg-white dark:bg-gray-800'
              }`}
            >
              {f === NOTE_CATEGORY_LABEL ? <BookOpen size={14} color={filter === f ? '#fff' : '#7c3aed'} /> : null}
              <Text className={filter === f ? 'font-semibold text-white' : 'text-gray-700 dark:text-gray-300'}>
                      {f === 'Tümü' ? t('all') : categoryLabel(f)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View className="px-4 pb-2">
        <View className="flex-row items-center rounded-2xl border border-gray-200 bg-white px-3.5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <Search size={18} color="#9ca3af" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={isNotesFilter ? t('searchNotes') : t('searchMarketplace')}
            placeholderTextColor="#9ca3af"
            className="ml-2 flex-1 py-3.5 text-[15px] text-gray-900 dark:text-white"
          />
        </View>
        {isNotesFilter ? (
          <View className="mt-2">
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => setAcademicFilter('university')}
                className="min-h-11 flex-1 justify-center rounded-2xl border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900"
              >
                <Text numberOfLines={1} className={universityFilter ? 'text-sm text-gray-900 dark:text-white' : 'text-sm text-gray-500 dark:text-gray-400'}>
                  {universityFilter || t('selectUniversity')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setAcademicFilter('department')}
                className="min-h-11 flex-1 justify-center rounded-2xl border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900"
              >
                <Text numberOfLines={1} className={departmentFilter ? 'text-sm text-gray-900 dark:text-white' : 'text-sm text-gray-500 dark:text-gray-400'}>
                  {departmentFilter || t('selectDepartment')}
                </Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 py-2">
              {GRADE_FILTERS.map((grade) => (
                <Pressable
                  key={grade}
                  onPress={() => setGradeFilter(grade)}
                  className={`rounded-full px-3 py-1.5 ${gradeFilter === grade ? 'bg-violet-600' : 'bg-white dark:bg-gray-800'}`}
                >
                  <Text className={gradeFilter === grade ? 'text-xs font-semibold text-white' : 'text-xs text-gray-700 dark:text-gray-300'}>
                    {grade}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
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
          ListEmptyComponent={<EmptyState title={t('listingNotFound')} hint={t('firstListingHint')} icon={<SlidersHorizontal size={32} color="#8b5cf6" />} />}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })}
              className="m-1.5 flex-1 overflow-hidden rounded-[26px] border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              {item.image_url ? (
                <StorageImage uri={item.image_url} className="h-36 w-full" resizeMode="cover" />
              ) : isNoteMarketplaceCategory(item.category) ? (
                <View className="h-36 w-full items-center justify-center bg-violet-50 dark:bg-violet-950">
                  <View className="h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-gray-900">
                    <FileText size={30} color="#7c3aed" />
                  </View>
                  <Text className="mt-2 text-xs font-bold text-violet-700 dark:text-violet-300">
                    {formatFileSize(item.pdf_size)}
                  </Text>
                </View>
              ) : (
                <View className="h-36 w-full items-center justify-center bg-fuchsia-50 dark:bg-gray-800">
                  <View className="h-14 w-14 items-center justify-center rounded-2xl bg-white/80 dark:bg-gray-900">
                    <ShoppingBag size={27} color="#7c3aed" />
                  </View>
                </View>
              )}
              <View className="p-3.5">
                <Text numberOfLines={1} className="font-extrabold text-gray-900 dark:text-white">
                  {item.title}
                </Text>
                <Text className="mt-1 text-lg font-black text-violet-700 dark:text-violet-300">{formatPrice(item.price)}</Text>
                {isNoteMarketplaceCategory(item.category) ? (
                  <Text numberOfLines={2} className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {[item.university_name, item.department_name, item.grade_level].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
                <View className="mt-2 self-start flex-row items-center rounded-full bg-violet-50 px-2.5 py-1 dark:bg-violet-950">
                  {isNoteMarketplaceCategory(item.category) ? <Sparkles size={11} color="#7c3aed" /> : null}
                  <Text className="ml-1 text-xs font-semibold text-violet-700 dark:text-violet-300">
                    {categoryLabel(getMarketplaceCategoryLabel(item.category))}
                  </Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}

      <NewListingModal visible={newOpen} onClose={() => setNewOpen(false)} onCreated={load} />
      <MyListingsSheet
        visible={myListingsOpen}
        onClose={() => setMyListingsOpen(false)}
        onChanged={load}
      />
      <AcademicSelectSheet
        visible={academicFilter !== null}
        title={academicFilter === 'university' ? 'Üniversite filtresi' : 'Bölüm filtresi'}
        options={academicFilter === 'university' ? TURKISH_UNIVERSITY_NAMES : STANDARD_DEPARTMENTS}
        selectedValue={academicFilter === 'university' ? universityFilter : departmentFilter}
        allowClear
        onSelect={(value) => {
          if (academicFilter === 'university') setUniversityFilter(value);
          else setDepartmentFilter(value);
        }}
        onClose={() => setAcademicFilter(null)}
      />
    </SafeAreaView>
  );
}
