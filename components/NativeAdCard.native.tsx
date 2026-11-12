import Constants from 'expo-constants';
import { useEffect, useState } from 'react';

type NativeAdComponent = typeof import('./NativeAdCardImplementation').NativeAdCardImplementation;

export function NativeAdCard() {
  const [AdComponent, setAdComponent] = useState<NativeAdComponent | null>(null);

  useEffect(() => {
    if (Constants.appOwnership === 'expo') return;

    let active = true;
    void import('./NativeAdCardImplementation')
      .then(({ NativeAdCardImplementation }) => {
        if (active) setAdComponent(() => NativeAdCardImplementation);
      })
      .catch((error: unknown) => {
        console.error(
          '[ads] Native ads are unavailable in this app build:',
          error instanceof Error ? error.message : error,
        );
      });

    return () => {
      active = false;
    };
  }, []);

  return AdComponent ? <AdComponent /> : null;
}
