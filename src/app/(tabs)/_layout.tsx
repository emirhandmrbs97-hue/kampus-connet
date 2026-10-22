import { Tabs } from 'expo-router';
import { Home, MessageCircle, ScrollText, ShoppingBag, User } from 'lucide-react-native';
import { Text, View, type ColorValue } from 'react-native';

import { useNotifications } from '@/context/NotificationsContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';

const tabColors: Record<string, string> = {
  index: '#0ea5e9',
  marketplace: '#8b5cf6',
  messages: '#ec4899',
  confessions: '#f59e0b',
  profile: '#10b981',
};

function TabIcon({
  route,
  icon: Icon,
  color,
  size,
  focused,
  count,
}: {
  route: string;
  icon: typeof Home;
  color: ColorValue;
  size: number;
  focused: boolean;
  count?: number;
}) {
  const accentColor = tabColors[route] ?? String(color);
  return (
    <View
      className={`h-9 min-w-10 items-center justify-center rounded-2xl px-2 ${
        focused ? 'bg-gray-100 dark:bg-gray-800' : ''
      }`}
    >
      <Icon color={focused ? accentColor : String(color)} size={size} strokeWidth={focused ? 2.6 : 2.1} />
      {count && count > 0 ? (
        <View className="absolute -right-2 -top-1 min-w-5 items-center rounded-full border-2 border-white bg-pink-500 px-1 dark:border-gray-900">
          <Text className="text-[10px] font-extrabold text-white">{count > 99 ? '99+' : count}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function TabsLayout() {
  const { isDark } = useTheme();
  const { unreadMessageCount } = useNotifications();
  const { t } = useLanguage();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6d28d9',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: 1,
        },
        tabBarStyle: {
          backgroundColor: isDark ? '#11111b' : '#ffffff',
          borderTopColor: isDark ? '#28283a' : '#ececf3',
          borderTopWidth: 1,
          height: 74,
          paddingTop: 7,
          paddingBottom: 8,
          elevation: 18,
          shadowColor: '#312e81',
          shadowOpacity: 0.08,
          shadowRadius: 14,
        },
        tabBarItemStyle: { paddingVertical: 1 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('home'),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon route="index" icon={Home} color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{
          title: t('marketplace'),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon route="marketplace" icon={ShoppingBag} color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('messages'),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              route="messages"
              icon={MessageCircle}
              color={color}
              size={size}
              focused={focused}
              count={unreadMessageCount}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="confessions"
        options={{
          title: t('confessions'),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon route="confessions" icon={ScrollText} color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile'),
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon route="profile" icon={User} color={color} size={size} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
