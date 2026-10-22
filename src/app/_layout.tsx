import '../../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, type ReactNode } from 'react';
import { ActivityIndicator, Animated, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { ProfileProvider } from '@/context/ProfileContext';
import { NotificationsProvider } from '@/context/NotificationsContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';

/** Tema değişince ekranın kısa bir yumuşak geçişle (fade) yenilenmesini sağlar. */
function ThemeFade({ children }: { children: ReactNode }) {
  const { isDark } = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    opacity.setValue(0.55);
    Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [isDark, opacity]);

  return <Animated.View style={{ flex: 1, opacity }}>{children}</Animated.View>;
}

function RootNavigator() {
  const { user, loading } = useAuth();
  const { isDark } = useTheme();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  return (
    <ThemeFade>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="chat/[id]" />
          <Stack.Screen name="listing/[id]" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="archive" />
          <Stack.Screen name="liked-posts" />
          <Stack.Screen name="blocked" />
          <Stack.Screen name="profile/[id]" />
          <Stack.Screen name="follow-requests" />
          <Stack.Screen name="search" />
          <Stack.Screen name="notifications" />
        </Stack.Protected>
      </Stack>
    </ThemeFade>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <ProfileProvider>
              <NotificationsProvider>
                <RootNavigator />
              </NotificationsProvider>
            </ProfileProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
