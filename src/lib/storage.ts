// SharedPreferences equivalent for the web build.
//
// Flutter keeps install-scoped flags in SharedPreferences. On the web the
// equivalent durable, synchronous store is localStorage; every access is
// guarded so private-mode / disabled storage can never crash the app.

const memory = new Map<string, string>();
let storageAvailable: boolean | null = null;

const storage = (): Storage | null => {
  if (storageAvailable === false) return null;
  try {
    const probe = '__queless_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    storageAvailable = true;
    return window.localStorage;
  } catch {
    storageAvailable = false;
    return null;
  }
};

export const Prefs = {
  getString(key: string): string | null {
    const store = storage();
    if (!store) return memory.get(key) ?? null;
    try {
      return store.getItem(key) ?? memory.get(key) ?? null;
    } catch {
      return memory.get(key) ?? null;
    }
  },

  setString(key: string, value: string): void {
    memory.set(key, value);
    const store = storage();
    if (!store) return;
    try {
      store.setItem(key, value);
    } catch {
      // Keep the in-memory copy.
    }
  },

  getBool(key: string): boolean {
    return Prefs.getString(key) === 'true';
  },

  setBool(key: string, value: boolean): void {
    Prefs.setString(key, value ? 'true' : 'false');
  },

  remove(key: string): void {
    memory.delete(key);
    const store = storage();
    if (!store) return;
    try {
      store.removeItem(key);
    } catch {
      // Nothing to do.
    }
  },
};

/** Preference keys, mirroring the strings used by the Flutter app. */
export const PrefKeys = {
  themeMode: 'theme_mode',
  registrationSuccessSeen: 'registration_success_seen',
  approvalWelcomeSeen: 'approval_welcome_seen',
  permissionsRequested: 'permissions_requested',
  driverDeviceId: 'driver_device_id',
} as const;
