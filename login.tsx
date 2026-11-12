import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';

import { Button, Field } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { getRememberSessionPreference, isSupabaseConfigured } from '@/lib/supabase';
import { validateUsername } from '@/lib/validation';

export default function Login() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getRememberSessionPreference()
      .then(setRememberMe)
      .catch((error: unknown) => console.error('[auth] Failed to load remember-session preference:', error));
  }, []);

  const submit = async () => {
    const next: { username?: string; password?: string } = {};
    const usernameError = validateUsername(username.trim().toLowerCase());
    if (usernameError) next.username = usernameError;
    if (!password) next.password = 'Şifre gerekli.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    const error = await signIn(username.trim().toLowerCase(), password, rememberMe);
    setBusy(false);
    if (error) setErrors({ password: error });
    // Başarılıysa kök layout kullanıcıyı otomatik olarak ana ekrana alır.
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="px-6 pb-10 pt-12" keyboardShouldPersistTaps="handled">
          <View className="mb-8 flex-row items-center">
            <Image
              source={require('./icon.png')}
              resizeMode="contain"
              style={{ width: 48, height: 48, borderRadius: 12, marginRight: 12 }}
            />
            <Text className="text-xl font-extrabold text-gray-900 dark:text-white">Campus Connect</Text>
          </View>
          <Text className="text-3xl font-extrabold text-gray-900 dark:text-white">Giriş yap</Text>
          <Text className="mb-8 mt-1 text-base text-gray-500 dark:text-gray-400">Campus Connect'a hoş geldin</Text>

          {!isSupabaseConfigured ? (
            <View className="mb-4 rounded-2xl bg-amber-100 p-3">
              <Text className="text-sm text-amber-900">
                Supabase anahtarları eksik. .env.local dosyasına EXPO_PUBLIC_SUPABASE_URL ve
                EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY değerlerini yaz.
              </Text>
            </View>
          ) : null}

          <Field
            label="Kullanıcı adı"
            placeholder="kullaniciadi"
            value={username}
            onChangeText={setUsername}
            error={errors.username}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
          />
          <Field
            label="Şifre"
            placeholder="Şifrenizi girin"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secureTextEntry
            autoComplete="current-password"
          />

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: rememberMe }}
            onPress={() => setRememberMe((value) => !value)}
            className="mb-5 flex-row items-center self-start"
          >
            <View
              className={`mr-2 h-5 w-5 items-center justify-center rounded border ${
                rememberMe ? 'border-primary-600 bg-primary-600' : 'border-gray-400 bg-white dark:bg-gray-800'
              }`}
            >
              {rememberMe ? <Check size={14} color="white" strokeWidth={3} /> : null}
            </View>
            <Text className="text-sm text-gray-700 dark:text-gray-300">Beni hatırla</Text>
          </Pressable>

          <Button title="Giriş yap" onPress={submit} loading={busy} />

          <View className="mt-6 flex-row justify-center">
            <Text className="text-gray-500 dark:text-gray-400">Hesabın yok mu? </Text>
            <Text className="font-semibold text-primary-600" onPress={() => router.push('/(auth)/register')}>
              Kayıt ol
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
