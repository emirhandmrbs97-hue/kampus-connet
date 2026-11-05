import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  normalizePhone,
  validateEmail,
  validateFullName,
  validatePassword,
  validatePhone,
  validateUsername,
} from '@/lib/validation';

type Form = {
  fullName: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  confirm: string;
};

export default function Register() {
  const { signUp } = useAuth();
  const [form, setForm] = useState<Form>({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [busy, setBusy] = useState(false);

  const set = (key: keyof Form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    const username = form.username.trim().toLowerCase();
    const next: Partial<Record<keyof Form, string>> = {};
    const checks: [keyof Form, string | null][] = [
      ['fullName', validateFullName(form.fullName)],
      ['username', validateUsername(username)],
      ['email', validateEmail(form.email)],
      ['phone', validatePhone(form.phone)],
      ['password', validatePassword(form.password)],
      ['confirm', form.password === form.confirm ? null : 'Şifreler eşleşmiyor.'],
    ];
    for (const [key, error] of checks) if (error) next[key] = error;
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      const { data: available, error: rpcError } = await supabase.rpc('username_available', { u: username });
      if (rpcError) throw rpcError;
      if (available === false) {
        setErrors({ username: 'Bu kullanıcı adı alınmış.' });
        return;
      }

      const { error, hasSession } = await signUp(form.email.trim(), form.password, {
        full_name: form.fullName.trim(),
        username,
        phone: normalizePhone(form.phone) ?? '',
      });
      if (error) {
        setErrors({ email: error });
        return;
      }
      if (!hasSession) {
        Alert.alert('E-postanı doğrula', 'Hesabını onaylaman için e-posta gönderdik. Onayladıktan sonra giriş yapabilirsin.');
        router.replace('/(auth)/login');
      }
      // Oturum açıldıysa kök layout kullanıcıyı otomatik olarak ana ekrana alır.
    } catch {
      setErrors({ email: 'Kayıt başarısız oldu, tekrar dene.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="px-6 pb-10 pt-8" keyboardShouldPersistTaps="handled">
          <Text className="text-3xl font-extrabold text-gray-900 dark:text-white">Kayıt ol</Text>
          <Text className="mb-6 mt-1 text-base text-gray-500 dark:text-gray-400">Campus Connect'a katıl</Text>

          <Field label="Ad soyad" value={form.fullName} onChangeText={set('fullName')} error={errors.fullName} />
          <Field
            label="Kullanıcı adı"
            placeholder="kullaniciadi"
            value={form.username}
            onChangeText={(v) => set('username')(v.toLowerCase())}
            error={errors.username}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Field
            label="E-posta"
            placeholder="ornek@email.com"
            value={form.email}
            onChangeText={set('email')}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
          />
          <Field
            label="Telefon"
            placeholder="5XX XXX XX XX"
            value={form.phone}
            onChangeText={set('phone')}
            error={errors.phone}
            keyboardType="phone-pad"
          />
          <Field
            label="Şifre"
            placeholder="En az 8 karakter, harf ve rakam"
            value={form.password}
            onChangeText={set('password')}
            error={errors.password}
            secureTextEntry
            autoComplete="new-password"
          />
          <Field
            label="Şifre tekrar"
            value={form.confirm}
            onChangeText={set('confirm')}
            error={errors.confirm}
            secureTextEntry
            autoComplete="new-password"
          />

          <Button title="Kayıt ol" onPress={submit} loading={busy} />

          <View className="mt-6 flex-row justify-center">
            <Text className="text-gray-500 dark:text-gray-400">Zaten hesabın var mı? </Text>
            <Text className="font-semibold text-primary-600" onPress={() => router.replace('/(auth)/login')}>
              Giriş yap
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
