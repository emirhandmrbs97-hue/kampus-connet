import React from 'react';
import { View, Image, Text } from 'react-native';
import { User } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

interface AvatarProps {
  uri?: string;
  name?: string;
  size?: number;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ uri, name, size = 40, className }) => {
  const { isDark } = useTheme();

  const getInitials = (name?: string) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <View
      style={{ width: size, height: size }}
      className={`rounded-full items-center justify-center overflow-hidden ${
        isDark ? 'bg-gray-700' : 'bg-gray-200'
      }`}
    >
      {uri ? (
        <Image source={{ uri }} className="w-full h-full" resizeMode="cover" />
      ) : name ? (
        <Text className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`} style={{ fontSize: size * 0.4 }}>
          {getInitials(name)}
        </Text>
      ) : (
        <User size={size * 0.5} color={isDark ? '#9CA3AF' : '#6B7280'} />
      )}
    </View>
  );
};
