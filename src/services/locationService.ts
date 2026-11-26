// Native port of lib/services/location_service.dart using expo-location.
// The foreground service now runs for the whole online shift, not only after a
// pickup: dispatch needs a fresh per-driver location before an order exists.
// Active deliveries switch it to higher-frequency tracking.

import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';
import { BackgroundLocationService } from './backgroundLocationService';
import { OrderService } from './orderService';
import { calculateDistance } from '../lib/geo';

export interface DriverGeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
}

export interface OnlinePresenceResult {
  ok: boolean;
  backgroundTracking: boolean;
}

export const LOCATION_SETTINGS_HELP =
  Platform.OS === 'android'
    ? 'Open your device Settings, then allow Queless Driver to use Location.'
    : 'Open your device Settings, then allow Queless Driver to use Location Services.';

let trackedDriverId: string | null = null;
let trackedOrderIds: string[] = [];
let lastPublishedAt: number | null = null;
let lastPresencePublishedAt: number | null = null;
// Set only while drivers.status is online. It keeps idle drivers dispatchable
// and prevents active-delivery tracking teardown from stopping online presence.
let onlineDriverId: string | null = null;

const toPosition = (location: Location.LocationObject): DriverGeoPosition => ({
  latitude: location.coords.latitude,
  longitude: location.coords.longitude,
  accuracy: location.coords.accuracy ?? null,
  speed: location.coords.speed ?? null,
  heading: location.coords.heading ?? null,
});

const readPosition = async (): Promise<DriverGeoPosition | null> => {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return toPosition(location);
  } catch (error) {
    console.debug('Location error:', error);
    return null;
  }
};

const publishPresence = async (
  driverId: string,
  position: DriverGeoPosition,
): Promise<void> => {
  const now = Date.now();
  if (lastPresencePublishedAt != null && now - lastPresencePublishedAt < 3000) return;
  lastPresencePublishedAt = now;

  await OrderService.publishDriverLocation({
    driverId,
    lat: position.latitude,
    lng: position.longitude,
    accuracy: position.accuracy,
    speed: position.speed,
    heading: position.heading,
  });
};

const publishPosition = async (position: DriverGeoPosition): Promise<void> => {
  if (!trackedDriverId || trackedOrderIds.length === 0) return;
  const now = Date.now();
  if (lastPublishedAt != null && now - lastPublishedAt < 3000) return;
  lastPublishedAt = now;

  try {
    await OrderService.updateDriverLocation({
      orderIds: trackedOrderIds,
      orderId: trackedOrderIds[0],
      driverId: trackedDriverId,
      lat: position.latitude,
      lng: position.longitude,
      accuracy: position.accuracy,
      speed: position.speed,
      heading: position.heading,
    });
  } catch (error) {
    console.debug('Failed to publish driver position:', error);
  }
};

const sameSession = (driverId: string, sortedIds: string[]): boolean =>
  trackedDriverId === driverId &&
  trackedOrderIds.length === sortedIds.length &&
  trackedOrderIds.join('|') === sortedIds.join('|') &&
  BackgroundLocationService.isRunning;

const ensureIdlePresence = async (driverId: string): Promise<void> => {
  if (sameSession(driverId, [])) return;
  await BackgroundLocationService.start({ driverId, orderIds: [] });
  trackedDriverId = driverId;
  trackedOrderIds = [];
};

