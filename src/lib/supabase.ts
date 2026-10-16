import 'expo-sqlite/localStorage/install';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const isPlaceholder = (value?: string) =>
  !value || value.includes('YOUR-') || value.trim() === '';

/** false until real values are placed in .env.local */
export const isSupabaseConfigured = !isPlaceholder(url) && !isPlaceholder(key);

// createClient throws on an empty URL, so fall back to a harmless placeholder.
// This keeps the app bootable (login screen shows a warning) before keys exist.
export const supabase = createClient(
  isSupabaseConfigured ? url! : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? key! : 'placeholder-key',
  {
    auth: {
      storage: localStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

AppState.addEventListener('change', (state) => {
  if (!isSupabaseConfigured) return;
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
