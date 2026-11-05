import { X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Modal, Pressable, StatusBar, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui';
import { timeAgo } from '@/lib/format';
import type { StoryGroup } from '@/types';

const DURATION = 5000;

export function StoryViewer({
  visible,
  groups,
  startIndex,
  onClose,
  onSeen,
}: {
  visible: boolean;
  groups: StoryGroup[];
  startIndex: number;
  onClose: () => void;
  onSeen: (authorId: string) => void;
}) {
  const [gi, setGi] = useState(startIndex);
  const [ii, setIi] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const group = groups[gi];
  const item = group?.items[ii];

  useEffect(() => {
    if (visible) {
      setGi(startIndex);
      setIi(0);
    }
  }, [visible, startIndex]);

  const goNext = useCallback(() => {
    if (!group) return;
    if (ii < group.items.length - 1) setIi(ii + 1);
    else if (gi < groups.length - 1) {
      setGi(gi + 1);
      setIi(0);
    } else onClose();
  }, [gi, ii, group, groups.length, onClose]);

  const goPrev = useCallback(() => {
    if (ii > 0) setIi(ii - 1);
    else if (gi > 0) {
      setGi(gi - 1);
      setIi(0);
    }
  }, [gi, ii]);

  useEffect(() => {
    if (!visible || !item) return;
    onSeen(item.author_id);
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished) goNext();
    });
    return () => anim.stop();
  }, [visible, item, progress, goNext, onSeen]);

  if (!visible || !group || !item) return null;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar hidden />
      <View className="flex-1 bg-black">
        <Image source={{ uri: item.media_url }} resizeMode="contain" className="absolute inset-0 h-full w-full" />

        <View className="absolute inset-0 flex-row">
          <Pressable className="flex-1" onPress={goPrev} />
          <Pressable className="flex-1" onPress={goNext} />
        </View>

        <SafeAreaView pointerEvents="box-none" className="absolute left-0 right-0 top-0 px-3">
          <View className="mt-1 flex-row gap-1">
            {group.items.map((s, idx) => (
              <View key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
                <Animated.View
                  className="h-full bg-white"
                  style={{
                    width:
                      idx < ii
                        ? '100%'
                        : idx === ii
                          ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                          : '0%',
                  }}
                />
              </View>
            ))}
          </View>
          <View className="mt-3 flex-row items-center">
            <Avatar uri={group.author.avatar_url} name={group.author.full_name} size={36} />
            <Text className="ml-2 font-semibold text-white">{group.author.username}</Text>
            <Text className="ml-2 text-xs text-white/70">{timeAgo(item.created_at)}</Text>
            <Pressable onPress={onClose} hitSlop={14} className="ml-auto">
              <X size={26} color="#fff" />
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
