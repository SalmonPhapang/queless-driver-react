// Native port of lib/services/location_service.dart using expo-location.
// The foreground service is still only started when the driver marks the
// order picked up — see BackgroundLocationService.

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

export const LOCATION_SETTINGS_HELP =
  Platform.OS === 'android'
    ? 'Open your device Settings, then allow Queless Driver to use Location.'
    : 'Open your device Settings, then allow Queless Driver to use Location Services.';

let trackedDriverId: string | null = null;
let trackedOrderIds: string[] = [];
let lastPublishedAt: number | null = null;

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

  async startTracking({
    driverId,
    orderIds,
  }: {
    driverId: string;
    orderIds: string[];
  }): Promise<void> {
    if (!(await LocationService.requestPermission()) || orderIds.length === 0) {
      LocationService.stopTracking();
      return;
    }

    trackedDriverId = driverId;
    trackedOrderIds = [...orderIds].sort();
    const position = await readPosition();
    if (position) await publishPosition(position);
  },

  async syncTrackingForDriver({ driverId }: { driverId: string }): Promise<void> {
    const activeOrderIds = await OrderService.fetchTrackableOrderIds({ driverId });
    if (activeOrderIds.length === 0) {
      LocationService.stopTracking();
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
      LocationService.stopTracking();
      return;
    }
    const sortedIds = [...new Set(orderIds)].sort();
    if (sameSession(driverId, sortedIds)) return;

    trackedDriverId = driverId;
    trackedOrderIds = sortedIds;
    if (BackgroundLocationService.isRunning) {
      BackgroundLocationService.updateOrderIds(sortedIds);
    } else {
      await LocationService.startTracking({ driverId, orderIds: sortedIds });
    }
  },

  stopTracking(): void {
    void BackgroundLocationService.stop();
    trackedDriverId = null;
    trackedOrderIds = [];
    lastPublishedAt = null;
  },
};
