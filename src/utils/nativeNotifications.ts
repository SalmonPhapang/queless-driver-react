import Constants from 'expo-constants';
import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

let notificationsModule: NotificationsModule | null = null;

// SDK 53+ removed the native notification modules from Expo Go. The JS package
// can still be required, but the first native call throws, so do not load it at
// all there. Development builds and standalone apps include the native module.
if (Platform.OS !== 'web' && Constants.appOwnership !== 'expo') {
  try {
    notificationsModule = require('expo-notifications') as NotificationsModule;
  } catch (error) {
    console.warn('[notifications] Native module unavailable; push disabled:', error);
    notificationsModule = null;
  }
}

/** Null in Expo Go or stale native clients that cannot call notification APIs. */
export function getNotificationsModule(): NotificationsModule | null {
  return notificationsModule;
}
