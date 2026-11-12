import { Tabs } from 'expo-router';
import { Home, ShoppingBag, User, VenetianMask } from 'lucide-react-native';

import { useTheme } from '@/context/ThemeContext';
import { useNotifications } from '@/context/NotificationContext';
import { MessageIcon } from '@/components/MessageIcon';

export default function TabsLayout() {
  const { isDark } = useTheme();
  const { unreadCount, unreadMessageCount, clearUnreadMessages } = useNotifications();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0ea5e9',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: isDark ? '#111827' : '#ffffff',
          borderTopColor: isDark ? '#1f2937' : '#e5e7eb',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ana sayfa',
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
          tabBarBadgeStyle: { backgroundColor: '#0ea5e9', color: '#fff' },
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{ title: 'Pazar', tabBarIcon: ({ color, size }) => <ShoppingBag color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="messages"
        listeners={{ tabPress: clearUnreadMessages }}
        options={{
          title: 'Mesajlar',
          tabBarIcon: ({ color, size }) => (
            <MessageIcon color={color} size={size} unreadCount={unreadMessageCount} />
          ),
        }}
      />
      <Tabs.Screen
        name="confessions"
        options={{ title: 'İtiraflar', tabBarIcon: ({ color, size }) => <VenetianMask color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profil', tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
    </Tabs>
  );
}
