import React from 'react';
import { Modal as RNModal, View, Text, TouchableOpacity, Pressable } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ visible, onClose, title, children }) => {
  const { isDark } = useTheme();

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/50 justify-end"
        onPress={onClose}
      >
        <Pressable className={`w-full rounded-t-3xl p-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`} onPress={(e) => e.stopPropagation()}>
          <View className="flex-row items-center justify-between mb-4">
            {title && (
              <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {title}
              </Text>
            )}
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={isDark ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </RNModal>
  );
};
