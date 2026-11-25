// Port of lib/services/device_binding_policy.dart.
//
// The authority is the database: `public.app_settings.device_binding_required`,
// which only platform admins or the service role can change, and which the
// server also *enforces*. Resolution order:
//   1. EXPO_PUBLIC_ENABLE_DEVICE_BINDING — development builds only.
//   2. The Supabase value.
//   3. true — fail secure.
//
// Deliberately no cached value: an unreachable server already means "let this
// session through" further down, and caching a disabled switch would widen the
// window in which a stale `false` keeps the gate open.

import { SupabaseConfig } from '../config/supabaseClient';
import { AppConfig } from '../config/appConfig';

const FETCH_TIMEOUT_MS = 5000;

let requiredValue = true;
let sourceValue = 'fail-secure default';

const fetchRequired = async (): Promise<boolean | null> => {
  try {
    const query = SupabaseConfig.client
      .from('app_settings')
      .select('device_binding_required')
      .limit(1)
      .maybeSingle();

    const result = await Promise.race([
      query,
      new Promise<{ data: null; error: Error }>((resolve) =>
        setTimeout(
          () => resolve({ data: null, error: new Error('timeout') }),
          FETCH_TIMEOUT_MS,
        ),
      ),
    ]);

    if (result.error) {
      console.debug('[device] binding policy: could not read app_settings:', result.error);
      return null;
    }
    const value = (result.data as Record<string, unknown> | null)?.device_binding_required;
    if (typeof value === 'boolean') return value;

    console.debug('[device] binding policy: app_settings has no readable value');
    return null;
  } catch (error) {
    console.debug('[device] binding policy: could not read app_settings:', error);
    return null;
  }
};

export const DeviceBindingPolicy = {
  get required(): boolean {
    return requiredValue;
  },

  /** Where the current decision came from, for logs and diagnostics. */
  get source(): string {
    return sourceValue;
  },

  /** Resolves the policy. Safe to call at startup: never throws, bounded. */
  async refresh(): Promise<void> {
    const override = AppConfig.deviceBindingOverride;
    // A local override skips the network entirely (development builds only).
    const isReleaseBuild = !__DEV__;
    const hasOverride = override != null && !isReleaseBuild;
    const serverValue = hasOverride ? null : await fetchRequired();

    const decision = DeviceBindingPolicy.resolve({
      envOverride: override,
      serverValue,
      isReleaseBuild,
    });

    requiredValue = decision.required;
    sourceValue = decision.source;

    console.debug(`[device] binding ${requiredValue ? 'required' : 'disabled'} (${sourceValue})`);
  },

  /** Pure decision table, kept separate from IO so it can be tested directly. */
  resolve({
    envOverride,
    serverValue,
    isReleaseBuild,
  }: {
    envOverride: boolean | null;
    serverValue: boolean | null;
    isReleaseBuild: boolean;
  }): { required: boolean; source: string } {
    if (envOverride != null && !isReleaseBuild) {
      return { required: envOverride, source: 'local .env override' };
    }
    if (serverValue != null) {
      return { required: serverValue, source: 'supabase app_settings' };
    }
    return { required: true, source: 'fail-secure default' };
  },
};
