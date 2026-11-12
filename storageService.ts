import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export type MediaKind = 'image' | 'pdf';
export type UploadFolder = 'avatars' | 'posts' | 'stories' | 'listings' | 'messages' | 'confessions';

export type UploadResult = { path: string; kind: MediaKind; fileName?: string };

const BUCKET = 'campus-media';
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const SIGNED_URL_CACHE_TTL_MS = 50 * 60 * 1000;
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const signedUrlRequests = new Map<string, Promise<string>>();

function decodeStoragePath(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getStorageObject(value: string): { bucket: string; path: string } | null {
  if (value.startsWith('storage://')) {
    const object = value.slice('storage://'.length);
    const separator = object.indexOf('/');
    if (separator <= 0 || separator === object.length - 1) return null;
    return {
      bucket: object.slice(0, separator),
      path: decodeStoragePath(object.slice(separator + 1)),
    };
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:\/\//i.test(value)) return null;

  if (/^https?:\/\//i.test(value)) {
    try {
      const pathname = new URL(value).pathname;
      const match = pathname.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
      if (!match) return null;
      return { bucket: decodeStoragePath(match[1]), path: decodeStoragePath(match[2]) };
    } catch {
      return null;
    }
  }

  return value.trim()
    ? { bucket: BUCKET, path: decodeStoragePath(value.replace(/^\/+/, '')) }
    : null;
}

export async function resolveStorageUrl(value: string, forceRefresh = false): Promise<string> {
  const object = getStorageObject(value);
  if (!object) return value;
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(`Oturum doğrulanamadı: ${sessionError.message}`);
  const cacheKey = `${session?.user.id ?? 'anonymous'}:${object.bucket}/${object.path}`;
  if (forceRefresh) signedUrlCache.delete(cacheKey);
  const cached = signedUrlCache.get(cacheKey);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.url;

  const pendingRequest = signedUrlRequests.get(cacheKey);
  if (pendingRequest) return pendingRequest;

  const request = supabase.storage
    .from(object.bucket)
    .createSignedUrl(object.path, SIGNED_URL_TTL_SECONDS)
    .then(({ data, error }) => {
      if (error) {
        throw new Error(
          `Depolama görseli için erişim bağlantısı oluşturulamadı. Bucket/path izinlerini kontrol edin. (${error.message})`,
        );
      }
      if (!data?.signedUrl) throw new Error('Supabase görsel için imzalı URL döndürmedi.');
      signedUrlCache.set(cacheKey, {
        url: data.signedUrl,
        expiresAt: Date.now() + SIGNED_URL_CACHE_TTL_MS,
      });
      return data.signedUrl;
    })
    .finally(() => signedUrlRequests.delete(cacheKey));
  signedUrlRequests.set(cacheKey, request);
  return request;
}

function getExtension(value: string | undefined, kind: MediaKind): string {
  const match = value?.split(/[?#]/, 1)[0].match(/\.([a-zA-Z0-9]+)$/);
  const extension = match?.[1]?.toLowerCase();
  return extension && extension.length <= 8 ? extension : kind === 'pdf' ? 'pdf' : 'jpg';
}

function getContentType(extension: string, kind: MediaKind): string {
  if (kind === 'pdf') return 'application/pdf';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'heic' || extension === 'heif') return `image/${extension}`;
  if (extension === 'png' || extension === 'webp' || extension === 'gif' || extension === 'avif') {
    return `image/${extension}`;
  }
  return 'image/jpeg';
}

export async function uploadMedia(
  localUri: string,
  options: { kind: MediaKind; folder: UploadFolder; fileName?: string; mimeType?: string },
): Promise<UploadResult> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(`Oturum alınamadı: ${sessionError.message}`);
  if (!session?.access_token) throw new Error('Medya yüklemek için tekrar giriş yapmalısın.');

  const { data: { user }, error: authError } = await supabase.auth.getUser(session.access_token);
  if (authError) throw new Error(`Oturum doğrulanamadı: ${authError.message}`);
  if (!user || user.id !== session.user.id) {
    throw new Error('Oturum kullanıcı bilgisi doğrulanamadı. Lütfen tekrar giriş yap.');
  }

  const extension = getExtension(options.fileName ?? localUri, options.kind);
  const inferredContentType = getContentType(extension, options.kind);
  const contentType = options.mimeType?.startsWith(`${options.kind}/`)
    ? options.mimeType
    : inferredContentType;
  const bytes = Platform.OS === 'web'
    ? await fetch(localUri).then(async (response) => {
        if (!response.ok) throw new Error(`Seçilen dosya okunamadı (${response.status}).`);
        return response.arrayBuffer();
      })
    : await new File(localUri).arrayBuffer();

  if (bytes.byteLength === 0) throw new Error('Seçilen dosya boş.');

  const uniqueName = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}.${extension}`;
  const path = `${options.folder}/${user.id}/${uniqueName}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType,
      upsert: false,
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  if (uploadError) {
    throw new Error(
      `Dosya Supabase Storage'a yüklenemedi (${BUCKET}/${path}): ${uploadError.message}. Oturumun ve Storage INSERT RLS politikasının kullanıcı klasörüne izin verdiğini kontrol edin.`,
    );
  }

  return { path, kind: options.kind, fileName: options.fileName };
}
