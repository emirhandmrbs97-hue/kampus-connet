export type Profile = {
  id: string;
  full_name: string;
  username: string;
  phone: string | null;
  avatar_url: string | null;
  is_private: boolean;
  dm_privacy?: 'everyone' | 'followers' | 'nobody';
  story_reply_privacy?: 'everyone' | 'followers' | 'nobody';
  bio?: string | null;
  university?: string | null;
  department?: string | null;
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

export type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  parent_comment_id?: string | null;
  created_at: string;
  updated_at: string;
  is_edited: boolean;
};

export type NotificationRow = {
  id: string;
  recipient_id: string;
  user_id?: string;
  actor_id: string | null;
  type:
    | 'like'
    | 'comment'
    | 'reply'
    | 'mention'
    | 'message'
    | 'offer'
    | 'listing_inquiry'
    | 'listing_offer'
    | 'follow'
    | 'follow_request';
  title: string;
  body: string;
  related_type: 'post' | 'chat' | 'profile' | 'listing' | 'confession' | null;
  related_id: string | null;
  target_id?: string | null;
  created_at: string;
  read_at: string | null;
  is_read?: boolean;
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
  pdf_url?: string | null;
  pdf_file_name?: string | null;
  pdf_size?: number | null;
  university_name?: string | null;
  department_name?: string | null;
  grade_level?: string | null;
  status: 'active' | 'sold' | 'archived';
  created_at: string;
};

export type ListingPdfAccessRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
};

export type NoteItem = ListingRow & {
  category: 'notes' | 'pdf' | 'Ders Notları / PDF';
  pdf_url: string;
  pdf_file_name: string;
  pdf_size: number | null;
  university_name: string;
  department_name: string;
  grade_level: string;
};

export type NoteFormInput = {
  title: string;
  description: string;
  price: number;
  universityName: string;
  departmentName: string;
  gradeLevel: string;
  pdf: { uri: string; name: string; size: number | null };
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

export type ConversationView = ConversationRow & {
  other?: Profile;
  is_muted: boolean;
  is_archived: boolean;
};

export type Attachment = {
  kind: 'post' | 'listing' | 'image';
  id: string;
  title: string;
  subtitle?: string;
  image?: string | null;
  view_mode?: 'normal' | '3s' | '10s' | 'once' | 'twice';
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  attachment: Attachment | null;
  photo_views_used: number;
  created_at: string;
};
