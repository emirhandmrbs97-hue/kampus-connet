import { ImageResult, DocumentResult } from '../utils/mediaPicker';

// Medya yükleme sonucu
export interface UploadResult {
  url: string;
  path: string;
  error?: string;
}

// Storage service - Cloudflare R2 entegrasyonu için hazırlıklı soyutlama
// Şimdilik mock implementation, sonra Cloudflare R2'ye bağlanacak

class StorageService {
  private useCloudflare: boolean = false; // Daha sonra true yapılacak

  // Medya yükleme (resim veya PDF)
  async uploadMedia(
    file: ImageResult | DocumentResult,
    userId: string,
    type: 'image' | 'document'
  ): Promise<UploadResult> {
    try {
      if (this.useCloudflare) {
        // Cloudflare R2 entegrasyonu (sonraki aşama)
        return this.uploadToCloudflare(file, userId, type);
      } else {
        // Mock implementation - local URI döndür
        return this.uploadMock(file, userId, type);
      }
    } catch (error) {
      console.error('Upload error:', error);
      return {
        url: '',
        path: '',
        error: 'Upload failed',
      };
    }
  }

  // Cloudflare R2'ye yükleme (sonraki aşama)
  private async uploadToCloudflare(
    file: ImageResult | DocumentResult,
    userId: string,
    type: 'image' | 'document'
  ): Promise<UploadResult> {
    // Cloudflare R2 S3 SDK entegrasyonu buraya gelecek
    // AWS S3 SDK kullanarak Cloudflare R2'ye bağlanacağız
    // Şimdilik placeholder
    return {
      url: file.uri,
      path: `${type}s/${userId}/${Date.now()}_${file.name || 'file'}`,
    };
  }

  // Mock yükleme - şimdilik kullanılıyor
  private async uploadMock(
    file: ImageResult | DocumentResult,
    userId: string,
    type: 'image' | 'document'
  ): Promise<UploadResult> {
    // Simüle edilmiş yükleme gecikmesi
    await new Promise(resolve => setTimeout(resolve, 500));

    // Mock URL oluştur
    const timestamp = Date.now();
    const fileName = file.name || 'file';
    const path = `${type}s/${userId}/${timestamp}_${fileName}`;
    const mockUrl = `https://mock-storage.example.com/${path}`;

    return {
      url: mockUrl,
      path,
    };
  }

  // Medya silme
  async deleteMedia(path: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.useCloudflare) {
        // Cloudflare R2'den sil
        return this.deleteFromCloudflare(path);
      } else {
        // Mock silme
        return this.deleteMock(path);
      }
    } catch (error) {
      console.error('Delete error:', error);
      return { success: false, error: 'Delete failed' };
    }
  }

  // Cloudflare R2'den silme (sonraki aşama)
  private async deleteFromCloudflare(path: string): Promise<{ success: boolean; error?: string }> {
    // Cloudflare R2 S3 SDK ile silme işlemi
    return { success: true };
  }

  // Mock silme
  private async deleteMock(path: string): Promise<{ success: boolean; error?: string }> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return { success: true };
  }

  // Cloudflare R2'yi aktif et (sonraki aşamada çağrılacak)
  enableCloudflare() {
    this.useCloudflare = true;
  }

  // Cloudflare R2'yi devre dışı bırak
  disableCloudflare() {
    this.useCloudflare = false;
  }
}

// Singleton instance
export const storageService = new StorageService();
