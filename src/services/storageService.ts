/**
 * Medya yükleme soyutlaması.
 *
 * ŞİMDİLİK: yüklemeyi taklit eder ve yerel URI'yi aynen döndürür. Bu yüzden
 * yüklenen görseller/PDF'ler yalnızca yükleyen cihazda görünür.
 *
 * SONRA (Cloudflare): yalnızca bu dosyadaki `uploadMedia` içini değiştir:
 *   1) Cloudflare R2/Images için imzalı yükleme URL'si al
 *   2) dosyayı PUT/POST ile yükle
 *   3) kalıcı herkese açık URL'yi `url` olarak döndür
 * Uygulamanın geri kalanı değişmez.
 */
export type MediaKind = 'image' | 'pdf';
export type UploadFolder = 'avatars' | 'posts' | 'stories' | 'listings';

export type UploadResult = { url: string; kind: MediaKind; fileName?: string };

export async function uploadMedia(
  localUri: string,
  options: { kind: MediaKind; folder: UploadFolder; fileName?: string },
): Promise<UploadResult> {
  return { url: localUri, kind: options.kind, fileName: options.fileName };
}
