// Native port of lib/services/background_location_service.dart.
// Uses an expo-task-manager background task so GPS keeps publishing both while
// the driver is online/idle and while navigating to a pickup or drop-off.
// With an active order, positions are batched across the tracked order IDs.

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { Prefs, PrefKeys } from '../lib/storage';
import { OrderService } from './orderService';

const TASK_NAME = 'QUELESS_DRIVER_LOCATION';
let initialized = false;
let running = false;
let lastPublishedAt: number | null = null;

const readState = (): { driverId: string | null; orderIds: string[] } => {
  let orderIds: string[] = [];
  try {
    const raw = Prefs.getString(PrefKeys.locationOrderIds);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) orderIds = parsed.map(String);
  } catch {
    orderIds = [];
  }
  return { driverId: Prefs.getString(PrefKeys.locationDriverId), orderIds };
};

const saveState = (driverId: string | null, orderIds: string[]): void => {
  if (driverId) Prefs.setString(PrefKeys.locationDriverId, driverId);
  else Prefs.remove(PrefKeys.locationDriverId);
  Prefs.setString(PrefKeys.locationOrderIds, JSON.stringify(orderIds));
};

const publish = async (location: Location.LocationObject): Promise<void> => {
  const { driverId, orderIds } = readState();
  if (!driverId) return;

  const now = Date.now();
  if (lastPublishedAt != null && now - lastPublishedAt < 3000) return;
  lastPublishedAt = now;

  const coords = {
    driverId,
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    accuracy: location.coords.accuracy,
    speed: location.coords.speed,
    heading: location.coords.heading,
  };

  try {
    if (orderIds.length === 0) {
      // Online but idle: dispatch only needs the per-driver row. There is no
      // assignment to write to yet.
      await OrderService.publishDriverLocation(coords);
    } else {
      await OrderService.updateDriverLocation({
        ...coords,
        orderIds,
        orderId: orderIds[0],
      });
    }
  } catch (error) {
    console.debug('Background location publish error:', error);
  }
};

const startUpdates = async (orderIds: string[]): Promise<void> => {
  const activeDelivery = orderIds.length > 0;
  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: activeDelivery ? Location.Accuracy.High : Location.Accuracy.Balanced,
    timeInterval: activeDelivery ? 3000 : 10000,
    distanceInterval: activeDelivery ? 10 : 25,
    showsBackgroundLocationIndicator: true,
    ...(Platform.OS === 'android'
      ? {
          foregroundService: {
            notificationTitle: activeDelivery
              ? 'Queless Driver is tracking'
              : 'Queless Driver is online',
            notificationBody: activeDelivery
              ? 'Your live location keeps deliveries accurate.'
              : 'Sharing your location so nearby orders can reach you.',
            notificationColor: '#D13540',
          },
        }
      : {}),
  });
};

TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.debug('Background location task error:', error);
    return;
  }
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  if (!Array.isArray(locations) || locations.length === 0) return;
  await publish(locations[locations.length - 1]);
});

export const BackgroundLocationService = {
  get isRunning(): boolean {
    return running;
  },

  async initialize(): Promise<void> {
    if (initialized) return;
    initialized = true;
    running = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
  },

  async start({
    driverId,
    orderIds,
  }: {
    driverId: string;
    orderIds: string[];
  }): Promise<boolean> {
    if (running) {
      // updateOrderIds compares against the OLD state before overwriting it.
      await BackgroundLocationService.updateOrderIds(orderIds, driverId);
      return true;
    }

    saveState(driverId, orderIds);
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (!foreground.granted) {
      saveState(null, []);
      return false;
    }

    // Background permission is required for updates once the app is no longer
    // foregrounded. If it is denied, foreground tracking still keeps the fix
    // fresh while the driver is using the app; the UI warns that offers may
    // stop when the app is closed or backgrounded.
    try {
      const background = await Location.requestBackgroundPermissionsAsync();
      if (!background.granted) {
        console.debug('Background location permission not granted; tracking in foreground only.');
      }
    } catch (error) {
      console.debug('Background location permission check failed:', error);
    }

    try {
      await startUpdates(orderIds);
    } catch (error) {
      saveState(null, []);
      throw error;
    }
    running = true;
    lastPublishedAt = null;
    return true;
  },

  updateOrderIds(orderIds: string[], driverId?: string): Promise<void> {
    if (!running) return Promise.resolve();
    const previous = readState();
    saveState(driverId ?? previous.driverId, orderIds);

    // Idle-online and active-delivery use different accuracy/intervals. Restart
    // only when crossing that boundary so the persistent notification and GPS
    // cost match what the driver is currently doing.
    const wasActive = previous.orderIds.length > 0;
    const isActive = orderIds.length > 0;
    if (wasActive === isActive) return Promise.resolve();

    return (async () => {
      try {
        await Location.stopLocationUpdatesAsync(TASK_NAME);
      } catch (error) {
        console.debug('Background location restart stop failed:', error);
      }
      try {
        await startUpdates(orderIds);
      } catch (error) {
        running = false;
        saveState(null, []);
        throw error;
      }
      lastPublishedAt = null;
    })();
  },

  async stop(): Promise<void> {
    if (!running) {
      saveState(null, []);
      return;
    }
    try {
      await Location.stopLocationUpdatesAsync(TASK_NAME);
    } catch (error) {
      console.debug('Background location stop failed:', error);
    }
    running = false;
    lastPublishedAt = null;
    saveState(null, []);
  },
};
