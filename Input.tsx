import React from 'react';
import { TextInput, TextInputProps, View, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, style, ...props }) => {
  const { isDark } = useTheme();

  return (
    <View className="mb-4">
      {label && (
        <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {label}
        </Text>
      )}
      <TextInput
        className={`w-full px-4 py-3 rounded-xl border ${
          error
            ? 'border-red-500'
            : isDark
            ? 'border-gray-600 bg-gray-800 text-white'
            : 'border-gray-300 bg-white text-gray-900'
        }`}
        placeholderTextColor={isDark ? '#9CA3AF' : '#9CA3AF'}
        style={style}
        {...props}
      />
      {error && <Text className="text-red-500 text-sm mt-1">{error}</Text>}
    </View>
  );
};
