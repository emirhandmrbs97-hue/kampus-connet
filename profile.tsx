import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Avatar } from '../../components/ui/Avatar';
import { Toggle } from '../../components/ui/Toggle';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Settings, User as UserIcon, Lock, Moon, LogOut } from 'lucide-react-native';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  const handleSignOut = async () => {
    await signOut();
  };

  const userMetadata = user?.user_metadata || {};
  const fullName = userMetadata.full_name || 'Kullanıcı';
  const username = userMetadata.username || 'kullaniciadi';

  return (
    <ScrollView className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Header */}
      <View className="p-6 items-center">
        <Avatar uri={userMetadata.avatar_url} name={fullName} size={100} />
        <Text className={`text-2xl font-bold mt-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {fullName}
        </Text>
        <Text className={`text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          @{username}
        </Text>
      </View>

      {/* Stats */}
      <View className="flex-row justify-around py-4 border-b border-gray-200 dark:border-gray-700">
        <View className="items-center">
          <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>0</Text>
          <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Gönderi</Text>
        </View>
        <View className="items-center">
          <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>0</Text>
          <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Takipçi</Text>
        </View>
        <View className="items-center">
          <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>0</Text>
          <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Takip</Text>
        </View>
      </View>

      {/* Settings */}
      <View className="p-4">
        <Text className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Ayarlar
        </Text>

        {/* Private Account */}
        <View className="flex-row items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
          <View className="flex-row items-center">
            <Lock size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
            <Text className={`ml-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Hesabı Gizli Yap
            </Text>
          </View>
          <Toggle value={isPrivate} onValueChange={setIsPrivate} />
        </View>

        {/* Change Username */}
        <TouchableOpacity
          className="flex-row items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700"
          onPress={() => setShowUsernameModal(true)}
        >
          <View className="flex-row items-center">
            <UserIcon size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
            <Text className={`ml-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Kullanıcı Adı Değiştir
            </Text>
          </View>
        </TouchableOpacity>

        {/* Change Password */}
        <TouchableOpacity
          className="flex-row items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700"
          onPress={() => setShowPasswordModal(true)}
        >
          <View className="flex-row items-center">
            <Settings size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
            <Text className={`ml-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Şifre Değiştir
            </Text>
          </View>
        </TouchableOpacity>

        {/* Dark Mode */}
        <View className="flex-row items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
          <View className="flex-row items-center">
            <Moon size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
            <Text className={`ml-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Koyu Mod
            </Text>
          </View>
          <Toggle value={isDark} onValueChange={toggleTheme} />
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          className="flex-row items-center justify-between py-3 mt-4"
          onPress={handleSignOut}
        >
          <View className="flex-row items-center">
            <LogOut size={20} color="#EF4444" />
            <Text className="ml-3 text-red-500">Çıkış Yap</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Username Change Modal */}
      <Modal
        visible={showUsernameModal}
        onClose={() => setShowUsernameModal(false)}
        title="Kullanıcı Adı Değiştir"
      >
        <Input
          placeholder="Yeni kullanıcı adı"
          defaultValue={username}
        />
        <Button
          title="Kaydet"
          onPress={() => setShowUsernameModal(false)}
          className="mt-4"
        />
      </Modal>

      {/* Password Change Modal */}
      <Modal
        visible={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Şifre Değiştir"
      >
        <Input
          placeholder="Mevcut şifre"
          secureTextEntry
        />
        <Input
          placeholder="Yeni şifre"
          secureTextEntry
        />
        <Input
          placeholder="Yeni şifre tekrar"
          secureTextEntry
        />
        <Button
          title="Kaydet"
          onPress={() => setShowPasswordModal(false)}
          className="mt-4"
        />
      </Modal>
    </ScrollView>
  );
}
