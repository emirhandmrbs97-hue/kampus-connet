import { FileText, Camera, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, Text, TextInput, View } from 'react-native';

import { Avatar, Button, Sheet } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { searchMentionCandidates, type MentionCandidate } from '@/services/mentions';
import { supabase } from '@/lib/supabase';
import { pickImage, pickPdf } from '@/services/mediaPicker';
import { uploadMedia } from '@/services/storageService';

type Picked = { kind: 'image' | 'pdf'; uri: string; name?: string; file?: Blob };

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
  const { t } = useLanguage();
  const [body, setBody] = useState('');
  const [media, setMedia] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false);
  const [mentionCandidates, setMentionCandidates] = useState<MentionCandidate[]>([]);

  const searchMentions = useCallback(async (value: string) => {
    const match = value.match(/(?:^|\s)@([a-zA-Z0-9._]{1,20})$/);
    if (!match) {
      setMentionCandidates([]);
      return;
    }
    try {
      setMentionCandidates(await searchMentionCandidates(match[1] ?? ''));
    } catch (error) {
      console.error('Gönderi mention araması başarısız:', error);
      setMentionCandidates([]);
    }
  }, []);

  const reset = () => {
    setBody('');
    setMedia(null);
  };

  const addImage = async () => {
    const p = await pickImage();
    if (p) setMedia({ kind: 'image', uri: p.uri, name: p.name, file: p.file });
  };
  const addPdf = async () => {
    const p = await pickPdf();
    if (p) setMedia({ kind: 'pdf', uri: p.uri, name: p.name, file: p.file });
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
        uploaded = await uploadMedia(media.uri, {
          kind: media.kind,
          folder: 'posts',
          fileName: media.name,
          file: media.file,
        });
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
    <Sheet visible={visible} onClose={onClose} title={t('newPost')}>
      <TextInput
        className="min-h-[110px] rounded-2xl bg-gray-100 p-4 text-base text-gray-900 dark:bg-gray-800 dark:text-white"
        placeholder={t('postThought')}
        placeholderTextColor="#9ca3af"
        multiline
        textAlignVertical="top"
        value={body}
        onChangeText={(value) => {
          setBody(value);
          void searchMentions(value);
        }}
      />
      {mentionCandidates.length ? (
        <View className="mt-2 max-h-36 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          {mentionCandidates.map((candidate) => (
            <Pressable
              key={candidate.id}
              onPress={() => {
                setBody((current) =>
                  current.replace(/(?:^|\s)@[a-zA-Z0-9._]{1,20}$/, (match) => {
                    const prefix = match.startsWith(' ') ? ' ' : '';
                    return `${prefix}@${candidate.username} `;
                  }),
                );
                setMentionCandidates([]);
              }}
              className="flex-row items-center border-b border-gray-100 px-3 py-2 dark:border-gray-700"
            >
              <Avatar uri={candidate.avatar_url} name={candidate.full_name} size={30} />
              <View className="ml-2">
                <Text className="font-semibold text-gray-900 dark:text-white">@{candidate.username}</Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400">{candidate.full_name}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

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
          <Text className="ml-2 font-semibold text-primary-700 dark:text-primary-300">{t('addPhoto')}</Text>
        </Pressable>
        <Pressable onPress={addPdf} className="flex-1 flex-row items-center justify-center rounded-2xl bg-primary-50 py-3 dark:bg-gray-800">
          <FileText size={18} color="#0ea5e9" />
          <Text className="ml-2 font-semibold text-primary-700 dark:text-primary-300">{t('addPdf')}</Text>
        </Pressable>
      </View>

      <Button title="Paylaş" onPress={submit} loading={busy} />
    </Sheet>
  );
}
