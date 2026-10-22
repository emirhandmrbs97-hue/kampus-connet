import { Camera, FileText, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';

import { AcademicSelectSheet } from '@/components/AcademicSelectSheet';
import { Button, Field, Sheet } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import {
  getStoredMarketplaceCategory,
  MARKETPLACE_CATEGORIES,
  NOTE_CATEGORY_LABEL,
} from '@/constants/marketplaceCategories';
import { supabase } from '@/lib/supabase';
import {
  STANDARD_DEPARTMENTS,
  TURKISH_UNIVERSITY_NAMES,
  validateDepartmentName,
  validateTurkishUniversityName,
} from '@/constants/academicData';
import { pickImage, pickPdf } from '@/services/mediaPicker';
import { uploadMarketplacePdf, uploadMedia } from '@/services/storageService';

export const CATEGORIES = MARKETPLACE_CATEGORIES;
export const CONDITIONS = ['Yeni', 'Az kullanılmış', 'İyi', 'Yıpranmış'];
const GRADE_LEVELS = ['1. Sınıf', '2. Sınıf', '3. Sınıf', '4. Sınıf', 'Yüksek Lisans'];

type PickedPdf = { uri: string; name: string; size: number | null; file?: Blob };

function formatFileSize(size: number | null): string {
  if (size === null) return 'Boyut bilgisi yok';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const [imageFile, setImageFile] = useState<Blob | undefined>();
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [condition, setCondition] = useState(CONDITIONS[2]);
  const [university, setUniversity] = useState('');
  const [department, setDepartment] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [pdf, setPdf] = useState<PickedPdf | null>(null);
  const [academicPicker, setAcademicPicker] = useState<'university' | 'department' | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);
  const isNote = category === NOTE_CATEGORY_LABEL;
  const universityResult = validateTurkishUniversityName(university);
  const departmentResult = validateDepartmentName(department);

  const reset = () => {
    setImage(null);
    setImageFile(undefined);
    setTitle('');
    setPrice('');
    setDescription('');
    setCategory(CATEGORIES[0]);
    setCondition(CONDITIONS[2]);
    setUniversity('');
    setDepartment('');
    setGradeLevel('');
    setPdf(null);
    setErrors({});
  };

  const submit = async () => {
    if (!user) {
      Alert.alert('Giriş gerekli', 'İlan eklemek için hesabına giriş yapmalısın.');
      return;
    }
    const value = Number(price.replace(',', '.'));
    const next = {
      title: title.trim().length < 3 ? 'Başlık en az 3 karakter olmalı.' : undefined,
      description: isNote && !description.trim() ? 'Açıklama zorunludur.' : undefined,
      price:
        !price.trim() || !Number.isFinite(value) || (isNote ? value < 0 : value <= 0)
          ? isNote
            ? '0 veya daha büyük geçerli bir fiyat gir.'
            : 'Geçerli bir fiyat gir.'
          : undefined,
      university: isNote && !universityResult.valid ? 'Listeden geçerli üniversiteyi seç.' : undefined,
      department: isNote && !departmentResult.valid ? 'Listeden geçerli bölüm adını seç.' : undefined,
      gradeLevel: isNote && !gradeLevel ? 'Sınıf düzeyi seçmelisin.' : undefined,
      pdf: isNote && !pdf ? 'Bir PDF dosyası seçmelisin.' : undefined,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setBusy(true);
    try {
      let url: string | null = null;
      let pdfUrl: string | null = null;
      let pdfSize: number | null = null;
      if (isNote && pdf) {
        const uploaded = await uploadMarketplacePdf(pdf.uri, pdf.name, user.id, pdf.file);
        pdfUrl = uploaded.url;
        pdfSize = uploaded.size;
      } else if (image) {
        url = (
          await uploadMedia(image, {
            kind: 'image',
            folder: 'listings',
            file: imageFile,
          })
        ).url;
      }
      const { error } = await supabase.from('listings').insert({
        seller_id: user.id,
        title: title.trim(),
        description: description.trim(),
        price: value,
        category: getStoredMarketplaceCategory(category),
        condition,
        image_url: url,
        pdf_url: pdfUrl,
        pdf_file_name: isNote ? pdf?.name : null,
        pdf_size: isNote ? pdfSize : null,
        university_name: isNote ? universityResult.canonicalName : null,
        department_name: isNote ? departmentResult.canonicalName : null,
        grade_level: isNote ? gradeLevel : null,
      });
      if (error) throw error;
      reset();
      onCreated();
      onClose();
    } catch (error) {
      console.error('Not ekleme hatası:', error);
      const details =
        error && typeof error === 'object'
          ? [
              'message' in error && typeof error.message === 'string' ? error.message : null,
              'details' in error && typeof error.details === 'string' ? error.details : null,
              'hint' in error && typeof error.hint === 'string' ? error.hint : null,
              'code' in error && typeof error.code === 'string' ? `Kod: ${error.code}` : null,
            ].filter((part): part is string => part !== null)
          : [];
      Alert.alert('İlan eklenemedi', details.join('\n') || 'Bir hata oluştu. Ayrıntılar için konsolu kontrol edin.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <Sheet visible={visible} onClose={onClose} title="İlan ver" tall>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!isNote ? (
          <Pressable
            onPress={async () => {
              const p = await pickImage();
              if (p) {
                setImage(p.uri);
                setImageFile(p.file);
              }
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
        ) : null}

        <Field
          label="Başlık"
          placeholder="Örn. Calculus kitabı"
          value={title}
          onChangeText={(value) => {
            setTitle(value);
            setErrors((current) => ({ ...current, title: undefined }));
          }}
          error={errors.title}
        />
        <Field
          label="Fiyat (₺)"
          placeholder="250"
          keyboardType="decimal-pad"
          value={price}
          onChangeText={(value) => {
            setPrice(value);
            setErrors((current) => ({ ...current, price: undefined }));
          }}
          error={errors.price}
        />
        <Field
          label="Açıklama"
          placeholder="Ürün hakkında kısa bilgi"
          multiline
          textAlignVertical="top"
          value={description}
          onChangeText={(value) => {
            setDescription(value);
            setErrors((current) => ({ ...current, description: undefined }));
          }}
          error={errors.description}
        />

        <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Kategori</Text>
        <Chips options={CATEGORIES} value={category} onChange={setCategory} />
        {isNote ? (
          <>
            <Text className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">Üniversite</Text>
            <Pressable
              onPress={() => setAcademicPicker('university')}
              className={`mb-1 flex-row items-center justify-between rounded-2xl border bg-gray-50 px-4 py-3.5 dark:bg-gray-800 ${
                errors.university ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <Text className={university ? 'flex-1 text-gray-900 dark:text-white' : 'flex-1 text-gray-400'}>
                {university || 'Resmî üniversite listesinden seç'}
              </Text>
              <Text className="ml-2 text-primary-600">Seç</Text>
            </Pressable>
            {errors.university ? <Text className="mb-4 mt-1 text-xs text-red-600">{errors.university}</Text> : <View className="mb-4" />}

            <Text className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">Bölüm</Text>
            <Pressable
              onPress={() => setAcademicPicker('department')}
              className={`mb-1 flex-row items-center justify-between rounded-2xl border bg-gray-50 px-4 py-3.5 dark:bg-gray-800 ${
                errors.department ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <Text className={department ? 'flex-1 text-gray-900 dark:text-white' : 'flex-1 text-gray-400'}>
                {department || 'Kategorili bölüm listesinden seç'}
              </Text>
              <Text className="ml-2 text-primary-600">Seç</Text>
            </Pressable>
            {errors.department ? <Text className="mb-4 mt-1 text-xs text-red-600">{errors.department}</Text> : <View className="mb-4" />}
            <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Sınıf / Düzey</Text>
            <Chips
              options={GRADE_LEVELS}
              value={gradeLevel}
              onChange={(value) => {
                setGradeLevel(value);
                setErrors((current) => ({ ...current, gradeLevel: undefined }));
              }}
            />
            {errors.gradeLevel ? <Text className="mb-3 -mt-2 text-xs text-red-600">{errors.gradeLevel}</Text> : null}
            <Pressable
              onPress={async () => {
                const picked = await pickPdf();
                if (picked) {
                  setPdf(picked);
                  setErrors((current) => ({ ...current, pdf: undefined }));
                }
              }}
              className={`mb-2 flex-row items-center rounded-2xl border p-4 ${
                errors.pdf ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
              } bg-gray-50 dark:bg-gray-800`}
            >
              <FileText size={26} color="#dc2626" />
              <View className="ml-3 flex-1">
                <Text numberOfLines={1} className="font-semibold text-gray-900 dark:text-white">
                  {pdf?.name ?? 'PDF dosyası seç'}
                </Text>
                <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {pdf ? formatFileSize(pdf.size) : 'Yalnızca PDF formatı'}
                </Text>
              </View>
              {pdf ? (
                <Pressable onPress={() => setPdf(null)} hitSlop={10}>
                  <X size={18} color="#9ca3af" />
                </Pressable>
              ) : null}
            </Pressable>
            {errors.pdf ? <Text className="mb-4 text-xs text-red-600">{errors.pdf}</Text> : null}
          </>
        ) : (
          <>
            <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Durum</Text>
            <Chips options={CONDITIONS} value={condition} onChange={setCondition} />
          </>
        )}

        <Button title="İlanı yayınla" onPress={submit} loading={busy} />
      </ScrollView>
    </Sheet>
      <AcademicSelectSheet
        visible={academicPicker !== null}
        title={academicPicker === 'university' ? 'Üniversite seç' : 'Bölüm seç'}
        options={academicPicker === 'university' ? TURKISH_UNIVERSITY_NAMES : STANDARD_DEPARTMENTS}
        selectedValue={academicPicker === 'university' ? university : department}
        onSelect={(value) => {
          if (academicPicker === 'university') {
            setUniversity(value);
            setErrors((current) => ({ ...current, university: undefined }));
          } else {
            setDepartment(value);
            setErrors((current) => ({ ...current, department: undefined }));
          }
        }}
        onClose={() => setAcademicPicker(null)}
      />
    </>
  );
}
