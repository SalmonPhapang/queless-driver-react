// Shorebird is a Dart-only OTA patcher. The Expo driver uses the app-version
// gate (VersionService) for mandatory updates, so this module exists only to
// keep the original service API available to any ported call sites.

export type UpdateStatus = 'upToDate' | 'outdated' | 'restartRequired' | 'unavailable';

export interface Patch {
  number: number;
  version: string;
}

export const ShorebirdService = {
  get isAvailable(): boolean {
    return false;
  },

  get unavailabilityReason(): string {
    return 'Shorebird patches are not available in the native Expo driver.';
  },

  async initialize(): Promise<void> {
    // No-op: VersionService owns update checks.
  },

  async checkForUpdate(): Promise<UpdateStatus> {
    return 'unavailable';
  },

  async update(): Promise<void> {
    // No-op: VersionService directs drivers to the app stores.
  },

  async getCurrentPatch(): Promise<Patch | null> {
    return null;
  },
};
