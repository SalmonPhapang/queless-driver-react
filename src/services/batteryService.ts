// Android battery optimisation is not a runtime permission: there is no OS
// dialog to request. The only supported action is opening the app's settings
// where the driver can turn optimisation off. iOS has no equivalent, so the
// permission screen does not show a battery tile there.
// The stored flag records that the driver was walked through the settings step;
// Android does not expose the current exemption state to a JS-only app.

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
