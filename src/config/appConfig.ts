// Port of lib/app_config.dart.
//
// Flutter reads these from `.env` via flutter_dotenv. Vite exposes only
// variables prefixed with VITE_, so the React app reads VITE_* equivalents
// (see `.env.example`). Behaviour and precedence are otherwise identical.

export type AppEnvironment = 'dev' | 'stage' | 'prod';

const rawEnv = (key: string): string | undefined => {
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return typeof value === 'string' ? value : undefined;
};

/**
 * Parses a boolean feature flag, returning `fallback` for a missing or
 * unrecognised value.
 */
export const parseBoolFlag = (value: string | null | undefined, fallback = true): boolean =>
  parseBoolFlagOrNull(value) ?? fallback;

/**
 * Like `parseBoolFlag` but returns null when the value is absent or not
 * recognisable, so callers can tell "unset" apart from "explicitly false".
 */
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
  /** Push notifications are a first-class feature (Web Push on the web build). */
  featureFirebase: true,

  /** Current app type: 'user', 'store', or 'driver'. */
  appType: 'driver' as const,

  get env(): AppEnvironment {
    const value = (rawEnv('VITE_APP_ENV') ?? 'dev').trim().toLowerCase();
    return value === 'prod' || value === 'stage' ? value : 'dev';
  },

  get isDev(): boolean {
    return AppConfig.env === 'dev';
  },

  /**
   * Local override for the device binding policy, for development only.
   *
   * The authoritative value lives in Supabase
   * (`app_settings.device_binding_required`), which is what
   * `DeviceBindingPolicy` follows. `VITE_ENABLE_DEVICE_BINDING=false` exists so
   * a driver build can be tested on a device that cannot receive the account's
   * SMS, without touching the shared project; production builds ignore it.
   * `null` means "no override, follow Supabase".
   */
  get deviceBindingOverride(): boolean | null {
    return parseBoolFlagOrNull(rawEnv('VITE_ENABLE_DEVICE_BINDING'));
  },

  /**
   * Percentage the main Queless account retains from each payment made to a
   * driver's Paystack subaccount. The rest is settled to the driver.
   */
  get paystackSubaccountPercentageCharge(): number {
    const parsed = Number.parseFloat(rawEnv('VITE_PAYSTACK_SUBACCOUNT_PERCENTAGE_CHARGE') ?? '0');
    return Number.isFinite(parsed) ? parsed : 0;
  },

  /** PackageInfo.version equivalent (set at build time). */
  get appVersion(): string {
    return rawEnv('VITE_APP_VERSION') ?? '1.0.1';
  },

  /** PackageInfo.buildNumber equivalent (set at build time). */
  get appBuildNumber(): number {
    const parsed = Number.parseInt(rawEnv('VITE_APP_BUILD_NUMBER') ?? '1', 10);
    return Number.isFinite(parsed) ? parsed : 1;
  },

  get supabaseUrl(): string {
    return rawEnv('VITE_SUPABASE_URL') ?? '';
  },

  get supabaseAnonKey(): string {
    return rawEnv('VITE_SUPABASE_ANON_KEY') ?? '';
  },

  /** True when the Supabase configuration is missing from the build. */
  get isSupabaseConfigured(): boolean {
    return AppConfig.supabaseUrl.length > 0 && AppConfig.supabaseAnonKey.length > 0;
  },
};
