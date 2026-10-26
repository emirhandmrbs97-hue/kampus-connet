import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

function blobFromBase64(base64: string | undefined, type: string): Blob | undefined {
  if (Platform.OS !== 'web' || !base64) return undefined;
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type });
}

export async function pickImage(
  options?: { square?: boolean },
): Promise<{ uri: string; file?: Blob; name?: string } | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: !!options?.square,
    aspect: options?.square ? [1, 1] : undefined,
    quality: 0.7,
    base64: Platform.OS === 'web',
  });
  if (result.canceled || !result.assets[0]) return null;
  return {
    uri: result.assets[0].uri,
    file:
      result.assets[0].file ??
      blobFromBase64(result.assets[0].base64 ?? undefined, result.assets[0].mimeType ?? 'image/jpeg'),
    name: result.assets[0].fileName ?? result.assets[0].file?.name,
  };
}

export async function pickPdf(): Promise<{
  uri: string;
  name: string;
  size: number | null;
  file?: Blob;
} | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
    base64: Platform.OS === 'web',
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.name,
    size: asset.size ?? null,
    file: asset.file ?? blobFromBase64(asset.base64, asset.mimeType ?? 'application/pdf'),
  };
}
