import { supabase } from '@/lib/supabase';

export type MediaKind = 'image' | 'pdf';
export type UploadFolder = 'avatars' | 'posts' | 'stories' | 'listings' | 'messages';

export type UploadResult = { url: string; kind: MediaKind; fileName?: string };

const MEDIA_BUCKET = 'campus-media';
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const PDF_SIGNED_URL_TTL_SECONDS = 10 * 60;
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

function extensionFromName(name: string | undefined, fallback: string): string {
  const match = name?.toLowerCase().match(/\.([a-z0-9]{2,5})(?:[?#].*)?$/);
  return match?.[1] ?? fallback;
}

async function readLocalFile(uri: string, pickedFile?: Blob): Promise<ArrayBuffer> {
  if (pickedFile) {
    const file = await pickedFile.arrayBuffer();
    if (file.byteLength === 0) throw new Error('Seçilen dosya boş.');
    return file;
  }
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Dosya okunamadı (HTTP ${response.status}).`);
  const file = await response.arrayBuffer();
  if (file.byteLength === 0) throw new Error('Dosya boş.');
  return file;
}

export async function resolveMediaUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (/^(file:|content:|data:)/i.test(value)) return value;

  const storageUrl = value.match(
    /\/storage\/v1\/object\/(?:public|sign|authenticated)\/campus-media\/([^?#]+)/i,
  );
  let path = value;
  if (/^https?:/i.test(value)) {
    if (!storageUrl) return value;
    try {
      path = decodeURIComponent(storageUrl[1]);
    } catch {
      throw new Error('Depolama görselinin yolu çözümlenemedi.');
    }
  }

  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.url;

  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(
    path,
    SIGNED_URL_TTL_SECONDS,
  );
  if (error) throw error;
  signedUrlCache.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
  });
  return data.signedUrl;
}

export async function createEphemeralMediaUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(path, 30);
  if (error) throw error;
  return data.signedUrl;
}

export async function uploadMarketplacePdf(
  localUri: string,
  fileName: string,
  userId: string,
  pickedFile?: Blob,
): Promise<{ url: string; size: number }> {
  const file = await readLocalFile(localUri, pickedFile);
  const safeName = fileName.trim().replace(/[^a-zA-Z0-9._-]/g, '_') || 'ders-notu.pdf';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
  const { error } = await supabase.storage.from('marketplace-pdfs').upload(path, file, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (error) throw error;
  return { url: path, size: file.byteLength };
}

export async function resolveMarketplacePdfUrl(pathOrUrl: string): Promise<string> {
  const marker = '/storage/v1/object/public/marketplace-pdfs/';
  const markerIndex = pathOrUrl.indexOf(marker);
  const path =
    markerIndex >= 0
      ? decodeURIComponent(pathOrUrl.slice(markerIndex + marker.length).split('?')[0] ?? '')
      : pathOrUrl;
  if (/^https?:/i.test(path)) return path;
  const { data, error } = await supabase.storage
    .from('marketplace-pdfs')
    .createSignedUrl(path, PDF_SIGNED_URL_TTL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteMarketplacePdf(pathOrUrl: string | null | undefined): Promise<void> {
  if (!pathOrUrl) return;
  const marker = '/storage/v1/object/public/marketplace-pdfs/';
  const markerIndex = pathOrUrl.indexOf(marker);
  const path =
    markerIndex >= 0
      ? decodeURIComponent(pathOrUrl.slice(markerIndex + marker.length).split('?')[0] ?? '')
      : pathOrUrl;
  if (!path || /^https?:/i.test(path)) return;

  const { error } = await supabase.storage.from('marketplace-pdfs').remove([path]);
  if (error) throw error;
}

export async function uploadMedia(
  localUri: string,
  options: { kind: MediaKind; folder: UploadFolder; fileName?: string; file?: Blob },
): Promise<UploadResult> {
  const file = await readLocalFile(localUri, options.file);
  const pickedFileName =
    options.file && 'name' in options.file && typeof options.file.name === 'string'
      ? options.file.name
      : undefined;
  const fileName = options.fileName ?? pickedFileName;
  const extension = extensionFromName(fileName ?? localUri, 'jpg');
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('Medya yüklemek için giriş yapmalısınız.');
  const allowedImageExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic']);
  const imageExtension = allowedImageExtensions.has(extension) ? extension : 'jpg';
  const uploadExtension = options.kind === 'pdf' ? extension : imageExtension;
  const imageContentType =
    options.file && 'type' in options.file && options.file.type.startsWith('image/')
      ? options.file.type
      : `image/${imageExtension === 'jpg' ? 'jpeg' : imageExtension}`;
  const path = `${authData.user.id}/${options.folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${uploadExtension}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    contentType:
      options.kind === 'pdf'
        ? 'application/pdf'
        : imageContentType,
    upsert: false,
  });
  if (error) throw error;
  return { url: path, kind: options.kind, fileName };
}
