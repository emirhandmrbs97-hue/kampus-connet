import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface ProductCardProps {
  id: string;
  title: string;
  price: number;
  category: string;
  image?: string;
  onPress: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  title,
  price,
  category,
  image,
  onPress,
}) => {
  const { isDark } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-1 m-2 rounded-xl overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-md`}
    >
      {image ? (
        <Image source={{ uri: image }} className="w-full h-32" resizeMode="cover" />
      ) : (
        <View className="w-full h-32 bg-gray-300 items-center justify-center">
          <Text className="text-gray-500">Resim Yok</Text>
        </View>
      )}
      <View className="p-3">
        <Text className={`text-sm font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`} numberOfLines={2}>
          {title}
        </Text>
        <Text className={`text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {category}
        </Text>
        <Text className="text-lg font-bold text-primary-500">
          ₺{price.toLocaleString()}
        </Text>
      </View>
    </TouchableOpacity>
  );
};
