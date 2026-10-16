import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { RegisterFormData, validateRegisterForm } from '../../utils/validation';
import { useTheme } from '../../context/ThemeContext';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const { isDark } = useTheme();

  const [formData, setFormData] = useState<RegisterFormData>({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    // Validasyon
    const validationErrors = validateRegisterForm(formData);
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
      const result = await signUp(formData.email, formData.password, {
        full_name: formData.fullName,
        username: formData.username,
        phone: formData.phone,
      });

      if (result.error) {
        setErrors({ email: result.error.message });
      } else {
        // Başarılı kayıt - ana ekrana yönlendir
        router.replace('/(tabs)');
      }
    } catch (error) {
      setErrors({ email: 'Kayıt başarısız oldu' });
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
            Kayıt Ol
          </Text>
          <Text className={`text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Campus Connect'a katıl
          </Text>
        </View>

        <Input
          label="Ad Soyad"
          placeholder="Adınız Soyadınız"
          value={formData.fullName}
          onChangeText={(text) => setFormData({ ...formData, fullName: text })}
          error={errors.fullName}
        />

        <Input
          label="Kullanıcı Adı"
          placeholder="kullaniciadi"
          value={formData.username}
          onChangeText={(text) => setFormData({ ...formData, username: text })}
          error={errors.username}
          autoCapitalize="none"
        />

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
          label="Telefon Numarası"
          placeholder="5XX XXX XX XX"
          value={formData.phone}
          onChangeText={(text) => setFormData({ ...formData, phone: text })}
          error={errors.phone}
          keyboardType="phone-pad"
        />

        <Input
          label="Şifre"
          placeholder="En az 8 karakter"
          value={formData.password}
          onChangeText={(text) => setFormData({ ...formData, password: text })}
          error={errors.password}
          secureTextEntry
        />

        <Input
          label="Şifre Tekrar"
          placeholder="Şifrenizi tekrar girin"
          value={formData.confirmPassword}
          onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
          error={errors.confirmPassword}
          secureTextEntry
        />

        <Button
          title="Kayıt Ol"
          onPress={handleRegister}
          loading={loading}
          className="mt-4"
        />

        <View className="mt-6 items-center">
          <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Zaten hesabın var mı?{' '}
            <Text
              className="text-primary-500 font-semibold"
              onPress={() => router.push('/(auth)/login')}
            >
              Giriş Yap
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
