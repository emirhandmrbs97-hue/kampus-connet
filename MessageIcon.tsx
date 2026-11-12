import { MessageCircle } from 'lucide-react-native';
import { useEffect } from 'react';
import { Text, View, type ColorValue } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export function MessageIcon({
  color,
  size,
  unreadCount,
}: {
  color: ColorValue;
  size: number;
  unreadCount: number;
}) {
  const badgeScale = useSharedValue(1);
  const hasUnread = unreadCount > 0;

  useEffect(() => {
    cancelAnimation(badgeScale);
    if (hasUnread) {
      badgeScale.value = withRepeat(
        withSequence(
          withTiming(1.13, { duration: 650 }),
          withTiming(1, { duration: 650 }),
        ),
        -1,
        true,
      );
    } else {
      badgeScale.value = withTiming(1, { duration: 150 });
    }

    return () => cancelAnimation(badgeScale);
  }, [badgeScale, hasUnread]);

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));

  return (
    <View style={{ width: size + 12, height: size + 10 }} className="items-center justify-center">
      <MessageCircle color={typeof color === 'string' ? color : '#9ca3af'} size={size} />
      {hasUnread ? (
        <Animated.View
          style={[
            badgeStyle,
            {
              shadowColor: '#ff1744',
              shadowOpacity: 0.9,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 0 },
              elevation: 8,
            },
          ]}
          className="absolute -right-1 -top-1 min-h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-white bg-[#ff1744] px-1 dark:border-gray-900"
        >
          <Text className="text-[10px] font-extrabold leading-3 text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}
