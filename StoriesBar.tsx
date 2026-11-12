import { Plus } from 'lucide-react-native';
import { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { Avatar } from '@/components/ui';
import { StoryViewer } from '@/components/StoryViewer';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import { supabase } from '@/lib/supabase';
import { pickImage } from '@/services/mediaPicker';
import { fetchProfiles } from '@/services/profiles';
import { uploadMedia } from '@/services/storageService';
import type { Profile, StoryGroup, StoryRow } from '@/types';

export type StoriesBarHandle = { reload: () => Promise<void> };

export const StoriesBar = forwardRef<StoriesBarHandle>(function StoriesBar(_props, ref) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [viewerStart, setViewerStart] = useState<number | null>(null);
  const [uploadingStory, setUploadingStory] = useState(false);

  const reload = useCallback(async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: true });
    if (error) {
      if (__DEV__) console.error('[stories] Query failed:', error.message);
      throw new Error(`Hikayeler yüklenemedi: ${error.message}`);
    }
    const rows = (data ?? []) as StoryRow[];
    if (__DEV__) {
      console.debug('[stories] Query result:', {
        since,
        rowCount: rows.length,
        rows: rows.map(({ created_at, media_url }) => ({
          created_at,
          hasMedia: Boolean(media_url),
        })),
      });
    }
    const profiles = await fetchProfiles(rows.map((r) => r.author_id));
    const missingProfile = rows.find((row) => !profiles[row.author_id]);
    if (missingProfile) {
      if (__DEV__) {
        console.warn('[stories] Story rows were returned but an author profile is missing.');
      }
      throw new Error('Hikaye sahibi profili yüklenemedi.');
    }
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
    if (__DEV__) {
      console.debug('[stories] Grouped result:', {
        groupCount: list.length,
        storyCount: list.reduce((total, group) => total + group.items.length, 0),
      });
    }
    setGroups(list);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void reload().catch((error: unknown) => {
        console.error('[stories] Failed to load stories:', error instanceof Error ? error.message : error);
      });
    }, [reload]),
  );

  useImperativeHandle(ref, () => ({ reload }), [reload]);

  const addStory = async () => {
    if (!user || uploadingStory) return;
    setUploadingStory(true);
    let stage: 'image selection' | 'storage upload' | 'story record' = 'image selection';
    try {
      const picked = await pickImage();
      if (!picked) return;
      const author = profile ?? (await fetchProfiles([user.id]))[user.id];
      if (!author) throw new Error('Profil bilgisi yüklenemedi.');
      stage = 'storage upload';
      const media = await uploadMedia(picked.uri, {
        kind: 'image',
        folder: 'stories',
        fileName: picked.fileName,
        mimeType: picked.mimeType,
      });
      stage = 'story record';
      const { data, error } = await supabase
        .from('stories')
        .insert({ author_id: user.id, media_url: media.path })
        .select('*')
        .single();
      if (error) throw error;
      if (!data) throw new Error('Supabase hikaye kaydı döndürmedi.');

      const createdStory = data as StoryRow;
      setGroups((current) => {
        const existing = current.find((group) => group.author.id === user.id);
        const ownStories = [...(existing?.items ?? []), createdStory].sort(
          (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
        );
        const next = current.filter((group) => group.author.id !== user.id);
        next.unshift({ author, items: ownStories });
        return next;
      });
      void reload().catch((loadError: unknown) => {
        console.error('[stories] Failed to refresh after upload:', loadError instanceof Error ? loadError.message : loadError);
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Bir hata oluştu.';
      console.warn(`[stories] Failed during ${stage}:`, message);
      Alert.alert(
        'Hikaye paylaşılamadı',
        `${stage === 'storage upload' ? 'Görsel depolamaya yüklenemedi' : stage === 'story record' ? 'Hikaye veritabanına kaydedilemedi' : 'Hikaye hazırlanamadı'}: ${message}`,
      );
    } finally {
      setUploadingStory(false);
    }
  };

  const closeViewer = useCallback(() => setViewerStart(null), []);
  const markSeen = useCallback((authorId: string) => {
    setSeen((prev) => new Set(prev).add(authorId));
  }, []);

  const ownGroup = groups.find((g) => g.author.id === user?.id);
  const others = groups.filter((g) => g.author.id !== user?.id);
  const viewerGroups = ownGroup ? [ownGroup, ...others] : others;

  const openStory = (authorId: string) => {
    const index = viewerGroups.findIndex((group) => group.author.id === authorId);
    if (index < 0 || viewerGroups[index]?.items.length === 0) {
      Alert.alert('Hikaye bulunamadı', 'Bu kullanıcının şu anda görüntülenebilir hikayesi yok.');
      void reload().catch((error: unknown) => {
        console.error('[stories] Failed to refresh missing story:', error instanceof Error ? error.message : error);
      });
      return;
    }
    setViewerStart(index);
  };

  const Ring = ({
    author,
    isSeen,
    onPress,
    label,
    badge,
  }: {
    author: Profile | { full_name: string; avatar_url: string | null };
    isSeen?: boolean;
    onPress: () => void;
    label: string;
    badge?: boolean;
  }) => {
    const seenColor = '#9ca3af';
    const gradientId = `story-ring-${label.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.storyItem,
          { opacity: pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
        ]}
      >
        <View
          style={[styles.storyRing, !isSeen && styles.unseenStoryRing]}
        >
          <Svg width={68} height={68} viewBox="0 0 68 68" style={StyleSheet.absoluteFill}>
            {!isSeen ? (
              <Defs>
                <LinearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#f97316" />
                  <Stop offset="52%" stopColor="#ec4899" />
                  <Stop offset="100%" stopColor="#8b5cf6" />
                </LinearGradient>
              </Defs>
            ) : null}
            <Circle
              cx="34"
              cy="34"
              r="31"
              fill="none"
              stroke={isSeen ? seenColor : `url(#${gradientId})`}
              strokeWidth="3"
            />
          </Svg>
          <Avatar uri={author.avatar_url} name={author.full_name} size={60} />
          {badge ? (
            <Pressable
              onPress={addStory}
              hitSlop={8}
              style={styles.addStoryBadge}
            >
              {uploadingStory ? <ActivityIndicator size="small" color="#fff" /> : <Plus size={14} color="#fff" />}
            </Pressable>
          ) : null}
        </View>
        <Text numberOfLines={1} style={styles.storyLabel} className="text-gray-700 dark:text-gray-300">
          {label}
        </Text>
      </Pressable>
    );
  };

  const data: StoryGroup[] = others;

  return (
    <View style={styles.storiesContainer}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.storiesList}
        contentContainerStyle={styles.storiesContent}
        data={data}
        keyExtractor={(g) => g.author.id}
        ListHeaderComponent={
          profile ? (
            <Ring
              author={profile}
              isSeen={false}
              label="Hikayen"
              badge
              onPress={() => (ownGroup ? openStory(ownGroup.author.id) : addStory())}
            />
          ) : undefined
        }
        renderItem={({ item }) => (
          <Ring
            author={item.author}
            isSeen={seen.has(item.author.id)}
            label={item.author.username}
            onPress={() => openStory(item.author.id)}
          />
        )}
      />
      <StoryViewer
        visible={viewerStart !== null}
        groups={viewerGroups}
        startIndex={viewerStart ?? 0}
        onClose={closeViewer}
        onSeen={markSeen}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  storiesContainer: {
    minHeight: 112,
    overflow: 'visible',
    paddingTop: 16,
    paddingBottom: 12,
  },
  storiesList: {
    minHeight: 94,
    overflow: 'visible',
  },
  storiesContent: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  storyItem: {
    alignItems: 'center',
    flexDirection: 'column',
    marginRight: 16,
    width: 84,
  },
  storyRing: {
    alignItems: 'center',
    borderRadius: 34,
    height: 68,
    justifyContent: 'center',
    position: 'relative',
    width: 68,
  },
  unseenStoryRing: {
    elevation: 5,
    shadowColor: '#f43f8e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 7,
  },
  addStoryBadge: {
    alignItems: 'center',
    backgroundColor: '#0ea5e9',
    borderColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    bottom: 0,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    width: 24,
  },
  storyLabel: {
    marginTop: 6,
    textAlign: 'center',
    width: '100%',
    fontSize: 12,
  },
});
