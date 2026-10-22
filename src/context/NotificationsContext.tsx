import { isRunningInExpoGo } from 'expo';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

type NotificationsContextValue = {
  unreadCount: number;
  unreadMessageCount: number;
  refreshUnreadCount: () => Promise<void>;
  requestLocalNotifications: () => Promise<boolean>;
};

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);
let notificationsChannelSequence = 0;

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const notificationsTableAvailable = useRef(true);
  const [notificationsModule, setNotificationsModule] =
    useState<typeof import('expo-notifications') | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web' || isRunningInExpoGo()) return;
    let active = true;
    void import('expo-notifications')
      .then(async (module) => {
        if (!active) return;
        if (Platform.OS === 'android') {
          await Promise.all([
            module.setNotificationChannelAsync('social-alerts', {
              name: 'Sosyal bildirimler',
              importance: module.AndroidImportance.HIGH,
              vibrationPattern: [0, 250, 250, 250],
              lightColor: '#0ea5e9',
            }),
            module.setNotificationChannelAsync('silent-messages', {
              name: 'Sessiz mesajlar',
              importance: module.AndroidImportance.HIGH,
              vibrationPattern: [],
              sound: null,
            }),
          ]);
        }
        if (!active) return;
        module.setNotificationHandler({
          handleNotification: async () => ({
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
        setNotificationsModule(module);
      })
      .catch((error: unknown) => {
        console.error('Bildirim modülü başlatılamadı:', error);
        console.warn('Bu Expo Go sürümünde yerel bildirim modülü kullanılamıyor:', error);
      });
    return () => {
      active = false;
    };
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      setUnreadMessageCount(0);
      return;
    }
    const [allNotifications, messageNotifications] = await Promise.all([
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .neq('type', 'message')
        .is('read_at', null),
      supabase
        .from('notifications')
        .select('actor_id')
        .eq('recipient_id', user.id)
        .eq('type', 'message')
        .is('read_at', null),
    ]);
    const { count, error } = allNotifications;
    if (error?.code === 'PGRST205' || error?.code === '42P01') {
      notificationsTableAvailable.current = false;
      setUnreadCount(0);
      setUnreadMessageCount(0);
      return;
    }
    if (error) throw error;
    if (messageNotifications.error) throw messageNotifications.error;
    notificationsTableAvailable.current = true;
    setUnreadCount(count ?? 0);
    setUnreadMessageCount(new Set((messageNotifications.data ?? []).map((notification) => notification.actor_id).filter(Boolean)).size);
  }, [user]);

  const requestLocalNotifications = useCallback(async () => {
    if (isRunningInExpoGo()) {
      throw new Error('Bildirimler Expo Go’da desteklenmiyor. Uygulamayı development build ile açın.');
    }
    if (!notificationsModule) {
      throw new Error(
        'Bildirim modülü kullanılamıyor. Uygulamayı development build ile açıp tekrar deneyin.',
      );
    }
    if (Platform.OS === 'android') {
      await notificationsModule.setNotificationChannelAsync('social-alerts', {
        name: 'Sosyal bildirimler',
        importance: notificationsModule.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0ea5e9',
      });
    }
    const current = await notificationsModule.getPermissionsAsync();
    const permission =
      current.granted || current.ios?.status === notificationsModule.IosAuthorizationStatus.PROVISIONAL
        ? current
        : await notificationsModule.requestPermissionsAsync();
    return (
      permission.granted ||
      permission.ios?.status === notificationsModule.IosAuthorizationStatus.PROVISIONAL
    );
  }, [notificationsModule]);

  useEffect(() => {
    if (!user) {
      void Promise.resolve().then(() => setUnreadCount(0));
      void Promise.resolve().then(() => setUnreadMessageCount(0));
      return;
    }
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void Promise.resolve()
      .then(refreshUnreadCount)
      .then(() => {
        if (!active || !notificationsTableAvailable.current) return;
        channel = supabase
          .channel(`user-notifications-${user.id}-${++notificationsChannelSequence}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `recipient_id=eq.${user.id}`,
            },
            (payload) => {
              if (!active) return;
              const notification = payload.new as {
                id: string;
                type: string;
                title: string;
                body: string;
                related_type: string | null;
                related_id: string | null;
              };
              const scheduleNotification = async () => {
                let isMuted = false;
                if (
                  notification.type === 'message' &&
                  notification.related_type === 'chat' &&
                  notification.related_id
                ) {
                  const { data, error } = await supabase
                    .from('conversation_preferences')
                    .select('is_muted')
                    .eq('conversation_id', notification.related_id)
                    .eq('user_id', user.id)
                    .maybeSingle();
                  if (error) {
                    console.error('Sohbet sessiz ayarı okunamadı:', error);
                  } else {
                    isMuted = data?.is_muted ?? false;
                  }
                }
                if (!notificationsModule) return;
                await notificationsModule.scheduleNotificationAsync({
                  content: {
                    title: notification.title,
                    body: notification.body,
                    sound: isMuted ? false : undefined,
                    data: { notificationId: notification.id },
                    ...(Platform.OS === 'android'
                      ? { channelId: isMuted ? 'silent-messages' : 'social-alerts' }
                      : {}),
                  },
                  trigger: null,
                });
              };
              void refreshUnreadCount().catch((error: unknown) => {
                console.error('Okunmamış bildirim sayısı güncellenemedi:', error);
              });
              if (notificationsModule && notification.type !== 'message') {
                void scheduleNotification().catch((error: unknown) => {
                  console.error('Yerel bildirim gösterilemedi:', error);
                });
              } else if (notificationsModule && notification.type === 'message') {
                void scheduleNotification().catch((error: unknown) => {
                  console.error('Mesaj bildirimi gösterilemedi:', error);
                });
              }
            },
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'notifications',
              filter: `recipient_id=eq.${user.id}`,
            },
            () => {
              void refreshUnreadCount().catch((error: unknown) => {
                console.error('Okunmamış bildirim sayısı güncellenemedi:', error);
              });
            },
          )
          .subscribe((status) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.error('Bildirim Realtime kanalı bağlanamadı:', status);
            }
          });
      })
      .catch((error: unknown) => {
        console.error('Okunmamış bildirim sayısı alınamadı:', error);
      });
    const responseListener =
      notificationsModule
        ? notificationsModule.addNotificationResponseReceivedListener(() => {
            router.push('/notifications');
          })
        : null;

    return () => {
      active = false;
      responseListener?.remove();
      if (channel) void supabase.removeChannel(channel);
    };
  }, [notificationsModule, refreshUnreadCount, user]);

  const value = useMemo(
    () => ({ unreadCount, unreadMessageCount, refreshUnreadCount, requestLocalNotifications }),
    [unreadCount, unreadMessageCount, refreshUnreadCount, requestLocalNotifications],
  );
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used inside <NotificationsProvider>');
  return context;
}
