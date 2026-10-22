import AsyncStorage from '@react-native-async-storage/async-storage';
import { AtSign, Bell, Check, ChevronLeft, ChevronRight, Heart, Image as ImageIcon, Languages, Lock, LogOut, Moon, Shield, UserX, Vibrate } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Button, Field, Sheet } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useLanguage, type AppLanguage } from '@/context/LanguageContext';
import { useNotifications } from '@/context/NotificationsContext';
import { useProfile } from '@/context/ProfileContext';
import { useTheme } from '@/context/ThemeContext';
import { goBack } from '@/lib/navigation';
import { validatePassword, validateUsername } from '@/lib/validation';
import { supabase } from '@/lib/supabase';

const NOTIFICATION_SOUND_KEY = 'campus-settings-notification-sound';
const NOTIFICATION_VIBRATION_KEY = 'campus-settings-notification-vibration';
const PRIVACY_LEVELS = ['everyone', 'followers', 'nobody'] as const;

type PrivacyField = 'dm_privacy' | 'story_reply_privacy';
type PrivacyLevel = (typeof PRIVACY_LEVELS)[number];

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
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-violet-50 dark:bg-gray-700">
        {icon}
      </View>
      <Text className="ml-3 flex-1 text-base text-gray-900 dark:text-white">{label}</Text>
      {right ?? <ChevronRight size={18} color="#9ca3af" />}
    </Pressable>
  );
}

