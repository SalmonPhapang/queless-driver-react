// Web port of lib/services/battery_service.dart.
//
// Android OEMs aggressively kill background services; the native app asks for
// a battery-optimisation exemption. Browsers have no such concept, so every
// call is a no-op that reports success — keeping the permission screen's flow
// identical without pretending to grant something the platform lacks.

export const BatteryService = {
  /** Whether the app is already exempt from battery optimisation. */
  async isExempted(): Promise<boolean> {
    return true;
  },

  /** Attempt to grant the battery-optimisation exemption. */
  async requestExemption(): Promise<boolean> {
    return true;
  },

  /** Opens the platform's battery settings page (no-op on the web). */
  async openBatterySettings(): Promise<void> {
    // Nothing to open in a browser.
  },

  /** Shows the native explanation dialog. Always already exempt on the web. */
  async showExemptionDialog(): Promise<boolean> {
    return true;
  },
};
