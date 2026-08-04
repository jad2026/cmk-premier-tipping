import { Capacitor } from '@capacitor/core';

export async function nativeShare(url?: string) {
  if (!Capacitor.isNativePlatform()) return;

  const { Share } = await import('@capacitor/share');
  await Share.share({
    title: 'Club Rugby Tipping',
    text: 'Check out Club Rugby Tipping',
    url: url ?? 'https://clubrugbytipping.com',
  });
}
