import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { isSupabaseConfigured, setRememberSessionPreference, supabase } from '@/lib/supabase';

type SignUpResult = { error: string | null; hasSession: boolean };

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** Hata mesajı döner, başarılıysa null. */
  signIn: (username: string, password: string, rememberSession: boolean) => Promise<string | null>;
  signUp: (email: string, password: string, metadata: Record<string, string>) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'Kullanıcı adı veya şifre hatalı.';
  if (m.includes('not confirmed')) return 'Önce e-postanı doğrulaman gerekiyor.';
  if (m.includes('already registered')) return 'Bu e-posta ile zaten bir hesap var.';
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          console.error('[auth] Failed to restore session:', error.message);
          return;
        }
        setSession(data.session);
      })
      .catch((error: unknown) => {
        console.error('[auth] Session restore request failed:', error);
      })
      .finally(() => setLoading(false));

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = useCallback<AuthContextValue['signIn']>(async (username, password, rememberSession) => {
    if (!isSupabaseConfigured) {
      return 'Supabase ayarları yüklenmemiş. .env.local dosyasını kontrol et.';
    }

    try {
      await setRememberSessionPreference(rememberSession);
      const { data, error } = await supabase.functions.invoke('login-with-username', {
        body: { username, password },
      });
      if (error) {
        const status =
          typeof error.context === 'object' && error.context !== null && 'status' in error.context
            ? error.context.status
            : undefined;
        if (status === 404) return 'Kullanıcı adıyla giriş servisi Supabase projesine dağıtılmamış.';
        if (status === 401) return 'Kullanıcı adı veya şifre hatalı.';
        if (status === 429) return 'Çok fazla giriş denemesi yapıldı. Biraz sonra tekrar dene.';
        if (typeof status === 'number') {
          console.error(`[auth] Username sign-in service returned HTTP ${status}:`, error.message);
          if (status >= 500) return 'Supabase giriş servisi şu anda hata veriyor. Biraz sonra tekrar dene.';
          return 'Giriş isteği kabul edilmedi. Kullanıcı adı ve şifre biçimini kontrol et.';
        }
        console.error('[auth] Username sign-in request failed:', error.message);
        return 'Supabase giriş servisine ulaşılamadı. Bağlantını ve servis dağıtımını kontrol et.';
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (!sessionError) return null;
      console.error('[auth] Failed to create session after username sign-in:', sessionError.message);
      return friendlyError(sessionError.message);
    } catch (error: unknown) {
      console.error('[auth] Sign-in request failed:', error);
      return 'Supabase bağlantısı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.';
    }
  }, []);

  const signUp = useCallback<AuthContextValue['signUp']>(async (email, password, metadata) => {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: metadata } });
    if (error) return { error: friendlyError(error.message), hasSession: false };
    return { error: null, hasSession: !!data.session };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ user: session?.user ?? null, session, loading, signIn, signUp, signOut }),
    [session, loading, signIn, signUp, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
