export type Profile = {
  id: string;
  full_name: string;
  username: string;
  phone: string | null;
  avatar_url: string | null;
  is_private: boolean;
  bio?: string | null;
};

export type MediaType = 'image' | 'pdf';

export type PostRow = {
  id: string;
  author_id: string;
  body: string;
  media_url: string | null;
  media_type: MediaType | null;
  file_name: string | null;
  created_at: string;
  is_archived?: boolean;
  comments_disabled?: boolean;
  hide_like_count?: boolean;
};

export type PostView = PostRow & {
  author?: Profile;
  likeCount: number;
  liked: boolean;
  commentCount: number;
  is_archived?: boolean;
  commentsDisabled?: boolean;
  hideLikeCount?: boolean;
};

export type StoryRow = { id: string; author_id: string; media_url: string; created_at: string };
export type StoryGroup = { author: Profile; items: StoryRow[] };

export type ListingRow = {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  image_url: string | null;
  status: 'active' | 'sold';
  created_at: string;
};

export type ConversationStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';

export type ConversationRow = {
  id: string;
  initiator_id: string;
  recipient_id: string;
  status: ConversationStatus;
  last_message: string | null;
  last_message_at: string;
};

export type ConversationView = ConversationRow & { other?: Profile };

export type Attachment = {
  kind: 'post' | 'listing';
  id: string;
  title: string;
  subtitle?: string;
  image?: string | null;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  attachment: Attachment | null;
  created_at: string;
};
