import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { StoryAvatar } from '../../components/feed/StoryAvatar';
import { PostCard } from '../../components/feed/PostCard';
import { Plus } from 'lucide-react-native';

// Mock data
const mockStories = [
  { id: '1', name: 'Ahmet', uri: '', hasStory: true },
  { id: '2', name: 'Ayşe', uri: '', hasStory: true },
  { id: '3', name: 'Mehmet', uri: '', hasStory: true },
  { id: '4', name: 'Fatma', uri: '', hasStory: true },
  { id: '5', name: 'Ali', uri: '', hasStory: false },
];

const mockPosts = [
  {
    id: '1',
    user: { name: 'Ahmet Yılmaz', username: 'ahmetyilmaz', avatar: '' },
    content: 'Bugün kampüste çok güzel bir gün! 🌞',
    image: '',
    pdf: '',
    likes: 42,
    comments: 8,
  },
  {
    id: '2',
    user: { name: 'Ayşe Demir', username: 'aysedemir', avatar: '' },
    content: 'Ders notlarını paylaşıyorum, ihtiyacı olanlar alabilir 📚',
    image: '',
    pdf: 'https://example.com/notes.pdf',
    likes: 156,
    comments: 23,
  },
  {
    id: '3',
    user: { name: 'Mehmet Kaya', username: 'mehmetkaya', avatar: '' },
    content: 'Kütüphanede çalışıyoruz, kimse gelmez misiniz? 📖',
    image: '',
    pdf: '',
    likes: 89,
    comments: 15,
  },
];

export default function FeedScreen() {
  const { isDark } = useTheme();

  const renderStory = ({ item }: { item: any }) => (
    <StoryAvatar
      uri={item.uri}
      name={item.name}
      hasStory={item.hasStory}
      onPress={() => console.log('Story pressed:', item.id)}
    />
  );

  const renderPost = ({ item }: { item: any }) => (
    <PostCard
      id={item.id}
      user={item.user}
      content={item.content}
      image={item.image}
      pdf={item.pdf}
      likes={item.likes}
      comments={item.comments}
      onLike={() => console.log('Liked:', item.id)}
      onComment={() => console.log('Comment:', item.id)}
      onShare={() => console.log('Share:', item.id)}
    />
  );

  return (
    <ScrollView className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Header */}
      <View className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Akış
        </Text>
      </View>

      {/* Stories */}
      <View className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <View className="flex-row">
          {/* Add Story Button */}
          <TouchableOpacity className="items-center mr-3">
            <View className="w-16 h-16 rounded-full bg-gray-200 items-center justify-center border-2 border-dashed border-gray-400">
              <Plus size={24} color="#6B7280" />
            </View>
            <Text className={`text-xs mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Hikaye Ekle
            </Text>
          </TouchableOpacity>

          {/* Story Avatars */}
          <FlatList
            data={mockStories}
            renderItem={renderStory}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
          />
        </View>
      </View>

      {/* Posts */}
      <FlatList
        data={mockPosts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
      />
    </ScrollView>
  );
}