function PrivacyChoices({
  label,
  value,
  onChange,
}: {
  label: string;
  value: PrivacyLevel;
  onChange: (next: PrivacyLevel) => void;
}) {
  const { t } = useLanguage();
  return (
    <View className="border-b border-gray-100 px-4 py-4 dark:border-gray-700">
      <Text className="mb-3 text-base text-gray-900 dark:text-white">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {PRIVACY_LEVELS.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === option }}
            onPress={() => onChange(option)}
            className={`rounded-full px-3 py-2 ${value === option ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'}`}
          >
            <Text className={value === option ? 'text-white' : 'text-gray-700 dark:text-gray-200'}>
              {t(option)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { requestLocalNotifications } = useNotifications();
  const { mode, isDark, setMode } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  const [languageOpen, setLanguageOpen] = useState(false);
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

  const languageOptions: { value: AppLanguage; nativeName: string; flag: string }[] = [
    { value: 'tr', nativeName: 'Türkçe', flag: '🇹🇷' },
    { value: 'en', nativeName: 'English', flag: '🇬🇧' },
    { value: 'de', nativeName: 'Deutsch', flag: '🇩🇪' },
  ];

  const chooseLanguage = async (next: AppLanguage) => {
    try {
      await setLanguage(next);
      setLanguageOpen(false);
    } catch (storageError) {
      console.error('Dil tercihi kaydedilemedi:', storageError);
      Alert.alert(t('settings'), 'Dil tercihi kaydedilemedi.');
    }
  };

  useEffect(() => {
    let active = true;
    void Promise.all([
      AsyncStorage.getItem(NOTIFICATION_SOUND_KEY),
      AsyncStorage.getItem(NOTIFICATION_VIBRATION_KEY),
    ])
      .then(([sound, vibrationValue]) => {
        if (!active) return;
        if (sound !== null) setNotificationSound(sound !== 'false');
        if (vibrationValue !== null) setVibration(vibrationValue !== 'false');
      })
      .catch((storageError: unknown) => {
        console.error('Bildirim tercihleri yüklenemedi:', storageError);
        Alert.alert('Ayarlar yüklenemedi', 'Bildirim tercihleri cihazdan okunamadı.');
      });
    return () => {
      active = false;
    };
  }, []);

  const saveNotificationPreference = async (
    key: string,
    next: boolean,
    current: boolean,
    setValue: (value: boolean) => void,
  ) => {
    setValue(next);
    try {
      await AsyncStorage.setItem(key, String(next));
    } catch (storageError) {
      setValue(current);
      console.error('Bildirim tercihi kaydedilemedi:', storageError);
      Alert.alert('Ayar kaydedilemedi', 'Bildirim tercihi cihazda saklanamadı.');
    }
  };

  const togglePrivate = async (value: boolean) => {
    const err = await updateProfile({ is_private: value });
    if (err) Alert.alert('Ayar kaydedilemedi', err);
  };

  const updatePrivacy = async (field: PrivacyField, value: PrivacyLevel) => {
    const err = await updateProfile({ [field]: value });
    if (err) Alert.alert('Gizlilik ayarı kaydedilemedi', err);
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
    try {
      const { data: existing, error: lookupError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', v)
        .maybeSingle();
      if (lookupError) return setError(lookupError.message);
      if (existing) return setError('Bu kullanıcı adı zaten kullanımda');

      const updateError = await updateProfile({ username: v });
      if (updateError) setError(updateError);
      else setUsernameOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Kullanıcı adı güncellenemedi.');
    } finally {
      setBusy(false);
    }
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

    if (!user?.email) return setError('Oturum e-postası bulunamadı.');

    setBusy(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: oldPassword,
      });
      if (signInError) return setError('Mevcut şifre yanlış.');

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) setError(updateError.message);
      else {
        setPasswordOpen(false);
        Alert.alert('Şifre değiştirildi');
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Şifre güncellenemedi.');
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (logoutError) {
      Alert.alert('Çıkış yapılamadı', logoutError instanceof Error ? logoutError.message : 'Oturum kapatılamadı.');
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-gray-50 dark:bg-[#11111b]">
      <ScrollView contentContainerClassName="px-5 pb-10 pt-4">
        <View className="flex-row items-center mb-6">
          <Pressable onPress={() => goBack()} className="mr-3 h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-gray-800">
            <ChevronLeft size={23} color="#7c3aed" />
          </Pressable>
          <Text className="text-3xl font-black text-gray-950 dark:text-white">{t('settings')}</Text>
        </View>

        <Text className="mb-2 text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('account')}</Text>
        <View className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <Row icon={<Lock size={18} color="#7c3aed" />} label={t('changePassword')} onPress={openPassword} />
          <Row icon={<AtSign size={18} color="#7c3aed" />} label={t('changeUsername')} onPress={openUsername} />
        </View>

        <Text className="mb-2 mt-7 text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('content')}</Text>
        <View className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <Row icon={<Heart size={18} color="#f43f5e" />} label={t('likedPosts')} onPress={() => router.push('/liked-posts')} />
          <Row icon={<ImageIcon size={18} color="#7c3aed" />} label={t('archivedMedia')} onPress={() => router.push('/archive')} />
        </View>

        <Text className="mb-2 mt-7 text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('notifications')}</Text>
        <View className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <Row
            icon={<Bell size={18} color="#7c3aed" />}
            label={t('allowNotifications')}
            onPress={() => {
              void requestLocalNotifications()
                .then((granted) =>
                  Alert.alert(
                    granted ? 'Bildirimler etkin' : 'İzin verilmedi',
                    granted
                      ? 'Uygulama açıkken gelen bildirimleri cihazda görebilirsin.'
                      : 'Cihaz ayarlarından bildirim iznini açabilirsin.',
                  ),
                )
                .catch((error: unknown) => {
                  Alert.alert('Bildirim izni alınamadı', error instanceof Error ? error.message : 'Bir hata oluştu.');
                });
            }}
          />
          <Row
            icon={<Bell size={18} color="#7c3aed" />}
            label={t('notificationSounds')}
            right={
              <Switch
                value={notificationSound}
                onValueChange={(value) =>
                  void saveNotificationPreference(
                    NOTIFICATION_SOUND_KEY,
                    value,
                    notificationSound,
                    setNotificationSound,
                  )
                }
                trackColor={{ true: '#7c3aed' }}
              />
            }
          />
          <Row
            icon={<Vibrate size={18} color="#7c3aed" />}
            label={t('vibration')}
            right={<Switch value={vibration} onValueChange={(value) => void saveNotificationPreference(NOTIFICATION_VIBRATION_KEY, value, vibration, setVibration)} trackColor={{ true: '#7c3aed' }} />}
          />
        </View>

        <Text className="mb-2 mt-7 text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('privacySecurity')}</Text>
        <View className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <Row
            icon={<Shield size={18} color="#7c3aed" />}
            label={t('privateAccount')}
            right={<Switch value={!!profile?.is_private} onValueChange={togglePrivate} trackColor={{ true: '#7c3aed' }} />}
          />
          <Row
            icon={<UserX size={18} color="#7c3aed" />}
            label={t('blockedUsers')}
            onPress={() => router.push('/blocked')}
          />
          <PrivacyChoices
            label={t('messagePrivacy')}
            value={profile?.dm_privacy ?? 'everyone'}
            onChange={(value) => void updatePrivacy('dm_privacy', value)}
          />
          <PrivacyChoices
            label={t('storyReplies')}
            value={profile?.story_reply_privacy ?? 'everyone'}
            onChange={(value) => void updatePrivacy('story_reply_privacy', value)}
          />
        </View>

        <Text className="mb-2 mt-7 text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('appearance')}</Text>
        <View className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <Row
            icon={<Moon size={18} color="#7c3aed" />}
            label={t('darkMode')}
            right={
              <Switch
                value={mode === 'dark' || (mode === 'system' && isDark)}
                onValueChange={(value) => setMode(value ? 'dark' : 'light')}
                trackColor={{ true: '#7c3aed' }}
              />
            }
          />
        </View>

        <Text className="mb-2 mt-7 text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('language')}</Text>
        <View className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <Row
            icon={<Languages size={18} color="#7c3aed" />}
            label={t('language')}
            onPress={() => setLanguageOpen(true)}
            right={
              <View className="flex-row items-center">
                <Text className="mr-2 text-sm font-bold text-violet-700 dark:text-violet-300">
                  {languageOptions.find((option) => option.value === language)?.nativeName}
                </Text>
                <ChevronRight size={18} color="#9ca3af" />
              </View>
            }
          />
        </View>

        <Pressable
          onPress={() => void logout()}
          className="mt-8 flex-row items-center justify-center rounded-2xl border border-rose-200 bg-white py-3.5 dark:border-rose-900 dark:bg-gray-900"
        >
          <LogOut size={18} color="#dc2626" />
          <Text className="ml-2 text-base font-bold text-red-600">{t('logout')}</Text>
        </Pressable>
      </ScrollView>

      <Sheet visible={languageOpen} onClose={() => setLanguageOpen(false)} title={t('chooseLanguage')}>
        <Text className="mb-5 text-sm leading-5 text-gray-500 dark:text-gray-400">{t('languageDescription')}</Text>
        {languageOptions.map((option) => {
          const selected = option.value === language;
          return (
            <Pressable
              key={option.value}
              onPress={() => void chooseLanguage(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              className={`mb-3 flex-row items-center rounded-3xl border p-4 ${
                selected
                  ? 'border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-950'
                  : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
              }`}
            >
              <Text className="text-3xl">{option.flag}</Text>
              <View className="ml-4 flex-1">
                <Text className="text-base font-extrabold text-gray-900 dark:text-white">{option.nativeName}</Text>
                <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{option.value.toUpperCase()}</Text>
              </View>
              <View className={`h-7 w-7 items-center justify-center rounded-full ${selected ? 'bg-violet-600' : 'border border-gray-300 dark:border-gray-600'}`}>
                {selected ? <Check size={16} color="#fff" strokeWidth={3} /> : null}
              </View>
            </Pressable>
          );
        })}
      </Sheet>

      <Sheet visible={usernameOpen} onClose={() => setUsernameOpen(false)} title={t('changeUsernameTitle')}>
        <Field
          label={t('currentUsername')}
          autoCapitalize="none"
          autoCorrect={false}
          value={currentUsernameConfirm}
          onChangeText={setCurrentUsernameConfirm}
          placeholder="@kullaniciadi"
        />
        <Field
          label={t('newUsername')}
          autoCapitalize="none"
          autoCorrect={false}
          value={newUsername}
          onChangeText={(v) => setNewUsername(v.toLowerCase())}
          error={error}
        />
        <Button title={t('save')} onPress={saveUsername} loading={busy} />
      </Sheet>

      <Sheet visible={passwordOpen} onClose={() => setPasswordOpen(false)} title={t('changePasswordTitle')}>
        <Field
          label={t('oldPassword')}
          secureTextEntry
          autoComplete="current-password"
          value={oldPassword}
          onChangeText={setOldPassword}
        />
        <Field
          label={t('newPassword')}
          placeholder="Minimum 8 characters"
          secureTextEntry
          autoComplete="new-password"
          value={newPassword}
          onChangeText={setNewPassword}
          error={error}
        />
        <Button title={t('updatePassword')} onPress={savePassword} loading={busy} />
      </Sheet>
    </SafeAreaView>
  );
}
