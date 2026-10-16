import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { ProductCard } from '../../components/marketplace/ProductCard';
import { Button } from '../../components/ui/Button';
import { Plus, Search } from 'lucide-react-native';

// Mock data
const mockProducts = [
  {
    id: '1',
    title: 'iPhone 13 - Kullanılmış',
    price: 15000,
    category: 'Elektronik',
    image: '',
  },
  {
    id: '2',
    title: 'Ders Kitapları Seti',
    price: 500,
    category: 'Kitap',
    image: '',
  },
  {
    id: '3',
    title: 'Bisiklet - Yeni',
    price: 3000,
    category: 'Spor',
    image: '',
  },
  {
    id: '4',
    title: 'Masaüstü Bilgisayar',
    price: 8000,
    category: 'Elektronik',
    image: '',
  },
  {
    id: '5',
    title: 'Kulaklık - Bluetooth',
    price: 800,
    category: 'Elektronik',
    image: '',
  },
  {
    id: '6',
    title: 'Yatak - Tek Kişilik',
    price: 1200,
    category: 'Mobilya',
    image: '',
  },
];

const categories = ['Tümü', 'Elektronik', 'Kitap', 'Spor', 'Mobilya', 'Giyim'];

export default function MarketplaceScreen() {
  const { isDark } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState('Tümü');
  const [showAddModal, setShowAddModal] = useState(false);

  const filteredProducts = selectedCategory === 'Tümü'
    ? mockProducts
    : mockProducts.filter(p => p.category === selectedCategory);

  const renderProduct = ({ item }: { item: any }) => (
    <ProductCard
      id={item.id}
      title={item.title}
      price={item.price}
      category={item.category}
      image={item.image}
      onPress={() => console.log('Product pressed:', item.id)}
    />
  );

  return (
    <View className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Header */}
      <View className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <View className="flex-row items-center justify-between">
          <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Pazar
          </Text>
          <TouchableOpacity
            onPress={() => setShowAddModal(true)}
            className="bg-primary-500 p-2 rounded-full"
          >
            <Plus size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View className="px-4 py-3">
        <View className={`flex-row items-center px-4 py-2 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
          <Search size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
          <Text className={`ml-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Ara...
          </Text>
        </View>
      </View>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-4 py-2"
      >
        {categories.map((category) => (
          <TouchableOpacity
            key={category}
            onPress={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-full mr-2 ${
              selectedCategory === category
                ? 'bg-primary-500'
                : isDark
                ? 'bg-gray-800'
                : 'bg-gray-200'
            }`}
          >
            <Text
              className={`${
                selectedCategory === category ? 'text-white' : isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Products Grid */}
      <FlatList
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerClassName="p-2"
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Text className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Bu kategoride ürün yok
            </Text>
          </View>
        }
      />

      {/* Add Listing Modal - Placeholder */}
      {showAddModal && (
        <View className="absolute inset-0 bg-black/50 items-center justify-center p-4">
          <View className={`w-full rounded-2xl p-6 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <Text className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              İlan Ekle
            </Text>
            <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              İlan ekleme formu buraya gelecek
            </Text>
            <Button
              title="Kapat"
              onPress={() => setShowAddModal(false)}
              className="mt-4"
            />
          </View>
        </View>
      )}
    </View>
  );
}
