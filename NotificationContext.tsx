import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { useRealtimeNotifications } from './hooks/useRealtimeNotifications';
import { InAppNotificationBanner } from './InAppNotificationBanner';
import type { NotificationActivity } from './hooks/useRealtimeNotifications';

type NotificationContextValue = {
  unreadCount: number;
  unreadMessageCount: number;
  clearUnreadMessages: () => void;
  activities: NotificationActivity[];
  markNotificationRead: (activityId: string) => Promise<boolean>;
  markAllNotificationsRead: () => Promise<boolean>;
  refreshNotifications: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const {
    unreadCount,
    unreadMessageCount,
    activities,
    notification,
    clearUnreadMessages,
    markNotificationRead,
    markAllNotificationsRead,
    refreshNotifications,
    dismissNotification,
  } = useRealtimeNotifications(user?.id);

  const value = useMemo(
    () => ({
      unreadCount,
      unreadMessageCount,
      clearUnreadMessages,
      activities,
      markNotificationRead,
      markAllNotificationsRead,
      refreshNotifications,
    }),
    [
      unreadCount,
      unreadMessageCount,
      clearUnreadMessages,
      activities,
      markNotificationRead,
      markAllNotificationsRead,
      refreshNotifications,
    ],
  );

  return (
    <NotificationContext.Provider value={value}>
      <View className="flex-1">
        {children}
        <InAppNotificationBanner notification={notification} onDismiss={dismissNotification} />
      </View>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used inside <NotificationProvider>');
  return context;
}
