import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const isPlaceholder = (value?: string) =>
  !value || value.includes('YOUR-') || value.trim() === '';

const REMEMBER_SESSION_KEY = 'campus-connect:remember-session';
const inMemorySessionStorage = new Map<string, string>();

const authStorage = {
  async getItem(key: string) {
    const rememberSession = await AsyncStorage.getItem(REMEMBER_SESSION_KEY);
    if (rememberSession === 'false') return inMemorySessionStorage.get(key) ?? null;
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    const rememberSession = await AsyncStorage.getItem(REMEMBER_SESSION_KEY);
    if (rememberSession === 'false') {
      inMemorySessionStorage.set(key, value);
      await AsyncStorage.removeItem(key);
      return;
    }
    inMemorySessionStorage.delete(key);
    await AsyncStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    inMemorySessionStorage.delete(key);
    await AsyncStorage.removeItem(key);
  },
};

export async function getRememberSessionPreference() {
  return (await AsyncStorage.getItem(REMEMBER_SESSION_KEY)) !== 'false';
}

export async function setRememberSessionPreference(rememberSession: boolean) {
  await AsyncStorage.setItem(REMEMBER_SESSION_KEY, String(rememberSession));
  if (rememberSession) inMemorySessionStorage.clear();
}

/** false until real values are placed in .env.local */
export const isSupabaseConfigured = !isPlaceholder(url) && !isPlaceholder(key);

// createClient throws on an empty URL, so fall back to a harmless placeholder.
// This keeps the app bootable (login screen shows a warning) before keys exist.
export const supabase = createClient(
  isSupabaseConfigured ? url! : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? key! : 'placeholder-key',
  {
    auth: {
      storage: authStorage,
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
