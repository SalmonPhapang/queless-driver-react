// Port of lib/services/device_binding_service.dart.
//
// One driver account, one device. The install-scoped UUID lives in
// localStorage (the web equivalent of SharedPreferences) and is never
// regenerated, so a cleared storage / reinstall is deliberately a new device
// that must re-verify by SMS.

import { SupabaseConfig } from '../config/supabaseClient';
import { AppConfig } from '../config/appConfig';
import { Prefs, PrefKeys } from '../lib/storage';
import {
  DeviceBindingClient,
  DeviceBindingResult,
  DeviceDescriptor,
  isVerified,
  newDeviceUuid,
} from '../core/deviceBinding';
import { DeviceBindingPolicy } from './deviceBindingPolicy';

export interface EnsureVerifiedResult {
  ok: boolean;
  message: string;
  /** True when the driver should be walked through the SMS challenge. */
  needsVerification?: boolean;
}

const MESSAGES = {
  unverified: 'This phone still needs to be verified.',
  superseded: 'This phone is no longer your active device.',
  noPhone:
    'There is no phone number on this account, so we cannot verify this phone. Please contact Queless support.',
  failed: 'We could not check this device. Please try again.',
  invalidCode: 'That code is not correct.',
};

/** Describes this install: the stored UUID plus best-effort metadata. */
const resolveDescriptor = async (): Promise<DeviceDescriptor> => {
  let deviceId = Prefs.getString(PrefKeys.driverDeviceId)?.trim();
  if (!deviceId) {
    deviceId = newDeviceUuid();
    Prefs.setString(PrefKeys.driverDeviceId, deviceId);
    console.debug('[device] minted new device id', deviceId);
  }

  return {
    id: deviceId,
    platform: 'web',
    osVersion: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    appVersion: AppConfig.appVersion,
  };
};

export const DeviceBindingService = {
  deviceIdKey: PrefKeys.driverDeviceId,

  client: new DeviceBindingClient({
    get edge() {
      return SupabaseConfig.edge;
    },
    descriptor: resolveDescriptor,
  }),

  resolveDescriptor,

  /**
   * The device check both entry points share: cold start and sign-in.
   *
   * While device binding is switched off this answers "verified" without
   * touching the network, so a disabled switch can neither raise the SMS
   * challenge nor end a session.
   */
  async check(): Promise<DeviceBindingResult> {
    if (!DeviceBindingPolicy.required) {
      console.debug(
        `[device] binding is disabled (${DeviceBindingPolicy.source}); treating this device as verified`,
      );
      return { status: 'verified', firstVerification: false };
    }
    return DeviceBindingService.client.check();
  },

  /**
   * Runs the whole decision for a driver who has just signed in: allow the
   * session, or ask the caller to walk them through the SMS challenge first.
   */
  async ensureVerified(
    onChallenge?: () => Promise<boolean>,
  ): Promise<EnsureVerifiedResult> {
    const first = await DeviceBindingService.check();

    switch (first.status) {
      case 'verified':
        return { ok: true, message: '' };

      case 'unverified':
        if (!onChallenge) {
          return {
            ok: false,
            needsVerification: true,
            message: first.message ?? MESSAGES.unverified,
          };
        }
        if (!(await onChallenge())) {
          return { ok: false, message: 'Device verification was cancelled.' };
        }
        // The OTP dialog is not proof by itself: ask the server again before
        // letting this session through, exactly like the Dart service.
        const after = await DeviceBindingService.check();
        return isVerified(after)
          ? { ok: true, message: '' }
          : {
              ok: false,
              message: after.message ?? DeviceBindingService.messageFor(after.status),
            };

      case 'superseded':
        return {
          ok: false,
          message: first.message ?? 'This phone is no longer your active device. Sign in to take over.',
        };

      case 'no_phone':
        return { ok: false, message: first.message ?? MESSAGES.noPhone };

      case 'failed':
        // The server did not answer (flaky network, not a policy answer).
        // Signing a driver out over that would strand them mid-shift.
        console.debug('[device] binding check unavailable; continuing signed in');
        return { ok: true, message: '' };

      case 'invalid_code':
        return { ok: false, message: first.message ?? 'Please enter the verification code.' };
    }
  },

  /** Message for a status, mirroring the Dart helper. */
  messageFor(status: DeviceBindingResult['status']): string {
    switch (status) {
      case 'verified':
        return '';
      case 'unverified':
        return MESSAGES.unverified;
      case 'superseded':
        return MESSAGES.superseded;
      case 'no_phone':
        return MESSAGES.noPhone;
      case 'failed':
        return MESSAGES.failed;
      case 'invalid_code':
        return MESSAGES.invalidCode;
    }
  },

  reset(): void {
    DeviceBindingService.client.reset();
  },
};
