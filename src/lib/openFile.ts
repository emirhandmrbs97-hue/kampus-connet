import { Alert, Linking } from 'react-native';

export async function openFile(uri: string) {
  try {
    await Linking.openURL(uri);
  } catch {
    Alert.alert(
      'Dosya açılamadı',
      'PDF önizleme, bulut depolama (Cloudflare) bağlandığında tüm cihazlarda çalışacak.',
    );
  }
}
