import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Heart, MessageCircle, Share2, FileText } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { Avatar } from '../ui/Avatar';

interface PostCardProps {
  id: string;
  user: {
    name: string;
    username: string;
    avatar?: string;
  };
  content: string;
  image?: string;
  pdf?: string;
  likes: number;
  comments: number;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  user,
  content,
  image,
  pdf,
  likes,
  comments,
  onLike,
  onComment,
  onShare,
}) => {
  const { isDark } = useTheme();
  const [liked, setLiked] = useState(false);

  const handleLike = () => {
    setLiked(!liked);
    onLike?.();
  };

  return (
    <View className={`mb-4 pb-4 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
      {/* Header */}
      <View className="flex-row items-center p-4">
        <Avatar uri={user.avatar} name={user.name} size={40} />
        <View className="ml-3 flex-1">
          <Text className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {user.name}
          </Text>
          <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            @{user.username}
          </Text>
        </View>
      </View>

      {/* Content */}
      <View className="px-4">
        <Text className={`mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>{content}</Text>
      </View>

      {/* Image */}
      {image && (
        <Image
          source={{ uri: image }}
          className="w-full h-64"
          resizeMode="cover"
        />
      )}

      {/* PDF */}
      {pdf && (
        <View className={`mx-4 p-4 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
          <View className="flex-row items-center">
            <FileText size={24} color="#0ea5e9" />
            <View className="ml-3 flex-1">
              <Text className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                PDF Dosyası
              </Text>
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Tıklayarak görüntüle
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Actions */}
      <View className="flex-row items-center px-4 mt-3">
        <TouchableOpacity onPress={handleLike} className="flex-row items-center mr-6">
          <Heart
            size={24}
            color={liked ? '#EF4444' : isDark ? '#9CA3AF' : '#6B7280'}
            fill={liked ? '#EF4444' : 'none'}
          />
          <Text className={`ml-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {likes + (liked ? 1 : 0)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onComment} className="flex-row items-center mr-6">
          <MessageCircle size={24} color={isDark ? '#9CA3AF' : '#6B7280'} />
          <Text className={`ml-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {comments}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onShare} className="flex-row items-center">
          <Share2 size={24} color={isDark ? '#9CA3AF' : '#6B7280'} />
        </TouchableOpacity>
      </View>
    </View>
  );
};
