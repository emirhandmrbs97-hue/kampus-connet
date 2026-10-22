import { Link } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import { validateUsername } from '@/lib/validation';

export default function Login() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{
    username?: string | null;
    password?: string | null;
    form?: string | null;
  }>({});

  const onSubmit = async () => {
    const next = {
      username: validateUsername(username.trim().toLowerCase()),
      password: password ? null : 'Şifreni gir.',
    };
    setErrors(next);
    if (next.username || next.password) return;
    setBusy(true);
    const result = await signIn(username.trim().toLowerCase(), password);
    setBusy(false);
    if (result.error) setErrors({ form: result.error });
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-10">
            <Image
              source={require('../../../assets/icon.png')}
              accessibilityLabel="KampüsHub logosu"
              className="mb-5 h-20 w-20 rounded-3xl"
              resizeMode="cover"
            />
            <Text className="text-4xl font-extrabold text-gray-900 dark:text-white">Tekrar hoş geldin</Text>
            <Text className="mt-2 text-base text-gray-500 dark:text-gray-400">
              KampüsHub hesabına giriş yap.
            </Text>
          </View>

          {!isSupabaseConfigured && (
            <View className="mb-4 rounded-2xl bg-amber-100 p-3">
              <Text className="text-sm text-amber-900">
                Supabase anahtarları eksik. .env.local dosyasını doldurup Metro&apos;yu yeniden başlat.
              </Text>
            </View>
          )}

          <Field
            label="Kullanıcı adı"
            placeholder="kullanici.adin"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            value={username}
            onChangeText={setUsername}
            error={errors.username}
          />
          <Field
            label="Şifre"
            placeholder="Şifren"
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={onSubmit}
            error={errors.password}
          />

          {errors.form ? <Text className="mb-3 text-sm text-red-600">{errors.form}</Text> : null}

          <Button title="Giriş yap" onPress={onSubmit} loading={busy} className="mt-1" />

          <View className="mt-8 flex-row justify-center">
            <Text className="text-gray-500 dark:text-gray-400">Hesabın yok mu? </Text>
            <Link href="/register" className="font-semibold text-primary-600">
              Kayıt ol
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
