import { createElement, useEffect, useRef, useState } from 'react';
import { Image, Platform, View, type ImageProps } from 'react-native';

import { resolveStorageUrl } from '@/services/storageService';

type StorageImageProps = Omit<ImageProps, 'source'> & {
  uri?: string | null;
};

export function StorageImage({ uri, onError, ...imageProps }: StorageImageProps) {
  const [resolvedUri, setResolvedUri] = useState<string | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);
  const imageRetryCount = useRef(0);

  useEffect(() => {
    let active = true;
    imageRetryCount.current = 0;
    setResolvedUri(undefined);
    if (!uri) return () => { active = false; };
    if (uri.startsWith('blob:')) {
      setResolvedUri(uri);
      return () => { active = false; };
    }

    const refreshTimer = setTimeout(() => setRefreshKey((key) => key + 1), 50 * 60 * 1000);
    void resolveStorageUrl(uri)
      .then((resolved) => {
        if (active) setResolvedUri(resolved);
      })
      .catch((error: unknown) => {
        console.error(
          '[storage] Failed to resolve image URL:',
          error instanceof Error ? error.message : error,
        );
      });

    return () => {
      active = false;
      clearTimeout(refreshTimer);
    };
  }, [uri, refreshKey]);

  if (Platform.OS === 'web' && uri?.startsWith('blob:')) {
    return (
      <View
        className={imageProps.className}
        style={imageProps.style}
        accessibilityLabel={imageProps.accessibilityLabel}
        testID={imageProps.testID}
      >
        {createElement('img', {
          src: uri,
          alt: imageProps.accessibilityLabel ?? '',
          draggable: false,
          style: {
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: imageProps.resizeMode === 'contain' ? 'contain' : 'cover',
          },
        })}
      </View>
    );
  }

  return (
    <Image
      {...imageProps}
      source={resolvedUri ? { uri: resolvedUri } : undefined}
      onError={(event) => {
        if (uri && !uri.startsWith('blob:') && imageRetryCount.current === 0) {
          imageRetryCount.current += 1;
          void resolveStorageUrl(uri, true)
            .then((refreshedUri) => setResolvedUri(refreshedUri))
            .catch((error: unknown) => {
              console.warn(
                '[storage] Could not refresh image URL:',
                error instanceof Error ? error.message : error,
              );
            });
        }
        onError?.(event);
      }}
    />
  );
}
