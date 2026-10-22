import { Camera, FileText, MoreHorizontal, Pencil, RotateCcw, ShoppingBag, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, Text, View } from 'react-native';

import { AcademicSelectSheet } from '@/components/AcademicSelectSheet';
import { StorageImage } from '@/components/StorageImage';
import { Button, Field, Sheet } from '@/components/ui';
import {
  getMarketplaceCategoryLabel,
  getStoredMarketplaceCategory,
  isNoteMarketplaceCategory,
  MARKETPLACE_CATEGORIES,
  NOTE_CATEGORY_LABEL,
} from '@/constants/marketplaceCategories';
import { STANDARD_DEPARTMENTS, TURKISH_UNIVERSITY_NAMES, validateDepartmentName, validateTurkishUniversityName } from '@/constants/academicData';
import { formatPrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { pickImage, pickPdf } from '@/services/mediaPicker';
import { deleteMarketplacePdf, uploadMarketplacePdf, uploadMedia } from '@/services/storageService';
import type { ListingRow } from '@/types';

type EditForm = {
  title: string;
  description: string;
  price: string;
  category: string;
  image: string | null;
  pdf: { uri: string; name: string; size: number | null; file?: Blob } | null;
  university: string;
  department: string;
  grade: string;
  condition: string;
};

const GRADES = ['1. Sınıf', '2. Sınıf', '3. Sınıf', '4. Sınıf', 'Yüksek Lisans'];
const CONDITIONS = ['Yeni', 'Az kullanılmış', 'İyi', 'Yıpranmış'];
function isNote(item: ListingRow): boolean {
  return isNoteMarketplaceCategory(item.category);
}

function statusLabel(status: ListingRow['status']): string {
  if (status === 'sold') return 'Satıldı';
  if (status === 'archived') return 'Arşivlendi';
  return 'Yayında';
}

function EditListingSheet({
  listing,
  onClose,
  onSaved,
}: {
  listing: ListingRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<EditForm>({
    title: listing.title,
    description: listing.description,
    price: String(listing.price),
    category: getMarketplaceCategoryLabel(listing.category),
    image: listing.image_url,
    pdf: null,
    university: listing.university_name ?? '',
    department: listing.department_name ?? '',
    grade: listing.grade_level ?? '',
    condition: listing.condition,
  });
  const note = form.category === NOTE_CATEGORY_LABEL;
  const [picker, setPicker] = useState<'university' | 'department' | null>(null);
  const [imageFile, setImageFile] = useState<Blob | undefined>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const price = Number(form.price.replace(',', '.'));
    const nextErrors = {
      title: form.title.trim().length < 3 ? 'Başlık en az 3 karakter olmalı.' : '',
      description: note && !form.description.trim() ? 'Açıklama zorunludur.' : '',
      price: !form.price.trim() || !Number.isFinite(price) || price < 0 ? 'Geçerli bir fiyat gir.' : '',
      university: note && !validateTurkishUniversityName(form.university).valid ? 'Listeden üniversite seç.' : '',
      department: note && !validateDepartmentName(form.department).valid ? 'Listeden bölüm seç.' : '',
      grade: note && !GRADES.includes(form.grade) ? 'Sınıf düzeyi seç.' : '',
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSaving(true);
    try {
      let imageUrl = form.image;
      if (imageUrl && imageUrl !== listing.image_url) {
        imageUrl = (
          await uploadMedia(imageUrl, { kind: 'image', folder: 'listings', file: imageFile })
        ).url;
      }
      let pdfUrl = listing.pdf_url ?? null;
      let pdfName = listing.pdf_file_name ?? null;
      let pdfSize = listing.pdf_size ?? null;
      if (form.pdf) {
        const uploaded = await uploadMarketplacePdf(
          form.pdf.uri,
          form.pdf.name,
          listing.seller_id,
          form.pdf.file,
        );
        pdfUrl = uploaded.url;
        pdfName = form.pdf.name;
        pdfSize = uploaded.size;
      }
      const { error } = await supabase
        .from('listings')
        .update({
          title: form.title.trim(),
          description: form.description.trim(),
          price,
          category: getStoredMarketplaceCategory(form.category),
          image_url: imageUrl,
          condition: form.condition,
          university_name: note ? validateTurkishUniversityName(form.university).canonicalName : null,
          department_name: note ? validateDepartmentName(form.department).canonicalName : null,
          grade_level: note ? form.grade : null,
          pdf_url: note ? pdfUrl : null,
          pdf_file_name: note ? pdfName : null,
          pdf_size: note ? pdfSize : null,
        })
        .eq('id', listing.id)
        .eq('seller_id', listing.seller_id);
      if (error) throw error;
      if ((form.pdf || !note) && listing.pdf_url) await deleteMarketplacePdf(listing.pdf_url);
      onSaved();
      onClose();
    } catch (error) {
      console.error('İlan düzenleme hatası:', error);
      Alert.alert('İlan güncellenemedi', error instanceof Error ? error.message : 'Bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const update = (values: Partial<EditForm>) => setForm((current) => ({ ...current, ...values }));

  return (
    <>
      <Sheet visible onClose={onClose} title="İlanı düzenle" tall>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Pressable
            onPress={async () => {
              const selected = await pickImage();
              if (selected) {
                update({ image: selected.uri });
                setImageFile(selected.file);
              }
            }}
            className="mb-4 h-40 items-center justify-center overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-800"
          >
            {form.image ? (
              <StorageImage uri={form.image} className="h-full w-full" resizeMode="cover" />
            ) : (
              <>
                <Camera size={26} color="#9ca3af" />
                <Text className="mt-2 text-gray-500 dark:text-gray-400">Fotoğraf seç</Text>
              </>
            )}
          </Pressable>
          <Field label="Başlık" value={form.title} onChangeText={(title) => update({ title })} error={errors.title} />
          <Field
            label="Açıklama"
            value={form.description}
            onChangeText={(description) => update({ description })}
            multiline
            textAlignVertical="top"
            error={errors.description}
          />
          <Field
            label="Fiyat (₺)"
            value={form.price}
            onChangeText={(price) => update({ price })}
            keyboardType="decimal-pad"
            error={errors.price}
          />
          <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Kategori</Text>
          <View className="mb-4 flex-row flex-wrap gap-2">
            {MARKETPLACE_CATEGORIES.map((category) => (
              <Pressable
                key={category}
                onPress={() => update({ category })}
                className={`rounded-full px-3 py-2 ${form.category === category ? 'bg-primary-500' : 'bg-gray-100 dark:bg-gray-800'}`}
              >
                <Text className={form.category === category ? 'text-white' : 'text-gray-700 dark:text-gray-300'}>
                  {category}
                </Text>
              </Pressable>
            ))}
          </View>
          {note ? (
            <>
              <Text className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">Üniversite</Text>
              <Pressable onPress={() => setPicker('university')} className="mb-1 rounded-2xl bg-gray-100 px-4 py-3.5 dark:bg-gray-800">
                <Text className="text-gray-900 dark:text-white">{form.university || 'Üniversite seç'}</Text>
              </Pressable>
              {errors.university ? <Text className="mb-3 text-xs text-red-600">{errors.university}</Text> : null}
              <Text className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">Bölüm</Text>
              <Pressable onPress={() => setPicker('department')} className="mb-1 rounded-2xl bg-gray-100 px-4 py-3.5 dark:bg-gray-800">
                <Text className="text-gray-900 dark:text-white">{form.department || 'Bölüm seç'}</Text>
              </Pressable>
              {errors.department ? <Text className="mb-3 text-xs text-red-600">{errors.department}</Text> : null}
              <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Sınıf / Düzey</Text>
              <View className="mb-3 flex-row flex-wrap gap-2">
                {GRADES.map((grade) => (
                  <Pressable key={grade} onPress={() => update({ grade })} className={`rounded-full px-3 py-2 ${form.grade === grade ? 'bg-primary-500' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    <Text className={form.grade === grade ? 'text-white' : 'text-gray-700 dark:text-gray-300'}>{grade}</Text>
                  </Pressable>
                ))}
              </View>
              {errors.grade ? <Text className="mb-3 text-xs text-red-600">{errors.grade}</Text> : null}
              <Pressable
                onPress={async () => {
                  const selected = await pickPdf();
                  if (selected) update({ pdf: selected });
                }}
                className="mb-4 flex-row items-center rounded-2xl bg-red-50 p-4 dark:bg-gray-800"
              >
                <FileText size={22} color="#dc2626" />
                <Text numberOfLines={1} className="ml-3 flex-1 text-gray-900 dark:text-white">
                  {form.pdf?.name ?? listing.pdf_file_name ?? 'PDF dosyasını değiştir'}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Durum</Text>
              <View className="mb-4 flex-row flex-wrap gap-2">
                {CONDITIONS.map((condition) => (
                  <Pressable key={condition} onPress={() => update({ condition })} className={`rounded-full px-3 py-2 ${form.condition === condition ? 'bg-primary-500' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    <Text className={form.condition === condition ? 'text-white' : 'text-gray-700 dark:text-gray-300'}>{condition}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          <Button title="Değişiklikleri kaydet" onPress={save} loading={saving} />
        </ScrollView>
      </Sheet>
      <AcademicSelectSheet
        visible={picker !== null}
        title={picker === 'university' ? 'Üniversite seç' : 'Bölüm seç'}
        options={picker === 'university' ? TURKISH_UNIVERSITY_NAMES : STANDARD_DEPARTMENTS}
        selectedValue={picker === 'university' ? form.university : form.department}
        onSelect={(value) => update(picker === 'university' ? { university: value } : { department: value })}
        onClose={() => setPicker(null)}
      />
    </>
  );
}

export function MyListingsSheet({
  visible,
  onClose,
  onChanged,
}: {
  visible: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [items, setItems] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ListingRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) {
        setItems([]);
        return;
      }
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .eq('seller_id', authData.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems((data ?? []) as ListingRow[]);
    } catch (error) {
      Alert.alert('İlanlar yüklenemedi', error instanceof Error ? error.message : 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) void load();
  }, [load, visible]);

  const updateStatus = async (item: ListingRow, status: ListingRow['status']) => {
    setActionId(null);
    const { error } = await supabase.from('listings').update({ status }).eq('id', item.id);
    if (error) return Alert.alert('İlan durumu güncellenemedi', error.message);
    await load();
    onChanged();
  };

  const deleteItem = (item: ListingRow) => {
    setActionId(null);
    Alert.alert('İlan silinsin mi?', 'İlan ve varsa yüklenmiş PDF dosyası kalıcı olarak silinecek.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const { error } = await supabase.from('listings').delete().eq('id', item.id);
            if (error) return Alert.alert('İlan silinemedi', error.message);
            try {
              await deleteMarketplacePdf(item.pdf_url);
            } catch (error) {
              console.error('İlan PDF dosyası silinemedi:', error);
              Alert.alert('İlan silindi', 'Kayıt silindi ancak Storage dosyası temizlenemedi.');
            }
            await load();
            onChanged();
          })();
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: ListingRow }) => {
    const note = isNote(item);
    return (
      <View className="mb-3 overflow-hidden rounded-2xl bg-gray-50 dark:bg-gray-800">
        <View className="flex-row items-center p-3">
          {item.image_url ? (
            <StorageImage uri={item.image_url} className="h-16 w-16 rounded-xl" resizeMode="cover" />
          ) : (
            <View className={`h-16 w-16 items-center justify-center rounded-xl ${note ? 'bg-red-50 dark:bg-gray-700' : 'bg-gray-200 dark:bg-gray-700'}`}>
              {note ? <FileText size={25} color="#dc2626" /> : <ShoppingBag size={25} color="#9ca3af" />}
            </View>
          )}
          <View className="ml-3 flex-1">
            <Text numberOfLines={1} className="font-semibold text-gray-900 dark:text-white">{item.title}</Text>
            <Text className="mt-1 font-bold text-primary-600">{formatPrice(item.price)}</Text>
            <View className={`mt-1 self-start rounded-full px-2 py-0.5 ${item.status === 'sold' ? 'bg-red-100' : item.status === 'archived' ? 'bg-gray-200 dark:bg-gray-700' : 'bg-green-100'}`}>
              <Text className={`text-xs font-semibold ${item.status === 'sold' ? 'text-red-700' : item.status === 'archived' ? 'text-gray-700 dark:text-gray-200' : 'text-green-700'}`}>
                {statusLabel(item.status)}
              </Text>
            </View>
          </View>
          <Pressable onPress={() => setActionId(actionId === item.id ? null : item.id)} hitSlop={10} className="h-10 w-10 items-center justify-center">
            <MoreHorizontal size={22} color="#6b7280" />
          </Pressable>
        </View>
        {actionId === item.id ? (
          <View className="flex-row flex-wrap gap-2 border-t border-gray-200 p-3 dark:border-gray-700">
            <Pressable onPress={() => { setActionId(null); setEditing(item); }} className="flex-row items-center rounded-xl bg-white px-3 py-2 dark:bg-gray-700">
              <Pencil size={15} color="#0ea5e9" /><Text className="ml-1.5 text-sm text-gray-800 dark:text-white">Düzenle</Text>
            </Pressable>
            {item.status === 'sold' ? (
              <Pressable onPress={() => void updateStatus(item, 'active')} className="flex-row items-center rounded-xl bg-white px-3 py-2 dark:bg-gray-700">
                <RotateCcw size={15} color="#0ea5e9" /><Text className="ml-1.5 text-sm text-gray-800 dark:text-white">Satıldı işaretini kaldır</Text>
              </Pressable>
            ) : item.status === 'archived' ? (
              <Pressable onPress={() => void updateStatus(item, 'active')} className="flex-row items-center rounded-xl bg-white px-3 py-2 dark:bg-gray-700">
                <RotateCcw size={15} color="#0ea5e9" /><Text className="ml-1.5 text-sm text-gray-800 dark:text-white">Yeniden yayınla</Text>
              </Pressable>
            ) : (
              <>
                <Pressable onPress={() => void updateStatus(item, 'sold')} className="rounded-xl bg-white px-3 py-2 dark:bg-gray-700">
                  <Text className="text-sm text-gray-800 dark:text-white">Satıldı olarak işaretle</Text>
                </Pressable>
                <Pressable onPress={() => void updateStatus(item, 'archived')} className="rounded-xl bg-white px-3 py-2 dark:bg-gray-700">
                  <Text className="text-sm text-gray-800 dark:text-white">Arşivle</Text>
                </Pressable>
              </>
            )}
            <Pressable onPress={() => deleteItem(item)} className="flex-row items-center rounded-xl bg-red-50 px-3 py-2 dark:bg-red-950">
              <Trash2 size={15} color="#dc2626" /><Text className="ml-1.5 text-sm text-red-600">Sil</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <>
      <Sheet visible={visible} onClose={onClose} title="İlanlarım" tall>
        {loading ? (
          <ActivityIndicator className="mt-8" color="#0ea5e9" />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={<Text className="py-10 text-center text-gray-500 dark:text-gray-400">Henüz ilan vermedin.</Text>}
          />
        )}
      </Sheet>
      {editing ? (
        <EditListingSheet
          key={editing.id}
          listing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            void load();
            onChanged();
          }}
        />
      ) : null}
    </>
  );
}
