import './global.css';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from './AuthContext';
import { ProfileProvider } from './ProfileContext';
import { ThemeProvider } from './ThemeContext';
import { NotificationProvider } from './NotificationContext';

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

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="archive" />
      <Stack.Screen name="blocked" />
      <Stack.Screen name="listing/[id]" />
      <Stack.Screen name="chat/[id]" />
    </Stack>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <ProfileProvider>
              <NotificationProvider>
                <AuthWrapper />
              </NotificationProvider>
            </ProfileProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
