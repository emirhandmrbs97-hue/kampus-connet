import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface MessageBubbleProps {
  message: string;
  isOwn: boolean;
  time: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwn, time }) => {
  const { isDark } = useTheme();

  return (
    <View className={`flex-row ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
      <View
        className={`max-w-[70%] px-4 py-2 rounded-2xl ${
          isOwn
            ? 'bg-primary-500 rounded-br-sm'
            : isDark
            ? 'bg-gray-700 rounded-bl-sm'
            : 'bg-gray-200 rounded-bl-sm'
        }`}
      >
        <Text className={isOwn ? 'text-white' : isDark ? 'text-white' : 'text-gray-900'}>
          {message}
        </Text>
        <Text className={`text-xs mt-1 ${isOwn ? 'text-white/70' : isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {time}
        </Text>
      </View>
    </View>
  );
};