export const LocationService = {
  async hasPermission(): Promise<boolean> {
    const permission = await Location.getForegroundPermissionsAsync();
    return permission.granted;
  },

  async isPermissionDeniedForever(): Promise<boolean> {
    const permission = await Location.getForegroundPermissionsAsync();
    return permission.status === Location.PermissionStatus.DENIED && !permission.canAskAgain;
  },

  async openLocationSettings(): Promise<string> {
    try {
      await Linking.openSettings();
    } catch {
      // Screen shows the help text inline if settings cannot be opened.
    }
    return LOCATION_SETTINGS_HELP;
  },

  async requestPermission(): Promise<boolean> {
    const existing = await Location.getForegroundPermissionsAsync();
    if (existing.granted) return true;
    if (!existing.canAskAgain) return false;
    const requested = await Location.requestForegroundPermissionsAsync();
    return requested.granted;
  },

  get isTracking(): boolean {
    return BackgroundLocationService.isRunning;
  },

  async getCurrentPosition(): Promise<DriverGeoPosition | null> {
    if (!(await LocationService.requestPermission())) return null;
    return readPosition();
  },

  calculateDistance,

  /**
   * Called when the driver confirms "Go online". Publishes the first fix
   * immediately so dispatch can rank this driver, then enables background
   * tracking so the fix stays fresh when the app is not foregrounded.
   */
  async startOnlinePresence(driverId: string): Promise<OnlinePresenceResult> {
    const result: OnlinePresenceResult = { ok: false, backgroundTracking: false };
    lastPresencePublishedAt = null;

    let permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (!permission.granted) return result;

    const position = await readPosition();
    if (!position) return result;

    try {
      await publishPresence(driverId, position);
    } catch (error) {
      console.debug('Online presence publish failed:', error);
      return result;
    }

    onlineDriverId = driverId;
    trackedDriverId = driverId;
    trackedOrderIds = [];
    result.ok = true;

    try {
      const background = await Location.requestBackgroundPermissionsAsync();
      result.backgroundTracking = background.granted;
    } catch (error) {
      console.debug('Background location permission request failed:', error);
    }

    try {
      const started = await BackgroundLocationService.start({ driverId, orderIds: [] });
      if (!started) result.backgroundTracking = false;
    } catch (error) {
      result.backgroundTracking = false;
      console.debug('Online background tracking could not start:', error);
    }

    return result;
  },

  /**
   * Called on app start / profile load when the driver is already online.
   * Never prompts: a revoked permission must not cause a surprise OS dialog.
   */
  async resumeOnlinePresence(driverId: string): Promise<boolean> {
    onlineDriverId = driverId;
    lastPresencePublishedAt = null;

    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) return false;

    const position = await readPosition();
    if (position) {
      try {
        await publishPresence(driverId, position);
      } catch (error) {
        console.debug('Online presence refresh failed:', error);
      }
    }

    try {
      // Restores idle presence, or active tracking if a delivery survived the
      // restart. Never prompts for permissions here.
      await LocationService.syncTrackingForDriver({ driverId });
    } catch (error) {
      console.debug('Online background tracking could not resume:', error);
    }
    return true;
  },

  /** Called when AppState returns to active; catches up after a long suspend. */
  async refreshOnlinePresence(): Promise<void> {
    if (!onlineDriverId) return;
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) return;

    const position = await readPosition();
    if (position) {
      try {
        await publishPresence(onlineDriverId, position);
      } catch (error) {
        console.debug('Online presence refresh failed:', error);
      }
    }

    try {
      await LocationService.syncTrackingForDriver({ driverId: onlineDriverId });
    } catch (error) {
      console.debug('Online background tracking could not resume:', error);
    }
  },

  async syncDriverPresence({
    driverId,
    driverStatus,
  }: {
    driverId: string;
    driverStatus: string;
  }): Promise<boolean> {
    if (driverStatus.toLowerCase() === 'online') {
      return LocationService.resumeOnlinePresence(driverId);
    }
    onlineDriverId = null;
    // An offline driver can still have an assigned delivery in progress; keep
    // that tracking alive instead of blindly stopping the service.
    await LocationService.syncTrackingForDriver({ driverId });
    return false;
  },

  async startTracking({
    driverId,
    orderIds,
  }: {
    driverId: string;
    orderIds: string[];
  }): Promise<void> {
    if (!(await LocationService.requestPermission())) {
      LocationService.stopTracking();
      return;
    }

    if (orderIds.length === 0) {
      if (onlineDriverId === driverId) await ensureIdlePresence(driverId);
      else LocationService.stopTracking();
      return;
    }

    trackedDriverId = driverId;
    trackedOrderIds = [...orderIds].sort();
    if (BackgroundLocationService.isRunning) {
      await BackgroundLocationService.updateOrderIds(trackedOrderIds, driverId);
    }
    const position = await readPosition();
    if (position) await publishPosition(position);
  },

  async syncTrackingForDriver({ driverId }: { driverId: string }): Promise<void> {
    const activeOrderIds = await OrderService.fetchTrackableOrderIds({ driverId });
    if (activeOrderIds.length === 0) {
      if (onlineDriverId === driverId) await ensureIdlePresence(driverId);
      else LocationService.stopTracking();
      return;
    }

    const sortedIds = [...activeOrderIds].sort();
    if (sameSession(driverId, sortedIds)) return;
    await LocationService.startTracking({ driverId, orderIds: sortedIds });
  },

  async syncTrackingOrderIds({
    driverId,
    orderIds,
  }: {
    driverId: string;
    orderIds: string[];
  }): Promise<void> {
    if (orderIds.length === 0) {
      if (onlineDriverId === driverId) await ensureIdlePresence(driverId);
      else LocationService.stopTracking();
      return;
    }

    const sortedIds = [...new Set(orderIds)].sort();
    if (sameSession(driverId, sortedIds)) return;

    trackedDriverId = driverId;
    trackedOrderIds = sortedIds;
    if (BackgroundLocationService.isRunning) {
      await BackgroundLocationService.updateOrderIds(sortedIds, driverId);
    } else {
      await LocationService.startTracking({ driverId, orderIds: sortedIds });
    }
  },

  async stopOnlinePresence(): Promise<void> {
    onlineDriverId = null;
    LocationService.stopTracking();
  },

  stopTracking(): void {
    void BackgroundLocationService.stop();
    trackedDriverId = null;
    trackedOrderIds = [];
    lastPublishedAt = null;
    lastPresencePublishedAt = null;
  },
};
