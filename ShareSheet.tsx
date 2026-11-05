import { Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Share, Text, View } from 'react-native';

import { Avatar, EmptyState, Sheet } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { loadConversations, sendMessage } from '@/services/chat';
import type { Attachment, ConversationView } from '@/types';

export function ShareSheet({
  attachment,
  shareText,
  onClose,
}: {
  attachment: Attachment | null;
  shareText: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [convs, setConvs] = useState<ConversationView[]>([]);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!attachment || !user) return;
    setSent(new Set());
    setLoading(true);
    loadConversations(user.id)
      .then((all) => setConvs(all.filter((c) => c.status === 'accepted')))
      .finally(() => setLoading(false));
  }, [attachment, user]);

  const sendTo = async (c: ConversationView) => {
    if (!user || !attachment) return;
    const { error } = await sendMessage(c.id, user.id, '', attachment);
    if (error) Alert.alert('Gönderilemedi', error);
    else setSent((s) => new Set(s).add(c.id));
  };

  const shareOutside = async () => {
    try {
      await Share.share({ message: shareText });
    } catch {
      // kullanıcı iptal etti
    }
  };

  return (
    <Sheet visible={!!attachment} onClose={onClose} title="Paylaş">
      <Pressable
        onPress={shareOutside}
        className="mb-4 flex-row items-center rounded-2xl bg-primary-50 p-4 dark:bg-gray-800"
      >
        <Share2 size={20} color="#0ea5e9" />
        <Text className="ml-3 font-semibold text-primary-700 dark:text-primary-300">
          Diğer uygulamalarda paylaş
        </Text>
      </Pressable>

      <Text className="mb-2 text-sm font-semibold text-gray-500 dark:text-gray-400">Mesaj olarak gönder</Text>
      {loading ? (
        <ActivityIndicator color="#0ea5e9" />
      ) : (
        <FlatList
          data={convs}
          keyExtractor={(c) => c.id}
          ListEmptyComponent={<EmptyState title="Sohbet yok" hint="Önce Mesajlar sekmesinden biriyle yazış." />}
          renderItem={({ item }) => (
            <View className="mb-2 flex-row items-center">
              <Avatar uri={item.other?.avatar_url} name={item.other?.full_name} size={42} />
              <View className="ml-3 flex-1">
                <Text className="font-semibold text-gray-900 dark:text-white">
                  {item.other?.full_name || item.other?.username}
                </Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400">@{item.other?.username}</Text>
              </View>
              <Pressable
                onPress={() => sendTo(item)}
                disabled={sent.has(item.id)}
                className={`rounded-xl px-4 py-2 ${sent.has(item.id) ? 'bg-gray-200 dark:bg-gray-700' : 'bg-primary-500'}`}
              >
                <Text className={sent.has(item.id) ? 'text-gray-600 dark:text-gray-300' : 'font-semibold text-white'}>
                  {sent.has(item.id) ? 'Gönderildi' : 'Gönder'}
                </Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </Sheet>
  );
}
