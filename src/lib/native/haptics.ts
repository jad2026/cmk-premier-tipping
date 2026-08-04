import { Capacitor } from '@capacitor/core';

export async function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'medium') {
  if (!Capacitor.isNativePlatform()) return;

  const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
  const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
  await Haptics.impact({ style: map[style] });
}

export async function hapticNotification(type: 'success' | 'warning' | 'error' = 'success') {
  if (!Capacitor.isNativePlatform()) return;

  const { Haptics, NotificationType } = await import('@capacitor/haptics');
  const map = { success: NotificationType.Success, warning: NotificationType.Warning, error: NotificationType.Error };
  await Haptics.notification({ type: map[type] });
}

export async function hapticSelection() {
  if (!Capacitor.isNativePlatform()) return;

  const { Haptics } = await import('@capacitor/haptics');
  await Haptics.selectionStart();
  await Haptics.selectionChanged();
  await Haptics.selectionEnd();
}
