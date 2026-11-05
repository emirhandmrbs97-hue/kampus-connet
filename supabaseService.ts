import { createClient } from '@supabase/supabase-js';

// Supabase konfigürasyonu - Bu değerleri environment variables'dan almalıyız
// Şimdilik placeholder değerler kullanıyoruz
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Auth helper fonksiyonları
export const auth = {
  // Kayıt ol
  signUp: async (email: string, password: string, metadata?: Record<string, any>) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });
    return { data, error };
  },

  // Giriş yap
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  // Çıkış yap
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  // Mevcut kullanıcıyı al
  getCurrentUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  },

  // Oturum değişikliklerini dinle
  onAuthStateChange: (callback: (event: any, session: any) => void) => {
    return supabase.auth.onAuthStateChange(callback);
  },
};

// Database helper fonksiyonları
export const db = {
  // Genel sorgu
  select: (table: string, columns: string = '*') => {
    return supabase.from(table).select(columns);
  },

  // Insert
  insert: (table: string, data: any) => {
    return supabase.from(table).insert(data);
  },

  // Update
  update: (table: string, data: any, id: string) => {
    return supabase.from(table).update(data).eq('id', id);
  },

  // Delete
  delete: (table: string, id: string) => {
    return supabase.from(table).delete().eq('id', id);
  },

  // Realtime subscription
  subscribe: (table: string, event: string, callback: (payload: any) => void) => {
    const channel = supabase
      .channel(`${table}-${event}`)
      .on('postgres_changes' as any, { event, table }, callback)
      .subscribe();
    return channel;
  },
};

// Storage helper fonksiyonları
export const storage = {
  // Dosya yükle
  upload: async (bucket: string, path: string, file: File | any) => {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file);
    return { data, error };
  },

  // Dosya URL'i al
  getPublicUrl: (bucket: string, path: string) => {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },

  // Dosya sil
  remove: async (bucket: string, paths: string[]) => {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    return { error };
  },
};
