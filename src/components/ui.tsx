import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { StorageImage } from '@/components/StorageImage';

export function Avatar({
  uri,
  name,
  size = 40,
  hasStory = false,
}: {
  uri?: string | null;
  name?: string;
  size?: number;
  hasStory?: boolean;
}) {
  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?';
  const avatarContent = uri ? (
    <StorageImage uri={uri} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="items-center justify-center bg-primary-100 dark:bg-primary-900"
    >
      <Text
        style={{ fontSize: size * 0.4 }}
        className="font-bold text-primary-700 dark:text-primary-200"
      >
        {initial}
      </Text>
    </View>
  );

  if (hasStory) {
    return (
      <View
        style={{
          width: size + 6,
          height: size + 6,
          borderRadius: (size + 6) / 2,
          borderWidth: 3,
          borderColor: '#C13584',
          padding: 2,
        }}
      >
        {avatarContent}
      </View>
    );
  }

  return avatarContent;
}

type ButtonProps = {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'danger' | 'soft';
  className?: string;
};

const BUTTON_BG = {
  primary: 'bg-primary-500 active:bg-primary-600',
  outline: 'border border-gray-300 dark:border-gray-700',
  danger: 'border border-red-500',
  soft: 'bg-primary-50 dark:bg-gray-800',
};
const BUTTON_TEXT = {
  primary: 'text-white',
  outline: 'text-gray-900 dark:text-white',
  danger: 'text-red-600',
  soft: 'text-primary-700 dark:text-primary-300',
};

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  className,
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`items-center rounded-2xl px-5 py-3.5 ${BUTTON_BG[variant]} ${
        disabled ? 'opacity-50' : ''
      } ${className ?? ''}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : '#0ea5e9'} />
      ) : (
        <Text className={`text-base font-semibold ${BUTTON_TEXT[variant]}`}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label?: string; error?: string | null }) {
  return (
    <View className="mb-4">
      {label ? (
        <Text className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">{label}</Text>
      ) : null}
      <TextInput
        placeholderTextColor="#9ca3af"
        {...props}
        className={`rounded-2xl border bg-gray-50 px-4 py-3.5 text-base text-gray-900 dark:bg-gray-800 dark:text-white ${
          error ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
        }`}
      />
      {error ? <Text className="mt-1 text-xs text-red-600">{error}</Text> : null}
    </View>
  );
}

export function Sheet({
  visible,
  onClose,
  title,
  children,
  tall,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  tall?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end"
      >
        <Pressable className="absolute inset-0 bg-black/50" onPress={onClose} />
        <View
          className={`rounded-t-3xl bg-white px-5 pb-8 pt-4 dark:bg-gray-900 ${
            tall ? 'h-[85%]' : 'max-h-[85%]'
          }`}
        >
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-gray-900 dark:text-white">{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={22} color="#9ca3af" />
            </Pressable>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; badge?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row rounded-2xl bg-gray-100 p-1 dark:bg-gray-800">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            className={`flex-1 flex-row items-center justify-center rounded-xl py-2.5 ${
              active ? 'bg-white dark:bg-gray-700' : ''
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                active ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {o.label}
            </Text>
            {o.badge ? (
              <View className="ml-1.5 min-w-[18px] items-center rounded-full bg-primary-500 px-1">
                <Text className="text-xs font-bold text-white">{o.badge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) {
  return (
    <View className="items-center px-8 py-16">
      {icon ? <View className="mb-4">{icon}</View> : null}
      <Text className="text-base font-semibold text-gray-700 dark:text-gray-300">{title}</Text>
      {hint ? (
        <Text className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">{hint}</Text>
      ) : null}
    </View>
  );
}

export function ActionSheet({
  visible,
  onClose,
  options,
}: {
  visible: boolean;
  onClose: () => void;
  options: { label: string; icon: ReactNode; onPress: () => void; destructive?: boolean }[];
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/50" onPress={onClose}>
        <View className="mx-4 mb-8 overflow-hidden rounded-2xl bg-white dark:bg-gray-900">
          {options.map((option, index) => (
            <Pressable
              key={index}
              onPress={() => {
                option.onPress();
                onClose();
              }}
              className={`flex-row items-center border-b border-gray-100 px-4 py-4 dark:border-gray-700 ${
                option.destructive ? '' : 'active:bg-gray-50 dark:active:bg-gray-800'
              }`}
            >
              {option.icon}
              <Text
                className={`ml-3 text-base font-semibold ${
                  option.destructive ? 'text-red-600' : 'text-gray-900 dark:text-white'
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={onClose}
            className="mt-2 flex-row items-center justify-center rounded-2xl bg-gray-100 px-4 py-4 dark:bg-gray-800"
          >
            <Text className="text-base font-semibold text-gray-900 dark:text-white">İptal</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

export function FullScreenImage({
  visible,
  onClose,
  uri,
}: {
  visible: boolean;
  onClose: () => void;
  uri: string | null;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black" onPress={onClose}>
        {uri ? (
          <StorageImage uri={uri} className="flex-1" resizeMode="contain" />
        ) : null}
        <Pressable
          onPress={onClose}
          className="absolute top-8 right-4 h-10 w-10 items-center justify-center rounded-full bg-black/50"
        >
          <X size={24} color="#fff" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
