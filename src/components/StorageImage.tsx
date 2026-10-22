import { useEffect, useState } from 'react';
import { Image, type ImageProps } from 'react-native';

import { resolveMediaUrl } from '@/services/storageService';

export function StorageImage({
  uri,
  ...props
}: Omit<ImageProps, 'source'> & { uri: string | null | undefined }) {
  const [resolvedUri, setResolvedUri] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void resolveMediaUrl(uri)
      .then((value) => {
        if (active) setResolvedUri(value);
      })
      .catch((error: unknown) => {
        console.error('Medya görüntüsü yüklenemedi:', error);
        if (active) setResolvedUri(null);
      });
    return () => {
      active = false;
    };
  }, [uri]);

  return resolvedUri ? <Image {...props} source={{ uri: resolvedUri }} /> : null;
}
