import { Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TURKISH_UNIVERSITIES } from './turkishUniversities';

type UniversityOption = string | null;

export function UniversityPickerModal({
  visible,
  selectedUniversity,
  additionalUniversities = [],
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedUniversity: UniversityOption;
  additionalUniversities?: string[];
  onSelect: (university: UniversityOption) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const universities = useMemo(
    () => [...new Set([...TURKISH_UNIVERSITIES, ...additionalUniversities])].sort((a, b) => a.localeCompare(b, 'tr')),
    [additionalUniversities],
  );
  const query = search.trim().toLocaleLowerCase('tr-TR');
  const filteredUniversities = query
    ? universities.filter((university) => university.toLocaleLowerCase('tr-TR').includes(query))
    : universities;
  const options: UniversityOption[] = [null, ...filteredUniversities];

  const select = (university: UniversityOption) => {
    onSelect(university);
    setSearch('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        setSearch('');
        onClose();
      }}
    >
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-950">
        <View className="flex-row items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <View>
            <Text className="text-xl font-extrabold text-gray-900 dark:text-white">Üniversite seç</Text>
            <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {universities.length} üniversite ve kampüs
            </Text>
          </View>
          <Pressable
            onPress={() => {
              setSearch('');
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="Üniversite listesini kapat"
            className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"
          >
            <X size={20} color="#9ca3af" />
          </Pressable>
        </View>

        <View className="mx-4 my-3 flex-row items-center rounded-2xl bg-gray-100 px-3 dark:bg-gray-800">
          <Search size={18} color="#9ca3af" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Üniversite ara"
            placeholderTextColor="#9ca3af"
            accessibilityLabel="Üniversite ara"
            returnKeyType="search"
            className="ml-2 h-12 flex-1 text-base text-gray-900 dark:text-white"
          />
        </View>

        <FlatList
          data={options}
          keyExtractor={(item) => item ?? 'all-universities'}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={16}
          maxToRenderPerBatch={20}
          windowSize={8}
          ListEmptyComponent={
            <Text className="px-8 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              Aramana uygun üniversite bulunamadı.
            </Text>
          }
          renderItem={({ item }) => {
            const label = item ?? 'Tüm Üniversiteler';
            const selected = item === selectedUniversity;
            return (
              <Pressable
                onPress={() => select(item)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={`mx-4 flex-row items-center border-b border-gray-100 px-3 py-4 dark:border-gray-800 ${
                  selected ? 'bg-primary-50 dark:bg-gray-900' : ''
                }`}
              >
                <Text className={`flex-1 text-sm ${selected ? 'font-bold text-primary-700 dark:text-primary-300' : 'text-gray-800 dark:text-gray-200'}`}>
                  {label}
                </Text>
                {selected ? <View className="h-2.5 w-2.5 rounded-full bg-primary-500" /> : null}
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}
