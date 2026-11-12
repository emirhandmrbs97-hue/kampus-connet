import { Alert, Linking } from 'react-native';
import { resolveStorageUrl } from '@/services/storageService';

export async function openFile(uri: string) {
  try {
    await Linking.openURL(await resolveStorageUrl(uri));
  } catch (error) {
    console.error('[storage] Failed to open stored file:', error instanceof Error ? error.message : error);
    Alert.alert(
      'Dosya açılamadı',
      error instanceof Error
        ? `Dosyaya erişilemedi. Depolama izinlerini kontrol edin. ${error.message}`
        : 'Dosyaya erişilemedi. Depolama izinlerini kontrol edin.',
    );
  }
}
