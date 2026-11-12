import { X } from 'lucide-react-native';
import { useEffect } from 'react';
import { Modal, Pressable } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StorageImage } from '@/components/StorageImage';

export function ImageViewerModal({
  visible,
  uri,
  onClose,
}: {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = 1;
      savedScale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
    }
  }, [visible, uri, scale, savedScale, translateX, translateY]);

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.max(1, Math.min(savedScale.value * event.scale, 4));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (scale.value > 1) {
        translateX.value = startX.value + event.translationX;
        translateY.value = startY.value + event.translationY;
      } else {
        translateY.value = Math.max(0, event.translationY);
      }
    })
    .onEnd((event) => {
      if (scale.value <= 1 && event.translationY > 110) {
        runOnJS(onClose)();
        return;
      }
      if (scale.value <= 1) {
        translateY.value = withSpring(0);
      }
    });

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0.35, 1 - translateY.value / 500),
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView className="flex-1 bg-black">
        <Animated.View style={[{ flex: 1 }, backdropStyle]}>
          <GestureDetector gesture={Gesture.Simultaneous(pinch, pan)}>
            <Animated.View className="flex-1 items-center justify-center">
              {uri ? (
                <Animated.View style={[{ width: '100%', height: '100%' }, imageStyle]}>
                  <StorageImage uri={uri} resizeMode="contain" className="h-full w-full" />
                </Animated.View>
              ) : null}
            </Animated.View>
          </GestureDetector>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Görseli kapat"
            hitSlop={12}
            style={{ top: insets.top + 12 }}
            className="absolute right-4 h-11 w-11 items-center justify-center rounded-full bg-black/55"
          >
            <X size={24} color="#fff" />
          </Pressable>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}
