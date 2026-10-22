import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { invalidateProfile } from '@/services/profiles';
import type { Profile } from '@/types';

type ProfileContextValue = {
  profile: Profile | null;
  refresh: () => Promise<void>;
  updateProfile: (
    patch: Partial<
      Pick<
        Profile,
        'username' | 'avatar_url' | 'is_private' | 'full_name' | 'bio' | 'dm_privacy' | 'story_reply_privacy'
      >
    >,
  ) => Promise<string | null>;
};

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (data) {
      setProfile(data as Profile);
      return;
    }
    // Profil satırı yoksa (trigger'dan önce kayıt olmuş kullanıcılar) oluştur.
    const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
    const fallback = {
      id: user.id,
      full_name: meta.full_name ?? '',
      username: (meta.username ?? `user${user.id.replace(/-/g, '').slice(0, 8)}`).toLowerCase(),
      phone: meta.phone ?? null,
    };
    const { data: created } = await supabase.from('profiles').insert(fallback).select().maybeSingle();
    if (created) setProfile(created as Profile);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const updateProfile = useCallback<ProfileContextValue['updateProfile']>(
    async (patch) => {
      if (!user) return 'Oturum yok.';
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', user.id)
        .select()
        .single();
      if (error) {
        if (error.code === '23505') return 'Bu kullanıcı adı alınmış.';
        return error.message;
      }
      invalidateProfile(user.id);
      setProfile(data as Profile);
      return null;
    },
    [user],
  );

  const value = useMemo(() => ({ profile, refresh: load, updateProfile }), [profile, load, updateProfile]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside <ProfileProvider>');
  return ctx;
}
