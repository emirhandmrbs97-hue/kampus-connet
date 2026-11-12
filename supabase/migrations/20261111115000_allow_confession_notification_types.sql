alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type = any (
      array[
        'like',
        'comment',
        'reply',
        'mention',
        'message',
        'offer',
        'listing_inquiry',
        'listing_offer',
        'follow',
        'follow_request',
        'confession_comment',
        'confession_like'
      ]::text[]
    )
  );
