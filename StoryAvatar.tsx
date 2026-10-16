import React from 'react';
import { View, TouchableOpacity, Image, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface StoryAvatarProps {
  uri?: string;
  name?: string;
  onPress: () => void;
  hasStory?: boolean;
}

export const StoryAvatar: React.FC<StoryAvatarProps> = ({
  uri,
  name,
  onPress,
  hasStory = true,
}) => {
  const { isDark } = useTheme();

  return (
    <TouchableOpacity onPress={onPress} className="items-center mr-3">
      <View
        className={`p-1 rounded-full ${
          hasStory ? 'bg-gradient-to-r from-primary-400 to-primary-600' : 'bg-gray-300'
        }`}
      >
        <View className={`p-1 rounded-full ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
          {uri ? (
            <Image
              source={{ uri }}
              className="w-16 h-16 rounded-full"
              resizeMode="cover"
            />
          ) : (
            <View className="w-16 h-16 rounded-full bg-gray-300 items-center justify-center">
              <View className="w-14 h-14 rounded-full bg-gray-400" />
            </View>
          )}
        </View>
      </View>
      <Text className={`text-xs mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`} numberOfLines={1}>
        {name}
      </Text>
    </TouchableOpacity>
  );
};
