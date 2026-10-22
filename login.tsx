import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { LoginFormData, validateLoginForm } from '../../utils/validation';
import { useTheme } from '../../context/ThemeContext';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { isDark } = useTheme();

  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    // Validasyon
    const validationErrors = validateLoginForm(formData);
    if (validationErrors.length > 0) {
      const errorMap: Record<string, string> = {};
      validationErrors.forEach(err => {
        errorMap[err.field] = err.message;
      });
      setErrors(errorMap);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const result = await signIn(formData.email, formData.password);

      if (result.error) {
        setErrors({ email: result.error.message });
      } else {
        // Başarılı giriş - ana ekrana yönlendir
        router.replace('/(tabs)');
      }
    } catch (error) {
      setErrors({ email: 'Giriş başarısız oldu' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className={`flex-1 ${isDark ? 'bg-gray-900' : 'bg-white'}`}
    >
      <ScrollView className="flex-1 px-6 pt-12">
        <View className="mb-8">
          <Text className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Giriş Yap
          </Text>
          <Text className={`text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            KampüsHub'a hoş geldin
          </Text>
        </View>

        <Input
          label="E-posta"
          placeholder="ornek@email.com"
          value={formData.email}
          onChangeText={(text) => setFormData({ ...formData, email: text })}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Input
          label="Şifre"
          placeholder="Şifrenizi girin"
          value={formData.password}
          onChangeText={(text) => setFormData({ ...formData, password: text })}
          error={errors.password}
          secureTextEntry
        />

        <View className="mt-2 mb-6">
          <Text
            className={`text-sm text-right ${isDark ? 'text-primary-400' : 'text-primary-600'}`}
            onPress={() => {/* Şifremi unuttum modalı */}}
          >
            Şifremi Unuttum
          </Text>
        </View>

        <Button
          title="Giriş Yap"
          onPress={handleLogin}
          loading={loading}
          className="mt-4"
        />

        <View className="mt-6 items-center">
          <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Hesabın yok mu?{' '}
            <Text
              className="text-primary-500 font-semibold"
              onPress={() => router.push('/(auth)/register')}
            >
              Kayıt Ol
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
