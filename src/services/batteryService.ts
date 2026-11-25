// Native port of lib/services/battery_service.dart.
// iOS has no battery-optimisation exemption. Android opens device settings and
// remembers that the driver was walked through the request.

import { Linking, Platform } from 'react-native';
import { Prefs, PrefKeys } from '../lib/storage';

export const BatteryService = {
  async isExempted(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    return Prefs.getBool(PrefKeys.batteryExempted);
  },

  async requestExemption(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    Prefs.setBool(PrefKeys.batteryExempted, true);
    return true;
  },

  async openBatterySettings(): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
      await Linking.openSettings();
    } catch {
      // The permission screen remains available.
    }
  },

  async showExemptionDialog(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    await BatteryService.openBatterySettings();
    return BatteryService.requestExemption();
  },
};
