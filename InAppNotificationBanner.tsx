import { useCallback, useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { RealtimeNotification } from './hooks/useRealtimeNotifications';
import { StorageImage } from '@/components/StorageImage';

export function InAppNotificationBanner({
  notification,
  onDismiss,
}: {
  notification: RealtimeNotification | null;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-140);
  const opacity = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(translateY);
    cancelAnimation(opacity);

    if (!notification) {
      translateY.value = -140;
      opacity.value = 0;
      return;
    }

    translateY.value = -140;
    opacity.value = 0;
    translateY.value = withSequence(
      withTiming(0, { duration: 380 }),
      withTiming(0, { duration: 2360 }),
      withTiming(-140, { duration: 260 }, (finished) => {
        if (finished) runOnJS(onDismiss)();
      }),
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 300 }),
      withTiming(1, { duration: 2440 }),
      withTiming(0, { duration: 260 }),
    );

    return () => {
      cancelAnimation(translateY);
      cancelAnimation(opacity);
    };
  }, [notification, onDismiss, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
  const dismissWithAnimation = useCallback(() => {
    cancelAnimation(translateY);
    cancelAnimation(opacity);
    translateY.value = withTiming(-140, { duration: 180 }, (finished) => {
      if (finished) runOnJS(onDismiss)();
    });
    opacity.value = withTiming(0, { duration: 160 });
  }, [onDismiss, opacity, translateY]);

  if (!notification) return null;

  const initial = notification.name.trim().charAt(0).toUpperCase() || '?';

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: insets.top + 10, left: 12, right: 12, zIndex: 1000, elevation: 20 }}
    >
      <Animated.View
        style={[
          animatedStyle,
          {
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 7 },
          },
        ]}
      >
        <Pressable
          onPress={dismissWithAnimation}
          accessibilityRole="alert"
          className="flex-row items-center rounded-2xl border border-white/15 bg-gray-950/90 p-3.5"
        >
          {notification.avatarUrl ? (
            <StorageImage uri={notification.avatarUrl} className="h-11 w-11 rounded-full border border-white/20" />
          ) : (
            <View className="h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-primary-900">
              <Text className="font-bold text-primary-100">{initial}</Text>
            </View>
          )}
          <View className="ml-3 flex-1">
            <Text numberOfLines={1} className="font-bold text-white">
              {notification.name}
            </Text>
            <Text numberOfLines={2} className="mt-0.5 text-sm text-gray-200">
              {notification.action}
            </Text>
          </View>
          <View className="ml-2 h-2 w-2 rounded-full bg-sky-400" />
        </Pressable>
      </Animated.View>
    </View>
  );
}
