import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import {
  normalizePhone,
  validateEmail,
  validateFullName,
  validatePassword,
  validatePhone,
  validateUsername,
} from '@/lib/validation';

type Errors = Partial<Record<'fullName' | 'username' | 'email' | 'phone' | 'password', string | null>>;

export default function Register() {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onSubmit = async () => {
    const next: Errors = {
      fullName: validateFullName(fullName),
      username: validateUsername(username),
      email: validateEmail(email),
      phone: validatePhone(phone),
      password: validatePassword(password),
    };
    setErrors(next);
    setFormError(null);
    setNotice(null);
    if (Object.values(next).some(Boolean)) return;

    setBusy(true);
    const result = await signUp(email, password, {
      fullName,
      username,
      phone: normalizePhone(phone) ?? phone,
    });
    setBusy(false);
    if (result.error) setFormError(result.error);
    else if (result.needsConfirmation) {
      setNotice('Kayıt oluşturuldu. E-postana gelen bağlantıyla hesabını doğrula, sonra giriş yap.');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="px-6 py-8" keyboardShouldPersistTaps="handled">
          <Text className="text-4xl font-extrabold text-gray-900 dark:text-white">Hesap oluştur</Text>
          <Text className="mb-8 mt-2 text-base text-gray-500 dark:text-gray-400">
            Kampüsteki herkesle bağlantıya geç.
          </Text>

          <Field
            label="Ad soyad"
            placeholder="Ayşe Yılmaz"
            autoComplete="name"
            value={fullName}
            onChangeText={setFullName}
            error={errors.fullName}
          />
          <Field
            label="Kullanıcı adı"
            placeholder="ayse.yilmaz"
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={(v) => setUsername(v.toLowerCase())}
            error={errors.username}
          />
          <Field
            label="E-posta"
            placeholder="ornek@universite.edu.tr"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
          />
          <Field
            label="Telefon numarası"
            placeholder="5XX XXX XX XX"
            keyboardType="phone-pad"
            autoComplete="tel"
            value={phone}
            onChangeText={setPhone}
            error={errors.phone}
          />
          <Field
            label="Şifre"
            placeholder="En az 8 karakter, harf ve rakam"
            secureTextEntry
            autoComplete="new-password"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={onSubmit}
            error={errors.password}
          />

          {formError ? <Text className="mb-3 text-sm text-red-600">{formError}</Text> : null}
          {notice ? <Text className="mb-3 text-sm text-green-600">{notice}</Text> : null}

          <Button title="Kayıt ol" onPress={onSubmit} loading={busy} className="mt-1" />

          <View className="mt-8 flex-row justify-center">
            <Text className="text-gray-500 dark:text-gray-400">Zaten hesabın var mı? </Text>
            <Link href="/login" className="font-semibold text-primary-600">
              Giriş yap
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
