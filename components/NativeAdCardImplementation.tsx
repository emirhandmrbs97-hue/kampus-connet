import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import {
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
  TestIds,
  useNativeAd,
} from 'react-native-google-mobile-ads';

import { ensureAdsReady } from '../services/ads.native';

export function NativeAdCardImplementation() {
  const [canRequestAds, setCanRequestAds] = useState<boolean | null>(null);
  const { nativeAd, status, error, retry } = useNativeAd({
    adUnitId: TestIds.NATIVE,
    autoLoad: false,
  });

  useEffect(() => {
    let active = true;
    void ensureAdsReady()
      .then((allowed) => {
        if (!active) return;
        setCanRequestAds(allowed);
        if (allowed) retry();
      })
      .catch((loadError: unknown) => {
        console.error(
          '[ads] Unable to initialize native ads:',
          loadError instanceof Error ? loadError.message : loadError,
        );
      });
    return () => {
      active = false;
    };
  }, [retry]);

  if (canRequestAds === false) return null;

  if (status === 'no-fill' || status === 'error') {
    if (status === 'error') {
      console.error('[ads] Native ad request failed:', error?.message ?? 'Unknown ad error');
    }
    return null;
  }

  if (!nativeAd) {
    return (
      <View
        accessibilityLabel="Sponsorlu içerik yükleniyor"
        className="mx-4 mb-4 h-64 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
      >
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          {status === 'loading' ? 'Sponsorlu içerik yükleniyor...' : 'Sponsorlu içerik'}
        </Text>
      </View>
    );
  }

  return (
    <NativeAdView
      nativeAd={nativeAd}
      className="mx-4 mb-4 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
    >
      <View className="p-4">
        <View className="mb-3 flex-row items-center justify-between">
          <View className="flex-row items-center">
            {nativeAd.icon?.url ? (
              <NativeAsset assetType={NativeAssetType.ICON}>
                <Image source={{ uri: nativeAd.icon.url }} className="mr-2 h-8 w-8 rounded-lg" />
              </NativeAsset>
            ) : null}
            <NativeAsset assetType={NativeAssetType.ADVERTISER}>
              <Text className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {nativeAd.advertiser || 'Sponsor'}
              </Text>
            </NativeAsset>
          </View>
          <Text className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Sponsorlu · Test
          </Text>
        </View>

        <NativeAsset assetType={NativeAssetType.HEADLINE}>
          <Text className="text-lg font-bold text-gray-900 dark:text-white">
            {nativeAd.headline || 'Keşfet'}
          </Text>
        </NativeAsset>
        {nativeAd.body ? (
          <NativeAsset assetType={NativeAssetType.BODY}>
            <Text numberOfLines={2} className="mt-1 text-sm leading-5 text-gray-600 dark:text-gray-300">
              {nativeAd.body}
            </Text>
          </NativeAsset>
        ) : null}

        <NativeMediaView
          resizeMode="cover"
          className="mt-3 h-40 w-full overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-700"
        />

        <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
          <View className="mt-3 items-center rounded-xl bg-primary-500 px-4 py-3">
            <Text className="text-sm font-bold text-white">
              {nativeAd.callToAction || 'İncele / Keşfet'}
            </Text>
          </View>
        </NativeAsset>
      </View>
    </NativeAdView>
  );
}
