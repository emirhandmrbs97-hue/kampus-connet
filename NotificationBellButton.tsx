import { Bell } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, Text } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export function NotificationBellButton({
  count,
  onPress,
}: {
  count: number;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const hasNotifications = count > 0;

  useEffect(() => {
    cancelAnimation(scale);
    if (hasNotifications) {
      scale.value = withRepeat(
        withSequence(withTiming(1.12, { duration: 650 }), withTiming(1, { duration: 650 })),
        -1,
        true,
      );
    } else {
      scale.value = withTiming(1, { duration: 150 });
    }
    return () => cancelAnimation(scale);
  }, [hasNotifications, scale]);

  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Bildirim merkezi, ${count} okunmamış bildirim` : 'Bildirim merkezi'}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] })}
      className="relative h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"
    >
      <Bell size={20} color="#6b7280" />
      {hasNotifications ? (
        <Animated.View
          style={[
            badgeStyle,
            {
              shadowColor: '#ff1744',
              shadowOpacity: 0.9,
              shadowRadius: 7,
              shadowOffset: { width: 0, height: 0 },
              elevation: 8,
            },
          ]}
          className="absolute -right-1 -top-1 min-h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-[#ff1744] px-1 dark:border-gray-900"
        >
          <Text className="text-[9px] font-extrabold leading-3 text-white">{count > 99 ? '99+' : count}</Text>
        </Animated.View>
      ) : null}
    </Pressable>
  );
}
