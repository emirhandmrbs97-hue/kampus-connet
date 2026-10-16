import { Camera } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Field, Sheet } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { pickImage } from '@/services/mediaPicker';
import { uploadMedia } from '@/services/storageService';

export const CATEGORIES = ['Kitap', 'Elektronik', 'Ev & Yurt', 'Giyim', 'Diğer'];
export const CONDITIONS = ['Yeni', 'Az kullanılmış', 'İyi', 'Yıpranmış'];

function Chips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View className="mb-4 flex-row flex-wrap gap-2">
      {options.map((o) => (
        <Pressable
          key={o}
          onPress={() => onChange(o)}
          className={`rounded-full border px-4 py-2 ${
            value === o ? 'border-primary-500 bg-primary-500' : 'border-gray-300 dark:border-gray-700'
          }`}
        >
          <Text className={value === o ? 'text-white' : 'text-gray-700 dark:text-gray-300'}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function NewListingModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [image, setImage] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [condition, setCondition] = useState(CONDITIONS[2]);
  const [errors, setErrors] = useState<{ title?: string; price?: string }>({});
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setImage(null);
    setTitle('');
    setPrice('');
    setDescription('');
    setCategory(CATEGORIES[0]);
    setCondition(CONDITIONS[2]);
    setErrors({});
  };

  const submit = async () => {
    if (!user) return;
    const value = Number(price.replace(',', '.'));
    const next = {
      title: title.trim().length < 3 ? 'Başlık en az 3 karakter olmalı.' : undefined,
      price: !Number.isFinite(value) || value <= 0 ? 'Geçerli bir fiyat gir.' : undefined,
    };
    setErrors(next);
    if (next.title || next.price) return;

    setBusy(true);
    try {
      let url: string | null = null;
      if (image) {
        url = (await uploadMedia(image, { kind: 'image', folder: 'listings' })).url;
      }
      const { error } = await supabase.from('listings').insert({
        seller_id: user.id,
        title: title.trim(),
        description: description.trim(),
        price: value,
        category,
        condition,
        image_url: url,
      });
      if (error) throw error;
      reset();
      onCreated();
      onClose();
    } catch (e) {
      Alert.alert('İlan eklenemedi', e instanceof Error ? e.message : 'Bir hata oluştu.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="İlan ver" tall>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Pressable
          onPress={async () => {
            const p = await pickImage();
            if (p) setImage(p.uri);
          }}
          className="mb-4 h-44 items-center justify-center overflow-hidden rounded-3xl bg-gray-100 dark:bg-gray-800"
        >
          {image ? (
            <Image source={{ uri: image }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <>
              <Camera size={30} color="#9ca3af" />
              <Text className="mt-2 text-gray-500 dark:text-gray-400">Fotoğraf ekle</Text>
            </>
          )}
        </Pressable>

        <Field label="Başlık" placeholder="Örn. Calculus kitabı" value={title} onChangeText={setTitle} error={errors.title} />
        <Field
          label="Fiyat (₺)"
          placeholder="250"
          keyboardType="decimal-pad"
          value={price}
          onChangeText={setPrice}
          error={errors.price}
        />
        <Field
          label="Açıklama"
          placeholder="Ürün hakkında kısa bilgi"
          multiline
          textAlignVertical="top"
          value={description}
          onChangeText={setDescription}
        />

        <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Kategori</Text>
        <Chips options={CATEGORIES} value={category} onChange={setCategory} />
        <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Durum</Text>
        <Chips options={CONDITIONS} value={condition} onChange={setCondition} />

        <Button title="İlanı yayınla" onPress={submit} loading={busy} />
      </ScrollView>
    </Sheet>
  );
}
