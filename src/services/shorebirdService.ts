// Web port of lib/services/shorebird_service.dart.
//
// Shorebird delivers over-the-air Dart code patches. A Vite build ships plain
// JS/CSS assets, so the web equivalent is a normal redeploy; this module keeps
// the original API (and its "unavailable on web" answer) for parity.

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
    return 'Shorebird is not supported on Web.';
  },

  async initialize(): Promise<void> {
    // No-op on the web.
  },

  async checkForUpdate(): Promise<UpdateStatus> {
    return 'unavailable';
  },

  async update(): Promise<void> {
    // No-op on the web.
  },

  async getCurrentPatch(): Promise<Patch | null> {
    return null;
  },
};
