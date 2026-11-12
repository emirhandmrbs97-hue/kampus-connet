import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Check, MoreVertical, Pencil, Trash2 } from 'lucide-react-native';
import { useTheme } from './ThemeContext';
import { ActionSheet } from '@/components/ui';
import { StorageImage } from '@/components/StorageImage';

interface MessageBubbleProps {
  messageId: string;
  message: string;
  isOwn: boolean;
  time: string;
  isEdited?: boolean;
  imageUri?: string | null;
  attachmentTitle?: string | null;
  attachmentSubtitle?: string | null;
  onImagePress?: () => void;
  onEdit: (messageId: string, body: string) => Promise<boolean>;
  onDelete: (messageId: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  messageId,
  message,
  isOwn,
  time,
  isEdited = false,
  imageUri,
  attachmentTitle,
  attachmentSubtitle,
  onImagePress,
  onEdit,
  onDelete,
}) => {
  const { isDark } = useTheme();
  const textColor = isOwn ? 'text-white' : isDark ? 'text-white' : 'text-gray-900';
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message);
  const [saving, setSaving] = useState(false);

  const startEditing = () => {
    setEditText(message);
    setEditing(true);
  };

  const saveEdit = async () => {
    const body = editText.trim();
    if (!body || saving) return;
    setSaving(true);
    const saved = await onEdit(messageId, body);
    setSaving(false);
    if (saved) setEditing(false);
  };

  return (
    <View className={`mb-3 flex-row ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <Pressable
        onLongPress={isOwn && !editing ? () => setActionSheetVisible(true) : undefined}
        delayLongPress={350}
        disabled={editing}
        className={`max-w-[82%] overflow-hidden rounded-2xl ${
          isOwn
            ? 'rounded-br-sm bg-primary-600'
            : isDark
              ? 'rounded-bl-sm bg-gray-800'
              : 'rounded-bl-sm bg-gray-100'
        }`}
      >
        {imageUri ? (
          <Pressable
            onPress={onImagePress}
            accessibilityRole="imagebutton"
            accessibilityLabel="Görseli tam ekranda aç"
          >
            <StorageImage uri={imageUri} className="h-52 w-64 bg-gray-200 dark:bg-gray-700" resizeMode="cover" />
          </Pressable>
        ) : null}
        {attachmentTitle && !imageUri ? (
          <View className="px-3 pt-3">
            <Text className={`font-semibold ${textColor}`}>{attachmentTitle}</Text>
            {attachmentSubtitle ? (
              <Text className={`mt-1 text-sm ${isOwn ? 'text-white/75' : 'text-gray-500 dark:text-gray-400'}`}>
                {attachmentSubtitle}
              </Text>
            ) : null}
          </View>
        ) : null}
        {editing ? (
          <View className="px-3 pt-3">
            <TextInput
              autoFocus
              multiline
              value={editText}
              onChangeText={setEditText}
              editable={!saving}
              accessibilityLabel="Mesajı düzenle"
              className="min-h-12 rounded-xl bg-white/15 px-3 py-2 text-sm text-white"
            />
            <View className="mt-2 flex-row justify-end">
              <Pressable
                onPress={() => setEditing(false)}
                disabled={saving}
                className="mr-2 rounded-xl px-3 py-2"
              >
                <Text className="text-sm font-semibold text-white/80">İptal</Text>
              </Pressable>
              <Pressable
                onPress={() => void saveEdit()}
                disabled={saving || !editText.trim()}
                className={`rounded-xl bg-white/20 px-3 py-2 ${saving || !editText.trim() ? 'opacity-50' : ''}`}
              >
                <Text className="text-sm font-semibold text-white">{saving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
              </Pressable>
            </View>
          </View>
        ) : message ? (
          <Text className={`px-3 pt-2 ${textColor}`}>{message}</Text>
        ) : attachmentTitle && imageUri ? (
          <Text className={`px-3 pt-2 font-medium ${textColor}`}>{attachmentTitle}</Text>
        ) : null}
        <View className="flex-row items-center justify-end px-3 pb-2 pt-1">
          {isEdited && !editing ? (
            <Text className={`mr-1 text-[10px] ${isOwn ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
              (düzenlendi)
            </Text>
          ) : null}
          <Text className={`text-[11px] ${isOwn ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>{time}</Text>
          {isOwn ? <Check size={14} color={isDark ? '#bfdbfe' : '#dbeafe'} style={{ marginLeft: 3 }} /> : null}
          {isOwn && !editing ? (
            <Pressable
              onPress={() => setActionSheetVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Mesaj seçenekleri"
              hitSlop={8}
              className="ml-1 h-6 w-6 items-center justify-center"
            >
              <MoreVertical size={15} color={isDark ? '#bfdbfe' : '#dbeafe'} />
            </Pressable>
          ) : null}
        </View>
      </Pressable>
      {isOwn ? (
        <ActionSheet
          visible={actionSheetVisible}
          onClose={() => setActionSheetVisible(false)}
          options={[
            {
              label: 'Mesajı Düzenle',
              icon: <Pencil size={20} color="#0ea5e9" />,
              onPress: startEditing,
            },
            {
              label: 'Mesajı Sil',
              icon: <Trash2 size={20} color="#dc2626" />,
              destructive: true,
              onPress: () => onDelete(messageId),
            },
          ]}
        />
      ) : null}
    </View>
  );
};
