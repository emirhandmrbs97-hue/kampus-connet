import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type RealtimeNotification = {
  id: string;
  actorId: string;
  name: string;
  avatarUrl: string | null;
  action: string;
};

export type NotificationCategory = 'likes' | 'comments' | 'requests' | 'mentions';

export type NotificationActivity = RealtimeNotification & {
  category: NotificationCategory;
  createdAt: string;
  preview?: string;
  relatedType?: string | null;
  relatedId?: string | null;
  isRead?: boolean;
  persisted?: boolean;
};

type ConversationMembership = {
  initiator_id: string;
  recipient_id: string;
};

const MENTION_MATCH = (username: string) => {
  const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-zA-Z0-9_])@${escaped}(?![a-zA-Z0-9_])`, 'i');
};

export function useRealtimeNotifications(userId: string | undefined) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [notification, setNotification] = useState<RealtimeNotification | null>(null);
  const [activities, setActivities] = useState<NotificationActivity[]>([]);
  const handledEvents = useRef(new Set<string>());
  const unreadMessageEvents = useRef(new Set<string>());
  const confessionNotificationIds = useRef(new Set<string>());

  const clearUnreadMessages = useCallback(() => {
    unreadMessageEvents.current.clear();
    setUnreadMessageCount(0);
  }, []);
  const dismissNotification = useCallback(() => setNotification(null), []);
  const markNotificationRead = useCallback(async (activityId: string) => {
    const activity = activities.find((item) => item.id === activityId);
    if (!activity || activity.isRead) return true;

    if (activity.persisted && userId) {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', activity.id)
        .eq('recipient_id', userId)
        .is('read_at', null);
      if (error) {
        console.error('[notifications] Failed to mark notification as read:', error.message);
        return false;
      }
    }

    setActivities((current) =>
      current.map((item) => (item.id === activityId ? { ...item, isRead: true } : item)),
    );
    setUnreadCount((count) => Math.max(0, count - 1));
    return true;
  }, [activities, userId]);
  const markAllNotificationsRead = useCallback(async () => {
    if (userId) {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('recipient_id', userId)
        .is('read_at', null);
      if (error) {
        console.error('[notifications] Failed to mark all notifications as read:', error.message);
        return false;
      }
    }

    setActivities((current) => current.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
    return true;
  }, [userId]);

  const refreshNotifications = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, title, body, related_type, related_id, created_at, read_at')
      .eq('recipient_id', userId)
      .in('type', ['confession_comment', 'confession_like', 'mention'])
      .eq('related_type', 'confession')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      console.error('[notifications] Failed to refresh confession notifications:', error.message);
      throw error;
    }

    const persisted: NotificationActivity[] = [];
    for (const row of data ?? []) {
      if (!row.related_id) continue;
        const category: NotificationCategory =
          row.type === 'confession_like' ? 'likes' : row.type === 'confession_comment' ? 'comments' : 'mentions';
        persisted.push({
          id: row.id,
          actorId: '',
          name: row.title || 'İtiraf bildirimi',
          avatarUrl: null,
          action: row.body,
          category,
          createdAt: row.created_at,
          relatedType: row.related_type,
          relatedId: row.related_id,
          isRead: row.read_at !== null,
          persisted: true,
        });
    }

    const merged = new Map(activities.filter((item) => !item.persisted).map((item) => [item.id, item]));
    activities.filter((item) => item.persisted).forEach((item) => merged.set(item.id, item));
    persisted.forEach((item) => merged.set(item.id, item));
    const next = [...merged.values()]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 100);
    setActivities(next);
    setUnreadCount(next.filter((item) => !item.isRead).length);
  }, [activities, userId]);

  useEffect(() => {
    handledEvents.current.clear();
    unreadMessageEvents.current.clear();
    confessionNotificationIds.current.clear();
    setUnreadCount(0);
    setUnreadMessageCount(0);
    setNotification(null);
    setActivities([]);
    if (!userId) return;

    let active = true;
    let currentUsername = '';

    const addActivity = (activity: NotificationActivity) => {
      if (!active) return;
      if (confessionNotificationIds.current.has(activity.id)) return;
      confessionNotificationIds.current.add(activity.id);
      setActivities((current) => {
        if (current.some((item) => item.id === activity.id)) return current;
        return [activity, ...current].slice(0, 100);
      });
      if (!activity.isRead) setUnreadCount((count) => count + 1);
    };

    const toConfessionActivity = (row: {
      id: string;
      type: string;
      title: string;
      body: string;
      related_type: string | null;
      related_id: string | null;
      created_at: string;
      read_at: string | null;
    }): NotificationActivity | null => {
      if (row.related_type !== 'confession' || !row.related_id) return null;
      const category: NotificationCategory =
        row.type === 'confession_like' ? 'likes' : row.type === 'confession_comment' ? 'comments' : 'mentions';
      return {
        id: row.id,
        actorId: '',
        name: row.title || 'İtiraf bildirimi',
        avatarUrl: null,
        action: row.body,
        category,
        createdAt: row.created_at,
        relatedType: row.related_type,
        relatedId: row.related_id,
        isRead: row.read_at !== null,
        persisted: true,
      };
    };

    const loadConfessionNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, body, related_type, related_id, created_at, read_at')
        .eq('recipient_id', userId)
        .in('type', ['confession_comment', 'confession_like', 'mention'])
        .eq('related_type', 'confession')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) {
        console.error('[notifications] Failed to load confession notifications:', error.message);
        return;
      }
      if (!active) return;
      for (const row of [...(data ?? [])].reverse()) {
        const activity = toConfessionActivity(row);
        if (activity) addActivity(activity);
      }
    };

    const notify = async (
      eventKey: string,
      actorId: string,
      action: string,
      category?: NotificationCategory,
      postId?: string,
      createdAt = new Date().toISOString(),
      preview?: string,
    ) => {
      if (!actorId || actorId === userId || handledEvents.current.has(eventKey)) return;
      handledEvents.current.add(eventKey);
      if (handledEvents.current.size > 200) {
        const oldest = handledEvents.current.values().next().value;
        if (oldest) handledEvents.current.delete(oldest);
      }

      if (postId && category !== 'mentions') {
        const { data: post, error } = await supabase
          .from('posts')
          .select('author_id')
          .eq('id', postId)
          .maybeSingle();
        if (error) {
          console.error('[notifications] Failed to resolve post owner:', error.message);
          return;
        }
        if (post?.author_id !== userId) return;
      }

      const { data: actor, error } = await supabase
        .from('profiles')
        .select('full_name, username, avatar_url')
        .eq('id', actorId)
        .maybeSingle();
      if (error) console.error('[notifications] Failed to load sender profile:', error.message);
      if (!active) return;

      const activity: RealtimeNotification = {
        id: eventKey,
        actorId,
        name: actor?.full_name || actor?.username || 'Bir kullanıcı',
        avatarUrl: actor?.avatar_url ?? null,
        action,
      };
      setNotification(activity);
      if (category) addActivity({ ...activity, category, createdAt, preview });
    };

    const loadRecentActivities = async () => {
      const [
        { data: profile, error: profileError },
        { data: posts, error: postsError },
        { data: requests, error: requestsError },
        { data: conversations, error: conversationsError },
      ] =
        await Promise.all([
          supabase.from('profiles').select('username').eq('id', userId).maybeSingle(),
          supabase.from('posts').select('id').eq('author_id', userId).order('created_at', { ascending: false }).limit(100),
          supabase
            .from('conversations')
            .select('id, initiator_id, created_at')
            .eq('recipient_id', userId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(30),
          supabase
            .from('conversations')
            .select('id')
            .or(`initiator_id.eq.${userId},recipient_id.eq.${userId}`)
            .order('created_at', { ascending: false })
            .limit(100),
        ]);
      if (!active) return;
      if (profileError) console.error('[notifications] Failed to load current username:', profileError.message);
      if (postsError) console.error('[notifications] Failed to load own posts:', postsError.message);
      if (requestsError) console.error('[notifications] Failed to load pending requests:', requestsError.message);
      if (conversationsError) console.error('[notifications] Failed to load conversations for mentions:', conversationsError.message);
      currentUsername = profile?.username ?? '';

      const postIds = (posts ?? []).map((post) => post.id);
      const requestRows = requests ?? [];
      const [{ data: likes, error: likesError }, { data: comments, error: commentsError }] = await Promise.all([
        postIds.length
          ? supabase.from('likes').select('post_id, user_id, created_at').in('post_id', postIds).order('created_at', { ascending: false }).limit(50)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('comments')
          .select('id, post_id, author_id, body, created_at')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);
      if (!active) return;
      if (likesError) console.error('[notifications] Failed to load recent likes:', likesError.message);
      if (commentsError) console.error('[notifications] Failed to load recent comments:', commentsError.message);

      const ownPostSet = new Set(postIds);
      const commentRows = comments ?? [];
      const mentionComments = currentUsername
        ? commentRows.filter((comment) => MENTION_MATCH(currentUsername).test(comment.body))
        : [];
      const conversationIds = (conversations ?? []).map((conversation) => conversation.id);
      const mentionMessagesResult =
        currentUsername && conversationIds.length
          ? await supabase
              .from('messages')
              .select('id, sender_id, body, created_at')
              .in('conversation_id', conversationIds)
              .order('created_at', { ascending: false })
              .limit(100)
          : { data: [], error: null };
      if (mentionMessagesResult.error) {
        console.error('[notifications] Failed to load recent mentions:', mentionMessagesResult.error.message);
      }

      const rawActivities: Omit<NotificationActivity, 'name' | 'avatarUrl'>[] = [
        ...(likes ?? [])
          .filter((like) => like.user_id !== userId)
          .map((like) => ({
            id: `like:${like.post_id}:${like.user_id}:${like.created_at}`,
            actorId: like.user_id,
            action: 'gönderini beğendi',
            category: 'likes' as const,
            createdAt: like.created_at,
          })),
        ...commentRows
          .filter((comment) => comment.author_id !== userId && ownPostSet.has(comment.post_id))
          .map((comment) => ({
            id: `comment:${comment.id}`,
            actorId: comment.author_id,
            action: MENTION_MATCH(currentUsername).test(comment.body) ? 'yorumunda senden bahsetti' : 'gönderine yorum yaptı',
            category: MENTION_MATCH(currentUsername).test(comment.body) ? ('mentions' as const) : ('comments' as const),
            createdAt: comment.created_at,
            preview: comment.body,
          })),
        ...mentionComments
          .filter((comment) => comment.author_id !== userId && !ownPostSet.has(comment.post_id))
          .map((comment) => ({
            id: `mention-comment:${comment.id}`,
            actorId: comment.author_id,
            action: 'yorumunda senden bahsetti',
            category: 'mentions' as const,
            createdAt: comment.created_at,
            preview: comment.body,
          })),
        ...requestRows
          .filter((request) => request.initiator_id !== userId)
          .map((request) => ({
            id: `request:${request.id}`,
            actorId: request.initiator_id,
            action: 'sana mesaj isteği gönderdi',
            category: 'requests' as const,
            createdAt: request.created_at,
          })),
        ...(mentionMessagesResult.data ?? [])
          .filter((message) => message.sender_id !== userId && MENTION_MATCH(currentUsername).test(message.body))
          .map((message) => ({
            id: `mention-message:${message.id}`,
            actorId: message.sender_id,
            action: 'mesajında senden bahsetti',
            category: 'mentions' as const,
            createdAt: message.created_at,
            preview: message.body,
          })),
      ];

      const actorIds = [...new Set(rawActivities.map((item) => item.actorId))];
      const { data: actors, error: actorsError } = actorIds.length
        ? await supabase.from('profiles').select('id, full_name, username, avatar_url').in('id', actorIds)
        : { data: [], error: null };
      if (actorsError) console.error('[notifications] Failed to load recent activity profiles:', actorsError.message);
      if (!active) return;
      const actorsById = new Map((actors ?? []).map((actor) => [actor.id, actor]));
      const recent = rawActivities
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, 100)
        .map((item) => {
          const actor = actorsById.get(item.actorId);
          return {
            ...item,
            name: actor?.full_name || actor?.username || 'Bir kullanıcı',
            avatarUrl: actor?.avatar_url ?? null,
          };
        });
      setActivities((current) => {
        const merged = new Map(recent.map((item) => [item.id, item]));
        current.forEach((item) => merged.set(item.id, item));
        return [...merged.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 100);
      });
    };

    void loadRecentActivities();
    void loadConfessionNotifications();

    const channel = supabase
      .channel('realtime-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const activity = toConfessionActivity(
            payload.new as {
              id: string;
              type: string;
              title: string;
              body: string;
              related_type: string | null;
              related_id: string | null;
              created_at: string;
              read_at: string | null;
            },
          );
          if (!activity) return;
          addActivity(activity);
          setNotification({
            id: activity.id,
            actorId: '',
            name: activity.name,
            avatarUrl: null,
            action: activity.action,
          });
        },
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const row = payload.new as { id?: string; conversation_id?: string; sender_id?: string; body?: string; created_at?: string };
        if (!row.id || !row.conversation_id || !row.sender_id || row.sender_id === userId) return;

        void supabase
          .from('conversations')
          .select('initiator_id, recipient_id')
          .eq('id', row.conversation_id)
          .maybeSingle()
          .then(({ data, error }) => {
            if (error) {
              console.error('[notifications] Failed to resolve message conversation:', error.message);
              return;
            }
            const conversation = data as ConversationMembership | null;
            if (
              conversation &&
              (conversation.initiator_id === userId || conversation.recipient_id === userId)
            ) {
              const eventKey = `message:${row.id}`;
              if (!unreadMessageEvents.current.has(eventKey)) {
                unreadMessageEvents.current.add(eventKey);
                setUnreadMessageCount((count) => count + 1);
              }
              const isMention = !!currentUsername && MENTION_MATCH(currentUsername).test(row.body ?? '');
              void notify(
                eventKey,
                row.sender_id!,
                isMention ? 'mesajında senden bahsetti' : 'sana mesaj gönderdi',
                isMention ? 'mentions' : undefined,
                undefined,
                row.created_at,
                row.body,
              );
            }
          });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'likes' }, (payload) => {
        const row = payload.new as { post_id?: string; user_id?: string; created_at?: string };
        if (row.post_id && row.user_id) {
          void notify(
            `like:${row.post_id}:${row.user_id}:${row.created_at ?? ''}`,
            row.user_id,
            'gönderini beğendi',
            'likes',
            row.post_id,
            row.created_at,
          );
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, (payload) => {
        const row = payload.new as { id?: string; post_id?: string; author_id?: string; body?: string; created_at?: string };
        if (row.id && row.post_id && row.author_id) {
          const isMention = !!currentUsername && MENTION_MATCH(currentUsername).test(row.body ?? '');
          void notify(
            `comment:${row.id}`,
            row.author_id,
            isMention ? 'yorumunda senden bahsetti' : 'gönderine yorum yaptı',
            isMention ? 'mentions' : 'comments',
            row.post_id,
            row.created_at,
            row.body,
          );
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, (payload) => {
        const row = payload.new as {
          id?: string;
          initiator_id?: string;
          recipient_id?: string;
          status?: string;
        };
        if (row.id && row.status === 'pending' && row.recipient_id === userId && row.initiator_id) {
          void notify(
            `request:${row.id}`,
            row.initiator_id,
            'sana mesaj isteği gönderdi',
            'requests',
            undefined,
            (row as { created_at?: string }).created_at,
          );
        }
      })
      .subscribe((status, error) => {
        if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && error) {
          console.error('[notifications] Realtime subscription failed:', error.message);
        }
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return {
    unreadCount,
    unreadMessageCount,
    notification,
    activities,
    clearUnreadMessages,
    markNotificationRead,
    markAllNotificationsRead,
    refreshNotifications,
    dismissNotification,
  };
}
