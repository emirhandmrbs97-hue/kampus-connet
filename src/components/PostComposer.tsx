import { FileText, Camera, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Image, Pressable, Text, TextInput, View } from 'react-native';

import { Button, Sheet } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { pickImage, pickPdf } from '@/services/mediaPicker';
import { uploadMedia } from '@/services/storageService';

type Picked = { kind: 'image' | 'pdf'; uri: string; name?: string };

export function PostComposer({
  visible,
  onClose,
  onPosted,
}: {
  visible: boolean;
  onClose: () => void;
  onPosted: () => void;
}) {
  const { user } = useAuth();
  const [body, setBody] = useState('');
  const [media, setMedia] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setBody('');
    setMedia(null);
  };

  const addImage = async () => {
    const p = await pickImage();
    if (p) setMedia({ kind: 'image', uri: p.uri });
  };
  const addPdf = async () => {
    const p = await pickPdf();
    if (p) setMedia({ kind: 'pdf', uri: p.uri, name: p.name });
  };

  const submit = async () => {
    if (!user) return;
    if (!body.trim() && !media) {
      Alert.alert('Boş gönderi', 'Bir metin yaz ya da fotoğraf / PDF ekle.');
      return;
    }
    setBusy(true);
    try {
      let uploaded: { url: string; kind: 'image' | 'pdf'; fileName?: string } | null = null;
      if (media) {
        uploaded = await uploadMedia(media.uri, { kind: media.kind, folder: 'posts', fileName: media.name });
      }
      const { error } = await supabase.from('posts').insert({
        author_id: user.id,
        body: body.trim(),
        media_url: uploaded?.url ?? null,
        media_type: uploaded?.kind ?? null,
        file_name: uploaded?.fileName ?? null,
      });
      if (error) throw error;
      reset();
      onPosted();
      onClose();
    } catch (e) {
      Alert.alert('Paylaşılamadı', e instanceof Error ? e.message : 'Bir hata oluştu.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Yeni gönderi">
      <TextInput
        className="min-h-[110px] rounded-2xl bg-gray-100 p-4 text-base text-gray-900 dark:bg-gray-800 dark:text-white"
        placeholder="Ne düşünüyorsun?"
        placeholderTextColor="#9ca3af"
        multiline
        textAlignVertical="top"
        value={body}
        onChangeText={setBody}
      />

      {media?.kind === 'image' ? (
        <View className="mt-3">
          <Image source={{ uri: media.uri }} className="h-44 w-full rounded-2xl" resizeMode="cover" />
          <Pressable onPress={() => setMedia(null)} className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5">
            <X size={16} color="#fff" />
          </Pressable>
        </View>
      ) : null}
      {media?.kind === 'pdf' ? (
        <View className="mt-3 flex-row items-center rounded-2xl bg-gray-100 p-3 dark:bg-gray-800">
          <FileText size={22} color="#dc2626" />
          <Text numberOfLines={1} className="ml-3 flex-1 text-gray-900 dark:text-white">
            {media.name}
          </Text>
          <Pressable onPress={() => setMedia(null)} hitSlop={10}>
            <X size={18} color="#9ca3af" />
          </Pressable>
        </View>
      ) : null}

      <View className="my-4 flex-row gap-3">
        <Pressable onPress={addImage} className="flex-1 flex-row items-center justify-center rounded-2xl bg-primary-50 py-3 dark:bg-gray-800">
          <Camera size={18} color="#0ea5e9" />
          <Text className="ml-2 font-semibold text-primary-700 dark:text-primary-300">Fotoğraf</Text>
        </Pressable>
        <Pressable onPress={addPdf} className="flex-1 flex-row items-center justify-center rounded-2xl bg-primary-50 py-3 dark:bg-gray-800">
          <FileText size={18} color="#0ea5e9" />
          <Text className="ml-2 font-semibold text-primary-700 dark:text-primary-300">PDF</Text>
        </Pressable>
      </View>

      <Button title="Paylaş" onPress={submit} loading={busy} />
    </Sheet>
  );
}
