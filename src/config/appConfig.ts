// Native equivalent of lib/app_config.dart / the Vite appConfig.
// Public configuration only. Secrets must never be EXPO_PUBLIC_*.

import Constants from 'expo-constants';

export type AppEnvironment = 'dev' | 'stage' | 'prod';

const rawEnv = (key: string): string | undefined => {
  const value = process.env[key];
  return typeof value === 'string' ? value : undefined;
};

export const parseBoolFlag = (value: string | null | undefined, fallback = true): boolean =>
  parseBoolFlagOrNull(value) ?? fallback;

export const parseBoolFlagOrNull = (value: string | null | undefined): boolean | null => {
  switch (value?.trim().toLowerCase()) {
    case 'true':
    case '1':
    case 'yes':
    case 'on':
      return true;
    case 'false':
    case '0':
    case 'no':
    case 'off':
      return false;
    default:
      return null;
  }
};

export const AppConfig = {
  featureFirebase: true,
  appType: 'driver' as const,

  get env(): AppEnvironment {
    const value = (rawEnv('EXPO_PUBLIC_APP_ENV') ?? 'dev').trim().toLowerCase();
    return value === 'prod' || value === 'stage' ? value : 'dev';
  },

  get isDev(): boolean {
    return AppConfig.env === 'dev' || __DEV__;
  },

  /** Development-only override; production builds always follow Supabase. */
  get deviceBindingOverride(): boolean | null {
    return parseBoolFlagOrNull(rawEnv('EXPO_PUBLIC_ENABLE_DEVICE_BINDING'));
  },

  get paystackSubaccountPercentageCharge(): number {
    const parsed = Number.parseFloat(
      rawEnv('EXPO_PUBLIC_PAYSTACK_SUBACCOUNT_PERCENTAGE_CHARGE') ?? '0',
    );
    return Number.isFinite(parsed) ? parsed : 0;
  },

  get appVersion(): string {
    return Constants.expoConfig?.version ?? rawEnv('EXPO_PUBLIC_APP_VERSION') ?? '1.0.1';
  },

  get appBuildNumber(): number {
    const native =
      Constants.expoConfig?.ios?.buildNumber ??
      Constants.expoConfig?.android?.versionCode?.toString();
    const parsed = Number.parseInt(native ?? rawEnv('EXPO_PUBLIC_APP_BUILD_NUMBER') ?? '1', 10);
    return Number.isFinite(parsed) ? parsed : 1;
  },

  get supabaseUrl(): string {
    return rawEnv('EXPO_PUBLIC_SUPABASE_URL') ?? '';
  },

  get supabaseAnonKey(): string {
    return rawEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY') ?? '';
  },

  get isSupabaseConfigured(): boolean {
    return AppConfig.supabaseUrl.length > 0 && AppConfig.supabaseAnonKey.length > 0;
  },
};
