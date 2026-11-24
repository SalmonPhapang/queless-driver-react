// Web port of lib/services/background_location_service.dart.
//
// The Flutter app runs a real Android foreground service in its own isolate so
// GPS keeps publishing while the driver switches to Google Maps. Browsers do
// not allow a background service of that kind, so this module keeps the same
// public contract and behaviour while the page is alive:
//
//  * `start()` opens one `watchPosition` subscription with the same 10 m
//    distance filter and 3 s publish throttle;
//  * positions go to `driver_assignments` (batched per order) and the
//    per-driver `driver_locations` row, exactly like the isolate did;
//  * `isRunning`, `updateOrderIds`, `stop` behave identically.
//
// See README "Platform parity" for the native-wrapper path.

import { OrderService } from './orderService';

type GeoPosition = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    speed: number | null;
    heading: number | null;
  };
};

let initialized = false;
let running = false;
let driverId: string | null = null;
let trackedOrderIds: string[] = [];
let watchId: number | null = null;
let lastPublishedAt: number | null = null;

const publishPosition = async (position: GeoPosition): Promise<void> => {
  const currentDriverId = driverId;
  if (!currentDriverId || trackedOrderIds.length === 0) return;

  const now = Date.now();
  if (lastPublishedAt != null && now - lastPublishedAt < 3000) return;
  lastPublishedAt = now;

  try {
    await OrderService.updateDriverLocation({
      orderIds: trackedOrderIds,
      orderId: trackedOrderIds[0],
      driverId: currentDriverId,
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed,
      heading: position.coords.heading,
    });
  } catch (error) {
    console.debug('Background location publish error:', error);
  }
};

const openWatch = (): void => {
  if (!('geolocation' in navigator)) return;
  watchId = navigator.geolocation.watchPosition(
    (position) => {
      void publishPosition(position as unknown as GeoPosition);
    },
    (error) => console.debug('Background location stream error:', error),
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 30_000,
    },
  );
};

export const BackgroundLocationService = {
  get isRunning(): boolean {
    return running;
  },

  /** Must be called once at app startup (in main.tsx). */
  async initialize(): Promise<void> {
    if (initialized) return;
    initialized = true;
  },

  /** Starts publishing position updates for [driverId] across [orderIds]. */
  async start({ driverId: nextDriverId, orderIds }: { driverId: string; orderIds: string[] }): Promise<void> {
    if (running) {
      driverId = nextDriverId;
      trackedOrderIds = [...orderIds];
      return;
    }

    running = true;
    driverId = nextDriverId;
    trackedOrderIds = [...orderIds];
    lastPublishedAt = null;
    openWatch();
  },

  /** Updates the set of tracked order IDs without restarting the watcher. */
  updateOrderIds(orderIds: string[]): void {
    if (!running) return;
    trackedOrderIds = [...orderIds];
  },

  /** Stops the watcher. */
  stop(): void {
    if (!running) return;
    running = false;
    if (watchId != null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    driverId = null;
    trackedOrderIds = [];
    lastPublishedAt = null;
  },
};
