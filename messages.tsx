import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Avatar } from '../../components/ui/Avatar';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { Search, Send, UserPlus, Bell, Shield } from 'lucide-react-native';

// Mock data
const mockConversations = [
  {
    id: '1',
    name: 'Ahmet Yılmaz',
    username: 'ahmetyilmaz',
    avatar: '',
    lastMessage: 'Tamam, görüşürüz!',
    time: '14:30',
    unread: 2,
  },
  {
    id: '2',
    name: 'Ayşe Demir',
    username: 'aysedemir',
    avatar: '',
    lastMessage: 'Ders notlarını attım',
    time: '12:15',
    unread: 0,
  },
  {
    id: '3',
    name: 'Mehmet Kaya',
    username: 'mehmetkaya',
    avatar: '',
    lastMessage: 'Teşekkürler!',
    time: 'Dün',
    unread: 0,
  },
];

const mockRequests = [
  {
    id: '4',
    name: 'Ali Veli',
    username: 'aliveli',
    avatar: '',
    message: 'Merhaba, tanışabilir miyiz?',
  },
  {
    id: '5',
    name: 'Zeynep Su',
    username: 'zeynepsu',
    avatar: '',
    message: 'Ders hakkında sorum var',
  },
];

const mockSpam = [
  {
    id: '6',
    name: 'Bilinmeyen',
    username: 'unknown',
    avatar: '',
    lastMessage: 'Spam mesaj',
    time: '2 gün önce',
  },
];

const mockMessages = [
  { id: '1', message: 'Merhaba!', isOwn: false, time: '14:00' },
  { id: '2', message: 'Selam, nasılsın?', isOwn: true, time: '14:01' },
  { id: '3', message: 'İyiyim, sen?', isOwn: false, time: '14:02' },
  { id: '4', message: 'Ben de iyiyim, teşekkürler', isOwn: true, time: '14:03' },
  { id: '5', message: 'Tamam, görüşürüz!', isOwn: false, time: '14:30' },
];

type TabType = 'messages' | 'requests' | 'spam';

export default function MessagesScreen() {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('messages');
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');

  const renderConversation = ({ item }: { item: any }) => (
    <TouchableOpacity
      onPress={() => setSelectedChat(item.id)}
      className={`flex-row items-center p-4 border-b ${
        isDark ? 'border-gray-800' : 'border-gray-200'
      }`}
    >
      <Avatar uri={item.avatar} name={item.name} size={50} />
      <View className="ml-3 flex-1">
        <View className="flex-row justify-between items-center">
          <Text className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {item.name}
          </Text>
          <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {item.time}
          </Text>
        </View>
        <View className="flex-row justify-between items-center mt-1">
          <Text
            className={`flex-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
            numberOfLines={1}
          >
            {item.lastMessage}
          </Text>
          {item.unread > 0 && (
            <View className="bg-primary-500 rounded-full px-2 py-0.5 ml-2">
              <Text className="text-white text-xs font-bold">{item.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderRequest = ({ item }: { item: any }) => (
    <View className={`p-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
      <View className="flex-row items-center mb-3">
        <Avatar uri={item.avatar} name={item.name} size={50} />
        <View className="ml-3 flex-1">
          <Text className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {item.name}
          </Text>
          <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            @{item.username}
          </Text>
        </View>
      </View>
      <Text className={`mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
        {item.message}
      </Text>
      <View className="flex-row space-x-2">
        <TouchableOpacity className="flex-1 bg-primary-500 py-2 rounded-xl items-center">
          <Text className="text-white font-semibold">Kabul Et</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-1 bg-gray-300 py-2 rounded-xl items-center">
          <Text className="text-gray-900 font-semibold">Reddet</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderMessage = ({ item }: { item: any }) => (
    <MessageBubble message={item.message} isOwn={item.isOwn} time={item.time} />
  );

  if (selectedChat) {
    // Chat Detail View
    return (
      <View className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
        {/* Header */}
        <View className={`flex-row items-center p-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <TouchableOpacity onPress={() => setSelectedChat(null)}>
            <Text className="text-primary-500">← Geri</Text>
          </TouchableOpacity>
          <Avatar name="Ahmet Yılmaz" size={40} className="ml-3" />
          <View className="ml-3">
            <Text className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Ahmet Yılmaz
            </Text>
            <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              @ahmetyilmaz
            </Text>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          data={mockMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerClassName="p-4"
        />

        {/* Input */}
        <View className={`p-4 border-t ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <View className="flex-row items-center">
            <View
              className={`flex-1 flex-row items-center px-4 py-2 rounded-xl ${
                isDark ? 'bg-gray-800' : 'bg-gray-100'
              }`}
            >
              <Text className={isDark ? 'text-gray-400' : 'text-gray-600'}>Mesaj yaz...</Text>
            </View>
            <TouchableOpacity className="ml-2 bg-primary-500 p-2 rounded-full">
              <Send size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Header */}
      <View className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <View className="flex-row items-center justify-between mb-3">
          <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Mesajlar
          </Text>
          <TouchableOpacity className="bg-primary-500 p-2 rounded-full">
            <UserPlus size={20} color="white" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View className={`flex-row items-center px-4 py-2 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
          <Search size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
          <Text className={`ml-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Kullanıcı ara...
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-gray-200 dark:border-gray-700">
        <TouchableOpacity
          onPress={() => setActiveTab('messages')}
          className={`flex-1 py-3 items-center ${
            activeTab === 'messages' ? 'border-b-2 border-primary-500' : ''
          }`}
        >
          <View className="flex-row items-center">
            <Bell size={18} color={activeTab === 'messages' ? '#0ea5e9' : isDark ? '#9CA3AF' : '#6B7280'} />
            <Text
              className={`ml-2 ${
                activeTab === 'messages'
                  ? 'text-primary-500 font-semibold'
                  : isDark
                  ? 'text-gray-400'
                  : 'text-gray-600'
              }`}
            >
              Mesajlar
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('requests')}
          className={`flex-1 py-3 items-center ${
            activeTab === 'requests' ? 'border-b-2 border-primary-500' : ''
          }`}
        >
          <View className="flex-row items-center">
            <UserPlus size={18} color={activeTab === 'requests' ? '#0ea5e9' : isDark ? '#9CA3AF' : '#6B7280'} />
            <Text
              className={`ml-2 ${
                activeTab === 'requests'
                  ? 'text-primary-500 font-semibold'
                  : isDark
                  ? 'text-gray-400'
                  : 'text-gray-600'
              }`}
            >
              İstekler
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('spam')}
          className={`flex-1 py-3 items-center ${
            activeTab === 'spam' ? 'border-b-2 border-primary-500' : ''
          }`}
        >
          <View className="flex-row items-center">
            <Shield size={18} color={activeTab === 'spam' ? '#0ea5e9' : isDark ? '#9CA3AF' : '#6B7280'} />
            <Text
              className={`ml-2 ${
                activeTab === 'spam'
                  ? 'text-primary-500 font-semibold'
                  : isDark
                  ? 'text-gray-400'
                  : 'text-gray-600'
              }`}
            >
              Spam
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'messages' && (
        <FlatList
          data={mockConversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id}
        />
      )}

      {activeTab === 'requests' && (
        <FlatList
          data={mockRequests}
          renderItem={renderRequest}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Text className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Bekleyen istek yok
              </Text>
            </View>
          }
        />
      )}

      {activeTab === 'spam' && (
        <FlatList
          data={mockSpam}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Text className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Spam yok
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
