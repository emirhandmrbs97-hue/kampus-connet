import { Camera, ImageIcon, Plus } from 'lucide-react-native';
import { router } from 'expo-router';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';

import { ActionSheet, Avatar } from '@/components/ui';
import { StoryViewer } from '@/components/StoryViewer';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useProfile } from '@/context/ProfileContext';
import { supabase } from '@/lib/supabase';
import { pickImage } from '@/services/mediaPicker';
import { fetchProfiles } from '@/services/profiles';
import { uploadMedia } from '@/services/storageService';
import type { Profile, StoryGroup, StoryRow } from '@/types';

export type StoriesBarHandle = { reload: () => Promise<void> };

export const StoriesBar = forwardRef<StoriesBarHandle>(function StoriesBar(_props, ref) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { profile } = useProfile();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [viewerStart, setViewerStart] = useState<number | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [fullScreenImageVisible, setFullScreenImageVisible] = useState(false);

  const reload = useCallback(async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('stories')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: true });
    const rows = (data ?? []) as StoryRow[];
    const profiles = await fetchProfiles(rows.map((r) => r.author_id));
    const map = new Map<string, StoryGroup>();
    rows.forEach((r) => {
      const author = profiles[r.author_id];
      if (!author) return;
      const g = map.get(r.author_id) ?? { author, items: [] };
      g.items.push(r);
      map.set(r.author_id, g);
    });
    const list = Array.from(map.values());
    // Kendi hikayelerin başta
    list.sort((a, b) => (a.author.id === user?.id ? -1 : b.author.id === user?.id ? 1 : 0));
    setGroups(list);
  }, [user?.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  useImperativeHandle(ref, () => ({ reload }), [reload]);

  const addStory = async () => {
    if (!user) return;
    const picked = await pickImage();
    if (!picked) return;
    try {
      const media = await uploadMedia(picked.uri, {
        kind: 'image',
        folder: 'stories',
        fileName: picked.name,
        file: picked.file,
      });
      const { error } = await supabase
        .from('stories')
        .insert({ author_id: user.id, media_url: media.url });
      if (error) throw error;
      await reload();
    } catch (e) {
      Alert.alert('Hikaye paylaşılamadı', e instanceof Error ? e.message : 'Bir hata oluştu.');
    }
  };

  const closeViewer = useCallback(() => setViewerStart(null), []);
  const markSeen = useCallback((authorId: string) => {
    setSeen((prev) => new Set(prev).add(authorId));
  }, []);

  const handleAvatarPress = (author: Profile, hasStory: boolean) => {
    if (hasStory) {
      setSelectedProfile(author);
      setActionSheetVisible(true);
    } else if (author.avatar_url) {
      setSelectedProfile(author);
      setFullScreenImageVisible(true);
    }
  };

  const handleViewStory = () => {
    setActionSheetVisible(false);
    if (selectedProfile) {
      const index = groups.findIndex((g) => g.author.id === selectedProfile.id);
      if (index !== -1) setViewerStart(index);
    }
  };

  const handleViewProfilePhoto = () => {
    setActionSheetVisible(false);
    if (selectedProfile?.avatar_url) {
      setFullScreenImageVisible(true);
    }
  };

  const ownGroup = groups.find((g) => g.author.id === user?.id);
  const others = groups.filter((g) => g.author.id !== user?.id);

  const Ring = ({
    author,
    isSeen,
    onPress,
    label,
    badge,
    hasStory,
  }: {
    author: Profile | { full_name: string; avatar_url: string | null };
    isSeen?: boolean;
    onPress: () => void;
    label: string;
    badge?: boolean;
    hasStory?: boolean;
  }) => (
    <View className="mr-4 w-[68px] items-center">
      <View
        className={`rounded-full border-2 p-[2px] ${
          isSeen ? 'border-gray-300 dark:border-gray-600' : 'border-primary-500'
        }`}
      >
        <Pressable
          onPress={() => {
            if ('id' in author) handleAvatarPress(author, hasStory || false);
          }}
          accessibilityRole="link"
        >
          <Avatar uri={author.avatar_url} name={author.full_name} size={56} />
        </Pressable>
        {badge ? (
          <Pressable
            onPress={addStory}
            hitSlop={8}
            className="absolute -bottom-1 -right-1 h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-primary-500 dark:border-gray-900"
          >
            <Plus size={14} color="#fff" />
          </Pressable>
        ) : null}
      </View>
      <Pressable onPress={onPress}>
        <Text numberOfLines={1} className="mt-1.5 text-xs text-gray-700 dark:text-gray-300">
          {label}
        </Text>
      </Pressable>
    </View>
  );

  const data: StoryGroup[] = others;

  return (
    <View className="pb-2 pt-3">
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        data={data}
        keyExtractor={(g) => g.author.id}
        ListHeaderComponent={
          profile ? (
            <Ring
              author={profile}
              isSeen={false}
              label={t('yourStory')}
              badge
              onPress={() => (ownGroup ? setViewerStart(0) : addStory())}
            />
          ) : null
        }
        renderItem={({ item, index }) => (
          <Ring
            author={item.author}
            isSeen={seen.has(item.author.id)}
            label={item.author.username}
            hasStory={true}
            onPress={() => {
              const index = groups.findIndex((group) => group.author.id === item.author.id);
              if (index !== -1) setViewerStart(index);
            }}
          />
        )}
      />
      <StoryViewer
        visible={viewerStart !== null}
        groups={ownGroup ? [ownGroup, ...others] : others}
        startIndex={viewerStart ?? 0}
        onClose={closeViewer}
        onSeen={markSeen}
      />

      <ActionSheet
        visible={actionSheetVisible}
        onClose={() => setActionSheetVisible(false)}
        options={[
          {
            label: 'Hikayeyi Görüntüle',
            icon: <Camera size={20} color="#0ea5e9" />,
            onPress: handleViewStory,
          },
          {
            label: 'Profil Fotoğrafını Gör',
            icon: <ImageIcon size={20} color="#0ea5e9" />,
            onPress: handleViewProfilePhoto,
          },
        ]}
      />

    </View>
  );
});
