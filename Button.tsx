import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
  style?: ViewStyle;
  textStyle?: TextStyle;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
  textStyle,
  className,
}) => {
  const { isDark } = useTheme();

  const getButtonStyle = () => {
    const baseStyle = 'px-6 py-3 rounded-xl items-center justify-center';
    
    if (disabled || loading) {
      return `${baseStyle} bg-gray-400`;
    }

    switch (variant) {
      case 'primary':
        return `${baseStyle} bg-primary-500`;
      case 'secondary':
        return `${baseStyle} ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`;
      case 'outline':
        return `${baseStyle} border-2 border-primary-500 bg-transparent`;
      default:
        return `${baseStyle} bg-primary-500`;
    }
  };

  const getTextStyle = () => {
    if (disabled || loading) {
      return 'text-white font-semibold';
    }

    switch (variant) {
      case 'primary':
        return 'text-white font-semibold';
      case 'secondary':
        return isDark ? 'text-white font-semibold' : 'text-gray-900 font-semibold';
      case 'outline':
        return 'text-primary-500 font-semibold';
      default:
        return 'text-white font-semibold';
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={className || getButtonStyle()}
      style={style}
    >
      {loading ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text className={getTextStyle()} style={textStyle}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};
