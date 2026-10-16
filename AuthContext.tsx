import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { auth } from '../services/supabaseService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, metadata?: Record<string, any>) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mevcut kullanıcıyı kontrol et
    auth.getCurrentUser().then(({ user }) => {
      setUser(user);
      setLoading(false);
    });

    // Auth state değişikliklerini dinle
    const { data: { subscription } } = auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, metadata?: Record<string, any>) => {
    const result = await auth.signUp(email, password, metadata);
    if (result.data.user) {
      setUser(result.data.user);
    }
    return result;
  };

  const signIn = async (email: string, password: string) => {
    const result = await auth.signIn(email, password);
    if (result.data.user) {
      setUser(result.data.user);
    }
    return result;
  };

  const signOut = async () => {
    const result = await auth.signOut();
    setUser(null);
    return result;
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
