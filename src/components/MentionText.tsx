import { router } from 'expo-router';
import { Text, type TextProps } from 'react-native';

const MENTION_PATTERN = /(^|[\s(])@([a-zA-Z0-9._]{3,20})/g;

export function MentionText({ children, ...props }: TextProps & { children: string }) {
  const parts: { text: string; username?: string }[] = [];
  let lastIndex = 0;

  for (const match of children.matchAll(MENTION_PATTERN)) {
    const index = match.index ?? 0;
    const prefix = match[1] ?? '';
    const username = match[2] ?? '';
    const mentionStart = index + prefix.length;
    if (mentionStart > lastIndex) parts.push({ text: children.slice(lastIndex, mentionStart) });
    parts.push({ text: `@${username}`, username });
    lastIndex = mentionStart + username.length + 1;
  }
  if (lastIndex < children.length) parts.push({ text: children.slice(lastIndex) });

  return (
    <Text {...props}>
      {parts.map((part, index) =>
        part.username ? (
          <Text
            key={`${part.username}-${index}`}
            className="font-semibold text-primary-700 dark:text-primary-300"
            accessibilityRole="link"
            onPress={() =>
              router.push({ pathname: '/profile/[id]', params: { id: `@${part.username}` } })
            }
          >
            {part.text}
          </Text>
        ) : (
          <Text key={`text-${index}`}>{part.text}</Text>
        ),
      )}
    </Text>
  );
}
