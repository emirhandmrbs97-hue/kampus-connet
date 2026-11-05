import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export const Toggle: React.FC<ToggleProps> = ({ value, onValueChange }) => {
  const { isDark } = useTheme();

  return (
    <TouchableOpacity
      onPress={() => onValueChange(!value)}
      className={`w-12 h-7 rounded-full p-1 transition-colors ${
        value ? 'bg-primary-500' : isDark ? 'bg-gray-600' : 'bg-gray-300'
      }`}
    >
      <View
        className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
          value ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </TouchableOpacity>
  );
};
