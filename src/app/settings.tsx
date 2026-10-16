import { Archive, AtSign, Bell, ChevronLeft, ChevronRight, EyeOff, Lock, LogOut, Moon, Shield, UserX, Vibrate } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Avatar, Button, Field, Sheet } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import { useTheme } from '@/context/ThemeContext';
import { validatePassword, validateUsername } from '@/lib/validation';
import { supabase } from '@/lib/supabase';

function Row({
  icon,
  label,
  right,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center border-b border-gray-100 px-4 py-4 dark:border-gray-700"
    >
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary-50 dark:bg-gray-700">
        {icon}
      </View>
      <Text className="ml-3 flex-1 text-base text-gray-900 dark:text-white">{label}</Text>
      {right ?? <ChevronRight size={18} color="#9ca3af" />}
    </Pressable>
  );
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { mode, setMode } = useTheme();

  const [usernameOpen, setUsernameOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [currentUsernameConfirm, setCurrentUsernameConfirm] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [notificationSound, setNotificationSound] = useState(true);
  const [vibration, setVibration] = useState(true);

  const togglePrivate = async (value: boolean) => {
    const err = await updateProfile({ is_private: value });
    if (err) Alert.alert('Ayar kaydedilemedi', err);
  };

  const openUsername = () => {
    setNewUsername(profile?.username ?? '');
    setCurrentUsernameConfirm('');
    setError(null);
    setUsernameOpen(true);
  };

  const saveUsername = async () => {
    const v = newUsername.trim().toLowerCase();
    const current = currentUsernameConfirm.trim().toLowerCase();

    if (current !== profile?.username) {
      return setError('Mevcut kullanıcı adı yanlış');
    }

    const invalid = validateUsername(v);
    if (invalid) return setError(invalid);

    if (v === profile?.username) return setUsernameOpen(false);

    setBusy(true);

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', v)
      .single();

    if (existing) {
      setBusy(false);
      return setError('Bu kullanıcı adı zaten kullanımda');
    }

    const err = await updateProfile({ username: v });
    setBusy(false);
    if (err) setError(err);
    else setUsernameOpen(false);
  };

  const openPassword = () => {
    setOldPassword('');
    setNewPassword('');
    setError(null);
    setPasswordOpen(true);
  };

  const savePassword = async () => {
    const invalid = validatePassword(newPassword);
    if (invalid) return setError(invalid);

    if (!oldPassword.trim()) {
      return setError('Eski şifre gerekli');
    }

    setBusy(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email ?? '',
      password: oldPassword,
    });

    if (signInError) {
      setBusy(false);
      return setError('Eski şifre yanlış');
    }

    const { error: e } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (e) setError(e.message);
    else {
      setPasswordOpen(false);
      Alert.alert('Şifre değiştirildi');
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-gray-900">
      <ScrollView contentContainerClassName="px-5 pb-10 pt-4">
        <View className="flex-row items-center mb-6">
          <Pressable onPress={() => router.back()} className="mr-4">
            <ChevronLeft size={24} color="#374151" className="dark:text-gray-300" />
          </Pressable>
          <Text className="text-2xl font-extrabold text-gray-900 dark:text-white">Ayarlar</Text>
        </View>

        <Text className="mb-2 text-sm font-semibold text-gray-500 dark:text-gray-400">Hesap</Text>
        <View className="overflow-hidden rounded-3xl bg-gray-50 dark:bg-gray-800">
          <Row icon={<Lock size={18} color="#0ea5e9" />} label="Şifre değiştir" onPress={openPassword} />
          <Row icon={<AtSign size={18} color="#0ea5e9" />} label="Kullanıcı adı değiştir" onPress={openUsername} />
          <Row icon={<Archive size={18} color="#0ea5e9" />} label="Arşiv" onPress={() => router.push('/archive')} />
        </View>

        <Text className="mb-2 mt-8 text-sm font-semibold text-gray-500 dark:text-gray-400">Bildirimler</Text>
        <View className="overflow-hidden rounded-3xl bg-gray-50 dark:bg-gray-800">
          <Row
            icon={<Bell size={18} color="#0ea5e9" />}
            label="Bildirim sesleri"
            right={<Switch value={notificationSound} onValueChange={setNotificationSound} trackColor={{ true: '#0ea5e9' }} />}
          />
          <Row
            icon={<Vibrate size={18} color="#0ea5e9" />}
            label="Titreşim"
            right={<Switch value={vibration} onValueChange={setVibration} trackColor={{ true: '#0ea5e9' }} />}
          />
        </View>

        <Text className="mb-2 mt-8 text-sm font-semibold text-gray-500 dark:text-gray-400">Gizlilik ve Güvenlik</Text>
        <View className="overflow-hidden rounded-3xl bg-gray-50 dark:bg-gray-800">
          <Row
            icon={<Shield size={18} color="#0ea5e9" />}
            label="Hesabı gizli yap"
            right={<Switch value={!!profile?.is_private} onValueChange={togglePrivate} trackColor={{ true: '#0ea5e9' }} />}
          />
          <Row
            icon={<UserX size={18} color="#0ea5e9" />}
            label="Engellenen kullanıcılar"
            onPress={() => router.push('/blocked')}
          />
        </View>

        <Text className="mb-2 mt-8 text-sm font-semibold text-gray-500 dark:text-gray-400">Görünüm</Text>
        <View className="overflow-hidden rounded-3xl bg-gray-50 dark:bg-gray-800">
          <Row
            icon={<Moon size={18} color="#0ea5e9" />}
            label="Tema"
            right={
              <View className="flex-row items-center gap-2">
                <Text className="text-sm text-gray-600 dark:text-gray-300">
                  {mode === 'light' ? 'Açık' : mode === 'dark' ? 'Koyu' : 'Sistem'}
                </Text>
                <ChevronRight size={18} color="#9ca3af" />
              </View>
            }
            onPress={() => {
              if (mode === 'light') setMode('dark');
              else if (mode === 'dark') setMode('system');
              else setMode('light');
            }}
          />
        </View>

        <Pressable
          onPress={signOut}
          className="mt-8 flex-row items-center justify-center rounded-2xl border border-red-500 py-3.5"
        >
          <LogOut size={18} color="#dc2626" />
          <Text className="ml-2 text-base font-semibold text-red-600">Çıkış yap</Text>
        </Pressable>
      </ScrollView>

      <Sheet visible={usernameOpen} onClose={() => setUsernameOpen(false)} title="Kullanıcı adı değiştir">
        <Field
          label="Mevcut kullanıcı adı"
          autoCapitalize="none"
          autoCorrect={false}
          value={currentUsernameConfirm}
          onChangeText={setCurrentUsernameConfirm}
          placeholder="@kullaniciadi"
        />
        <Field
          label="Yeni kullanıcı adı"
          autoCapitalize="none"
          autoCorrect={false}
          value={newUsername}
          onChangeText={(v) => setNewUsername(v.toLowerCase())}
          error={error}
        />
        <Button title="Kaydet" onPress={saveUsername} loading={busy} />
      </Sheet>

      <Sheet visible={passwordOpen} onClose={() => setPasswordOpen(false)} title="Şifre değiştir">
        <Field
          label="Eski şifre"
          secureTextEntry
          autoComplete="current-password"
          value={oldPassword}
          onChangeText={setOldPassword}
        />
        <Field
          label="Yeni şifre"
          placeholder="En az 8 karakter, harf ve rakam"
          secureTextEntry
          autoComplete="new-password"
          value={newPassword}
          onChangeText={setNewPassword}
          error={error}
        />
        <Button title="Şifreyi güncelle" onPress={savePassword} loading={busy} />
      </Sheet>
    </SafeAreaView>
  );
}
