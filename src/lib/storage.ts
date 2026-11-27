// SharedPreferences equivalent for the native build. AsyncStorage is durable;
// the in-memory cache keeps the ported synchronous Prefs API intact after init().

import AsyncStorage from '@react-native-async-storage/async-storage';

const memory = new Map<string, string>();
let initialized = false;

export const Prefs = {
  /** Must be awaited once at startup before any synchronous reads. */
  async init(): Promise<void> {
    if (initialized) return;
    try {
      const keys = await AsyncStorage.getAllKeys();
      const entries = await AsyncStorage.multiGet(keys.filter((key) => key.startsWith('queless:')));
      for (const [key, value] of entries) {
        memory.set(key.slice('queless:'.length), value ?? '');
      }
    } catch {
      // Keep memory-only fallback.
    }
    initialized = true;
  },

  getString(key: string): string | null {
    return memory.get(key) ?? null;
  },

  setString(key: string, value: string): void {
    memory.set(key, value);
    void AsyncStorage.setItem(`queless:${key}`, value).catch(() => undefined);
  },

  getBool(key: string): boolean {
    return Prefs.getString(key) === 'true';
  },

  setBool(key: string, value: boolean): void {
    Prefs.setString(key, value ? 'true' : 'false');
  },

  remove(key: string): void {
    memory.delete(key);
    void AsyncStorage.removeItem(`queless:${key}`).catch(() => undefined);
  },
};

/** Preference keys, mirroring the strings used by the Flutter app. */
export const PrefKeys = {
  themeMode: 'theme_mode',
  registrationSuccessSeen: 'registration_success_seen',
  approvalWelcomeSeen: 'approval_welcome_seen',
  permissionsRequested: 'permissions_requested',
  driverDeviceId: 'driver_device_id',
  pushToken: 'queless_push_token',
  pushProvider: 'queless_push_provider',
  pushRegisteredUserId: 'queless_push_registered_user_id',
  pushTopics: 'queless_push_topics',
  batteryExempted: 'battery_optimisation_exempted',
  locationDriverId: 'location_driver_id',
  locationOrderIds: 'location_order_ids',
  driverOrdersTopic: 'DRIVER_ORDERS_READY',
} as const;
