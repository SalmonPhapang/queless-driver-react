// Port of queless_core/lib/device/device_binding.dart.
//
// One driver account, one device. This is the app-side half of the
// `driver-device-verify` edge function: it asks the server whether this device
// is still the account's active one, and drives the SMS challenge when it is
// not.
//
// The device id is a UUID minted once per install and stored locally — never
// an OS identifier. A reinstall is deliberately a new device: it must
// re-verify by SMS.

import type { EdgeClient } from './edgeClient';
import { EdgeFunctionException } from './edgeClient';

export const DEVICE_BINDING_FUNCTION = 'driver-device-verify';

export type DeviceBindingStatus =
  | 'verified'
  | 'unverified'
  | 'superseded'
  | 'invalid_code'
  | 'no_phone'
  | 'failed';

export interface DeviceBindingResult {
  status: DeviceBindingStatus;
  message?: string;
  /** True when this result came from passing the SMS challenge. */
  firstVerification: boolean;
}

export interface DeviceOtpSendResult {
  sent: boolean;
  message?: string;
  /** Set when the server throttled the request (resend too soon). */
  retryAfterSeconds?: number;
}

export interface DeviceDescriptor {
  id: string;
  platform?: string;
  osVersion?: string;
  appVersion?: string;
}

export const isVerified = (result: DeviceBindingResult): boolean => result.status === 'verified';

/**
 * Whether the app must end the session: the device is either not current or
 * not verifiable. `failed` deliberately does not sign anyone out.
 */
export const shouldSignOut = (result: DeviceBindingResult): boolean =>
  result.status === 'superseded' || result.status === 'unverified' || result.status === 'no_phone';

/** A UUID v4, minted once per install. */
export const newDeviceUuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const statusOf = (status: string): DeviceBindingStatus => {
  switch (status) {
    case 'verified':
      return 'verified';
    case 'superseded':
      return 'superseded';
    case 'no_phone':
      return 'no_phone';
    case 'unverified':
      return 'unverified';
    default:
      return 'failed';
  }
};

const messageOf = (data: unknown): string | undefined => {
  if (!data || typeof data !== 'object') return undefined;
  const raw = (data as Record<string, unknown>).message;
  const message = raw == null ? '' : String(raw).trim();
  return message.length > 0 ? message : undefined;
};

const parse = (data: unknown, firstVerification = false): DeviceBindingResult => {
  if (!data || typeof data !== 'object') {
    return { status: 'failed', firstVerification };
  }
  const status = String((data as Record<string, unknown>).status ?? '')
    .trim()
    .toLowerCase();
  return { status: statusOf(status), message: messageOf(data), firstVerification };
};

const descriptorPayload = (descriptor: DeviceDescriptor): Record<string, unknown> => ({
  device_id: descriptor.id,
  ...(descriptor.platform ? { platform: descriptor.platform } : {}),
  ...(descriptor.osVersion ? { os_version: descriptor.osVersion } : {}),
  ...(descriptor.appVersion ? { app_version: descriptor.appVersion } : {}),
});

export class DeviceBindingClient {
  private readonly edge: EdgeClient;
  private readonly descriptor: () => Promise<DeviceDescriptor>;
  private resolved: DeviceDescriptor | null = null;

  constructor(options: {
    edge: EdgeClient;
    descriptor: () => Promise<DeviceDescriptor>;
  }) {
    this.edge = options.edge;
    this.descriptor = options.descriptor;
  }

  /** The device id, resolved once per app run. */
  async deviceId(): Promise<string | null> {
    return (await this.resolveDescriptor())?.id ?? null;
  }

  private async resolveDescriptor(): Promise<DeviceDescriptor | null> {
    if (this.resolved) return this.resolved;
    const descriptor = await this.descriptor();
    if (!descriptor.id.trim()) return null;
    this.resolved = descriptor;
    return descriptor;
  }

  /** Is this device still the account's active device? */
  async check(): Promise<DeviceBindingResult> {
    const descriptor = await this.resolveDescriptor();
    if (!descriptor) {
      return { status: 'failed', message: 'This device has no identity yet.', firstVerification: false };
    }
    try {
      const data = await this.edge.call(DEVICE_BINDING_FUNCTION, {
        body: { action: 'check', ...descriptorPayload(descriptor) },
      });
      return parse(data);
    } catch (error) {
      console.debug('[device] check failed:', error);
      return {
        status: 'failed',
        message: 'We could not check this device. Please try again.',
        firstVerification: false,
      };
    }
  }

  /** Sends the SMS challenge to the account's own number. */
  async sendVerificationCode(): Promise<DeviceOtpSendResult> {
    const descriptor = await this.resolveDescriptor();
    if (!descriptor) {
      return { sent: false, message: 'This device has no identity yet.' };
    }
    try {
      const data = await this.edge.call(DEVICE_BINDING_FUNCTION, {
        body: { action: 'send_otp', ...descriptorPayload(descriptor) },
      });
      return { sent: true, message: messageOf(data) };
    } catch (error) {
      if (error instanceof EdgeFunctionException) {
        const payload =
          error.data && typeof error.data === 'object'
            ? (error.data as Record<string, unknown>)
            : {};
        const retry = payload.retry_after_seconds;
        return {
          sent: false,
          message: error.message,
          retryAfterSeconds: typeof retry === 'number' ? retry : undefined,
        };
      }
      console.debug('[device] sendVerificationCode failed:', error);
      return { sent: false, message: 'We could not send the code. Please try again.' };
    }
  }

  /** Confirms the code the driver typed and makes this the active device. */
  async verifyCode(code: string): Promise<DeviceBindingResult> {
    const trimmed = code.trim();
    if (!trimmed) {
      return {
        status: 'failed',
        message: 'Please enter the verification code.',
        firstVerification: false,
      };
    }
    const descriptor = await this.resolveDescriptor();
    if (!descriptor) {
      return { status: 'failed', message: 'This device has no identity yet.', firstVerification: false };
    }
    try {
      const data = await this.edge.call(DEVICE_BINDING_FUNCTION, {
        body: { action: 'verify_otp', code: trimmed, ...descriptorPayload(descriptor) },
      });
      return parse(data, true);
    } catch (error) {
      // Wrong or expired code: keep the driver on the verification screen.
      if (error instanceof EdgeFunctionException) {
        return { status: 'invalid_code', message: error.message, firstVerification: false };
      }
      console.debug('[device] verifyCode failed:', error);
      return {
        status: 'failed',
        message: 'We could not verify the code. Please try again.',
        firstVerification: false,
      };
    }
  }

  /** Forget the resolved descriptor — used by a full sign-out. */
  reset(): void {
    this.resolved = null;
  }
}
