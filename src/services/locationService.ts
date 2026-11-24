// Port of lib/services/location_service.dart using the browser Geolocation API.
//
// Behavioural parity notes:
//  * `requestPermission` resolves through a real position request (the only
//    cross-browser way to prompt);
//  * "denied forever" is the browser's `denied` permission state;
//  * the 3 s publish throttle and Haversine helper are unchanged;
//  * the foreground service is still only started when the driver marks the
//    order picked up — see BackgroundLocationService.

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

/** Browsers expose no per-site settings deep link, so screens show this inline. */
export const LOCATION_SETTINGS_HELP =
  'To change location access, open your browser site settings for this page and allow Location.';

let trackedDriverId: string | null = null;
let trackedOrderIds: string[] = [];
let lastPublishedAt: number | null = null;

const geolocation = (): Geolocation | null =>
  typeof navigator !== 'undefined' && 'geolocation' in navigator ? navigator.geolocation : null;

const permissionState = async (): Promise<PermissionState | null> => {
  try {
    if (!navigator.permissions) return null;
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state;
  } catch {
    return null;
  }
};

const readPosition = (options: PositionOptions): Promise<DriverGeoPosition | null> =>
  new Promise((resolve) => {
    const geo = geolocation();
    if (!geo) {
      resolve(null);
      return;
    }
    geo.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
          speed: position.coords.speed,
          heading: position.coords.heading,
        }),
      (error) => {
        console.debug('Geolocation error:', error);
        resolve(null);
      },
      options,
    );
  });

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
    const state = await permissionState();
    return state === 'granted';
  },

  async isPermissionDeniedForever(): Promise<boolean> {
    return (await permissionState()) === 'denied';
  },

  /**
   * Browsers expose no per-site settings deep link. The denied-permission UI
   * shows {@link LOCATION_SETTINGS_HELP} inline instead of a native dialog.
   */
  async openLocationSettings(): Promise<string> {
    return LOCATION_SETTINGS_HELP;
  },

  async requestPermission(): Promise<boolean> {
    if (!geolocation()) return false;
    const existing = await permissionState();
    if (existing === 'granted') return true;
    if (existing === 'denied') return false;
    // The prompt only appears in response to a position request.
    const position = await readPosition({ enableHighAccuracy: true, timeout: 15_000 });
    return position != null;
  },

  get isTracking(): boolean {
    return BackgroundLocationService.isRunning;
  },

  async getCurrentPosition(): Promise<DriverGeoPosition | null> {
    if (!(await LocationService.requestPermission())) return null;
    return readPosition({ enableHighAccuracy: true });
  },

  /** Haversine distance in km. */
  calculateDistance,

  async startTracking({ driverId, orderIds }: { driverId: string; orderIds: string[] }): Promise<void> {
    const hasPermission = await LocationService.requestPermission();
    if (!hasPermission || orderIds.length === 0) {
      LocationService.stopTracking();
      return;
    }

    trackedDriverId = driverId;
    trackedOrderIds = [...orderIds].sort();

    // Publish one initial position immediately so tracking appears right away.
    const currentPosition = await readPosition({ enableHighAccuracy: true });
    if (currentPosition) await publishPosition(currentPosition);

    // The foreground watcher is NOT started here — only when the driver marks
    // the order as picked up (out_for_delivery).
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

  async syncTrackingOrderIds({ driverId, orderIds }: { driverId: string; orderIds: string[] }): Promise<void> {
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
    BackgroundLocationService.stop();
    trackedDriverId = null;
    trackedOrderIds = [];
    lastPublishedAt = null;
  },
};
