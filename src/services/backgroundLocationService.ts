// Native port of lib/services/background_location_service.dart.
// Uses an expo-task-manager background task so GPS keeps publishing while the
// driver navigates to Google Maps. Positions are batched across order IDs.

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
  if (!driverId || orderIds.length === 0) return;

  const now = Date.now();
  if (lastPublishedAt != null && now - lastPublishedAt < 3000) return;
  lastPublishedAt = now;

  try {
    await OrderService.updateDriverLocation({
      orderIds,
      orderId: orderIds[0],
      driverId,
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      heading: location.coords.heading,
    });
  } catch (error) {
    console.debug('Background location publish error:', error);
  }
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
  }): Promise<void> {
    saveState(driverId, orderIds);
    if (running) return;

    const foreground = await Location.requestForegroundPermissionsAsync();
    if (!foreground.granted || orderIds.length === 0) {
      saveState(null, []);
      return;
    }

    const background = await Location.requestBackgroundPermissionsAsync();
    if (!background.granted) {
      // iOS users can still track while the app is foregrounded.
      if (Platform.OS === 'android') {
        saveState(null, []);
        return;
      }
    }

    await Location.startLocationUpdatesAsync(TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: 3000,
      distanceInterval: 10,
      showsBackgroundLocationIndicator: true,
      ...(Platform.OS === 'android'
        ? {
            foregroundService: {
              notificationTitle: 'Queless Driver is tracking',
              notificationBody: 'Your live location keeps deliveries accurate.',
              notificationColor: '#D13540',
            },
          }
        : {}),
    });
    running = true;
    lastPublishedAt = null;
  },

  updateOrderIds(orderIds: string[]): void {
    if (!running) return;
    const { driverId } = readState();
    saveState(driverId, orderIds);
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
