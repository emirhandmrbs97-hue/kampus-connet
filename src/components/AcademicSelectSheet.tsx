import { Check, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { ACADEMIC_DEPARTMENT_GROUPS, STANDARD_DEPARTMENTS } from '@/constants/academicData';

type AcademicSection = { title: string; data: readonly string[] };

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR').replace(/ı/g, 'i');
}

export function AcademicSelectSheet({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
  allowClear = false,
}: {
  visible: boolean;
  title: string;
  options: readonly string[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  allowClear?: boolean;
}) {
  const [search, setSearch] = useState('');
  const isDepartmentList = options === STANDARD_DEPARTMENTS;
  const sections = useMemo<AcademicSection[]>(() => {
    const query = normalize(search);
    const groups: readonly AcademicSection[] = isDepartmentList
      ? ACADEMIC_DEPARTMENT_GROUPS
      : [{ title: '', data: options }];

    return groups
      .map((group) => ({
        title: group.title,
        data: group.data.filter((option) => !query || normalize(option).includes(query)),
      }))
      .filter((group) => group.data.length > 0);
  }, [isDepartmentList, options, search]);

  const close = () => {
    setSearch('');
    onClose();
  };

  const select = (value: string) => {
    onSelect(value);
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <Pressable onPress={close} className="absolute inset-0" accessibilityLabel="Seçim penceresini kapat" />
        <View className="h-[78%] rounded-t-3xl bg-white px-5 pb-8 pt-4 dark:bg-gray-900">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-gray-900 dark:text-white">{title}</Text>
            <Pressable onPress={close} hitSlop={12}>
              <Text className="font-semibold text-primary-600">Kapat</Text>
            </Pressable>
          </View>

          <View className="mb-3 flex-row items-center rounded-2xl bg-gray-100 px-3 dark:bg-gray-800">
            <Search size={18} color="#9ca3af" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Listede ara"
              placeholderTextColor="#9ca3af"
              autoCorrect={false}
              className="ml-2 flex-1 py-3 text-gray-900 dark:text-white"
            />
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {allowClear ? (
              <Pressable
                onPress={() => select('')}
                className="mb-2 flex-row items-center justify-between rounded-xl bg-primary-50 px-4 py-3 dark:bg-gray-800"
              >
                <Text className="font-semibold text-primary-700 dark:text-primary-300">Seçimi temizle</Text>
                {!selectedValue ? <Check size={18} color="#0ea5e9" /> : null}
              </Pressable>
            ) : null}
            {sections.length ? (
              sections.map((section) => (
                <View key={section.title || title}>
                  {section.title ? (
                    <Text className="mb-1 mt-3 px-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {section.title}
                    </Text>
                  ) : null}
                  {section.data.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => select(option)}
                      className="flex-row items-center justify-between border-b border-gray-100 px-3 py-3.5 dark:border-gray-800"
                    >
                      <Text className="flex-1 pr-3 text-gray-900 dark:text-white">{option}</Text>
                      {selectedValue === option ? <Check size={18} color="#0ea5e9" /> : null}
                    </Pressable>
                  ))}
                </View>
              ))
            ) : (
              <Text className="py-8 text-center text-gray-500 dark:text-gray-400">Eşleşen seçenek bulunamadı.</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
