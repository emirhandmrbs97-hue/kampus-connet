import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

export interface ImageResult {
  uri: string;
  type: string;
  name?: string;
  size?: number;
}

export interface DocumentResult {
  uri: string;
  type: string;
  name: string;
  size: number;
}

// Fotoğraf seçici
export const pickImage = async (options?: ImagePicker.ImagePickerOptions): Promise<ImageResult | null> => {
  try {
    // İzin iste
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      console.error('Media library permission denied');
      return null;
    }

    const defaultOptions: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      ...options,
    };

    const result = await ImagePicker.launchImageLibraryAsync(defaultOptions);

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      return {
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: asset.fileName || undefined,
        size: asset.fileSize,
      };
    }

    return null;
  } catch (error) {
    console.error('Error picking image:', error);
    return null;
  }
};

// Kamera ile fotoğraf çek
export const takePhoto = async (options?: ImagePicker.ImagePickerOptions): Promise<ImageResult | null> => {
  try {
    // İzin iste
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      console.error('Camera permission denied');
      return null;
    }

    const defaultOptions: ImagePicker.ImagePickerOptions = {
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      ...options,
    };

    const result = await ImagePicker.launchCameraAsync(defaultOptions);

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      return {
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: asset.fileName || undefined,
        size: asset.fileSize,
      };
    }

    return null;
  } catch (error) {
    console.error('Error taking photo:', error);
    return null;
  }
};

// PDF/doküman seçici
export const pickDocument = async (options?: DocumentPicker.DocumentPickerOptions): Promise<DocumentResult | null> => {
  try {
    const defaultOptions: DocumentPicker.DocumentPickerOptions = {
      type: ['application/pdf'],
      copyToCacheDirectory: true,
      ...options,
    };

    const result = await DocumentPicker.getDocumentAsync(defaultOptions);

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      return {
        uri: asset.uri,
        type: asset.mimeType || 'application/pdf',
        name: asset.name,
        size: asset.size || 0,
      };
    }

    return null;
  } catch (error) {
    console.error('Error picking document:', error);
    return null;
  }
};

// Herhangi bir dosya seçici (resim veya PDF)
export const pickAnyFile = async (): Promise<ImageResult | DocumentResult | null> => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['*/*'],
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      return {
        uri: asset.uri,
        type: asset.mimeType || 'application/octet-stream',
        name: asset.name,
        size: asset.size || 0,
      };
    }

    return null;
  } catch (error) {
    console.error('Error picking file:', error);
    return null;
  }
};
