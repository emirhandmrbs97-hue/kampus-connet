import mobileAds, { AdsConsent } from 'react-native-google-mobile-ads';

let adsReady: Promise<boolean> | undefined;

export function ensureAdsReady(): Promise<boolean> {
  if (!adsReady) {
    adsReady = (async () => {
      const { canRequestAds } = await AdsConsent.gatherConsent();
      if (!canRequestAds) return false;
      await mobileAds().initialize();
      return true;
    })().catch((error: unknown) => {
      adsReady = undefined;
      throw error;
    });
  }
  return adsReady;
}
