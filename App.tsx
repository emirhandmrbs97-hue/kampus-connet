import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Auth protection wrapper
function AuthWrapper() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Kullanıcı giriş yapmamış ve auth grubunda değilse, login'e yönlendir
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Kullanıcı giriş yapmış ve auth grubundaysa, ana ekrana yönlendir
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-900">
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  return <Slot />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AuthWrapper />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
