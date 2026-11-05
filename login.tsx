import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import { validateEmail } from '@/lib/validation';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const next: { email?: string; password?: string } = {};
    const emailError = validateEmail(email);
    if (emailError) next.email = emailError;
    if (!password) next.password = 'Şifre gerekli.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    const error = await signIn(email.trim(), password);
    setBusy(false);
    if (error) setErrors({ password: error });
    // Başarılıysa kök layout kullanıcıyı otomatik olarak ana ekrana alır.
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="px-6 pb-10 pt-12" keyboardShouldPersistTaps="handled">
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
            label="E-posta"
            placeholder="ornek@email.com"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
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
