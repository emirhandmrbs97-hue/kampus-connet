import { FunctionsHttpError, type Session, type User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type AuthResult = { error: string | null; needsConfirmation?: boolean };
type UsernameLoginResponse = {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
  message?: string;
  msg?: string;
  code?: string;
  error_code?: string;
};
export type SignUpInput = { fullName: string; username: string; phone: string };

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, input: SignUpInput) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const NOT_CONFIGURED = 'Supabase henüz yapılandırılmadı (.env.local).';

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid_credentials')) return 'Kullanıcı adı veya şifre hatalı.';
  if (m.includes('email not confirmed')) return 'E-postanı doğrulaman gerekiyor. Gelen kutunu kontrol et.';
  if (m.includes('already registered')) return 'Bu e-posta ile zaten bir hesap var.';
  if (m.includes('rate limit')) return 'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.';
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setSession(data.session);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    // Keep this callback synchronous: awaiting Supabase calls inside it can deadlock.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback<AuthContextValue['signIn']>(async (username, password) => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };
    const { data, error } = await supabase.functions.invoke<UsernameLoginResponse>('username-login', {
      body: { username, password },
    });
    if (error) {
      if (error instanceof FunctionsHttpError) {
        try {
          const payload = (await error.context.json()) as UsernameLoginResponse;
          return {
            error: friendly(
              payload.error_description ?? payload.error ?? payload.message ?? payload.msg ?? error.message,
            ),
          };
        } catch {
          if (error.context.status === 429) {
            return { error: 'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.' };
          }
          if (error.context.status === 401) {
            return { error: 'Kullanıcı adı veya şifre hatalı; e-postanı doğruladığından emin ol.' };
          }
        }
      }
      return { error: friendly(error.message) };
    }
    if (data?.error) return { error: friendly(data.error_description ?? data.error) };
    if (!data?.access_token || !data.refresh_token) {
      return { error: 'Giriş yanıtı geçersiz. Lütfen tekrar dene.' };
    }
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    return { error: sessionError ? friendly(sessionError.message) : null };
  }, []);

  const signUp = useCallback<AuthContextValue['signUp']>(async (email, password, input) => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };
    const { data: free, error: rpcError } = await supabase.rpc('username_available', {
      u: input.username,
    });
    if (rpcError) return { error: 'Kullanıcı adı kontrol edilemedi. schema.sql çalıştırıldı mı?' };
    if (free === false) return { error: 'Bu kullanıcı adı alınmış.' };

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: input.fullName.trim(),
          username: input.username,
          phone: input.phone,
        },
      },
    });
    if (error) return { error: friendly(error.message) };
    return { error: null, needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, user: session?.user ?? null, loading, signIn, signUp, signOut }),
    [session, loading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
