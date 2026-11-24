// Web port of lib/services/fcm_service.dart.
//
// The Flutter app uses Firebase Cloud Messaging + flutter_local_notifications.
// The browser has no FCM device token without a Firebase web config, so this
// service keeps every *observable* behaviour of the original and replaces the
// native transport with the closest web equivalents:
//
//  * permission handling via the Notification API;
//  * a stable per-install token written to `user_fcm_tokens` (so the server
//    still has one row per device, and a future FCM-web/VAPID transport can
//    reuse the same registration flow);
//  * topic subscriptions persisted locally (FCM topics are native-only);
//  * a realtime `notifications` subscription that raises a browser
//    notification + sound for each new row — the in-browser equivalent of a
//    foreground push;
//  * the same 30-second ring/vibrate loop for new orders.
//
// See README "Platform parity" for what needs a native wrapper.

import { SupabaseConfig } from '../config/supabaseClient';
import { AppConfig } from '../config/appConfig';
import { Prefs } from '../lib/storage';
import { newDeviceUuid } from '../core/deviceBinding';

export const PushTopics = {
  marketing: 'marketing',
  driverOrdersReady: 'DRIVER_ORDERS_READY',
  driver: (driverId: string) => `driver-${driverId.trim()}`,
};

export type PushAuthorization = 'authorized' | 'provisional' | 'denied' | 'notDetermined';

export type PushRegistrationOutcome =
  | 'registered'
  | 'alreadyRegistered'
  | 'unsupported'
  | 'noSession'
  | 'permissionDenied'
  | 'noToken'
  | 'saveFailed'
  | 'failed';

export interface PushRegistrationResult {
  outcome: PushRegistrationOutcome;
  userId?: string;
  token?: string;
  authorization: PushAuthorization;
  topics: Set<string>;
  error?: unknown;
}

const TOKEN_KEY = 'queless_push_token';
const TOPICS_KEY = 'queless_push_topics';

const notificationSupported = (): boolean =>
  typeof window !== 'undefined' && 'Notification' in window;

const readTopics = (): Set<string> => {
  const raw = Prefs.getString(TOPICS_KEY);
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
};

const writeTopics = (topics: Set<string>): void => {
  Prefs.setString(TOPICS_KEY, JSON.stringify([...topics]));
};

let registeredUserId: string | null = null;
let initialized = false;
let notificationChannel: { unsubscribe: () => void } | null = null;
let alertTimer: number | null = null;
let vibrationLoop: number | null = null;
let isAlerting = false;
let audioContext: AudioContext | null = null;

const authorization = (): PushAuthorization => {
  if (!notificationSupported()) return 'denied';
  switch (Notification.permission) {
    case 'granted':
      return 'authorized';
    case 'denied':
      return 'denied';
    default:
      return 'notDetermined';
  }
};

const allowsPush = (value: PushAuthorization): boolean =>
  value === 'authorized' || value === 'provisional';

/** Stable per-install token, standing in for an FCM registration token. */
const deviceToken = (): string => {
  const existing = Prefs.getString(TOKEN_KEY);
  if (existing) return existing;
  const token = `web:${newDeviceUuid()}`;
  Prefs.setString(TOKEN_KEY, token);
  return token;
};

const playAlertTone = (): void => {
  try {
    audioContext ??= new AudioContext();
    const ctx = audioContext;
    if (ctx.state === 'suspended') void ctx.resume();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = 880;
    gain.gain.value = 0.08;
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.35);
  } catch {
    // Autoplay policies can block audio until a user gesture; ignore.
  }
};

const vibratePattern = (): void => {
  try {
    navigator.vibrate?.([500, 200, 500]);
  } catch {
    // Unsupported.
  }
};

const showNotification = (title: string, body: string, orderId?: string | null): void => {
  if (!notificationSupported() || Notification.permission !== 'granted') return;
  try {
    const notification = new Notification(title, {
      body,
      icon: '/favicon.svg',
      tag: orderId ? `order-${orderId}` : undefined,
    });
    notification.onclick = () => {
      window.focus();
      if (orderId) window.location.assign(`/home/orders/${orderId}`);
      notification.close();
    };
  } catch {
    // Some browsers only allow notifications from a service worker; ignore.
  }
};

const isNewOrderNotification = (title: string, body: string, type?: string): boolean => {
  const haystack = `${type ?? ''} ${title} ${body}`.toLowerCase();
  return haystack.includes('order');
};

/**
 * Watches the durable `notifications` table for the signed-in driver and raises
 * a browser notification for each new row. This is the in-browser stand-in for
 * FCM foreground messages, and keeps the inbox and the alert in step.
 */
const startNotificationBridge = (userId: string): void => {
  notificationChannel?.unsubscribe();
  let lastSeen = new Date().toISOString();

  const channel = SupabaseConfig.client
    .channel(`driver-notifications-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const row = (payload.new ?? {}) as Record<string, unknown>;
        const createdAt = String(row.created_at ?? '');
        if (createdAt && createdAt < lastSeen) return;
        lastSeen = createdAt || lastSeen;

        const title = String(row.title ?? 'Queless Driver');
        const body = String(row.body ?? '');
        const type = row.type == null ? undefined : String(row.type);
        showNotification(title, body, row.order_id == null ? null : String(row.order_id));
        if (isNewOrderNotification(title, body, type)) {
          PushService.startNewOrderAlert();
        }
      },
    )
    .subscribe();

  notificationChannel = {
    unsubscribe: () => {
      void SupabaseConfig.client.removeChannel(channel);
    },
  };
};

export const PushService = {
  driverTopics(userId: string): Set<string> {
    return new Set([PushTopics.driverOrdersReady, PushTopics.driver(userId)]);
  },

  async initialize(): Promise<void> {
    if (initialized || !AppConfig.featureFirebase) return;
    initialized = true;
    if (!notificationSupported()) return;
    try {
      if ('serviceWorker' in navigator) {
        // Optional: enables notification clicks when a worker is present.
        await navigator.serviceWorker.register('/sw.js').catch(() => undefined);
      }
    } catch (error) {
      console.debug('Failed to initialize web push:', error);
    }
  },

  async notificationSettings(): Promise<PushAuthorization> {
    await PushService.initialize();
    return authorization();
  },

  async isAuthorized(): Promise<boolean> {
    return allowsPush(await PushService.notificationSettings());
  },

  async requestPermission(): Promise<boolean> {
    if (!AppConfig.featureFirebase) return true; // Assume granted if disabled
    await PushService.initialize();
    if (!notificationSupported()) return false;
    if (allowsPush(authorization())) return true;
    try {
      return (await Notification.requestPermission()) === 'granted';
    } catch (error) {
      console.debug('requesting notification permission failed:', error);
      return false;
    }
  },

  /**
   * Registers (or re-registers) this device for push for [userId].
   *
   * Called on every cold start — from `AuthService.restoreSession()` and from
   * `RootRouter` — so a rotated token or dropped topic is restored without the
   * driver signing in again. Repeat calls in the same session are cheap.
   */
  async registerDriver(userId: string): Promise<PushRegistrationResult> {
    if (!AppConfig.featureFirebase) {
      return { outcome: 'unsupported', userId, authorization: 'notDetermined', topics: new Set() };
    }
    if (!userId.trim()) {
      return { outcome: 'noSession', authorization: 'notDetermined', topics: new Set() };
    }

    await PushService.initialize();

    if (registeredUserId === userId) {
      return {
        outcome: 'alreadyRegistered',
        userId,
        authorization: authorization(),
        topics: PushService.driverTopics(userId),
      };
    }

    try {
      const auth = authorization();
      // Prompt only while the browser has no answer yet, matching the native
      // registrar's `requestPermissionIfNeeded`.
      const resolved = allowsPush(auth)
        ? auth
        : auth === 'notDetermined' && (await PushService.requestPermission())
          ? 'authorized'
          : auth;

      const token = deviceToken();
      if (!token) {
        return { outcome: 'noToken', userId, authorization: resolved, topics: new Set() };
      }

      // An unregistered device is never written while notifications are denied.
      if (!allowsPush(resolved)) {
        return { outcome: 'permissionDenied', userId, token, authorization: resolved, topics: new Set() };
      }

      const { error } = await SupabaseConfig.client.from('user_fcm_tokens').upsert(
        {
          user_id: userId,
          token,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token' },
      );
      if (error) {
        return { outcome: 'saveFailed', userId, token, authorization: resolved, topics: new Set(), error };
      }

      registeredUserId = userId;
      const topics = await PushService.syncTopics(PushService.driverTopics(userId));
      startNotificationBridge(userId);

      return { outcome: 'registered', userId, token, authorization: resolved, topics };
    } catch (error) {
      console.debug('push registration failed:', error);
      return { outcome: 'failed', userId, authorization: authorization(), topics: new Set(), error };
    }
  },

  async subscribeToTopic(topic: string): Promise<boolean> {
    const trimmed = topic.trim();
    if (!trimmed) return false;
    const topics = readTopics();
    topics.add(trimmed);
    writeTopics(topics);
    return true;
  },

  async unsubscribeFromTopic(topic: string): Promise<void> {
    const topics = readTopics();
    topics.delete(topic.trim());
    writeTopics(topics);
  },

  async subscribeToDriverTopic(driverId: string): Promise<void> {
    await PushService.subscribeToTopic(PushTopics.driver(driverId));
  },

  async unsubscribeFromDriverTopic(driverId: string): Promise<void> {
    await PushService.unsubscribeFromTopic(PushTopics.driver(driverId));
  },

  async subscribeToOrdersTopic(): Promise<void> {
    await PushService.subscribeToTopic(PushTopics.driverOrdersReady);
  },

  async unsubscribeFromOrdersTopic(): Promise<void> {
    await PushService.unsubscribeFromTopic(PushTopics.driverOrdersReady);
  },

  async syncTopics(topics: Iterable<string>): Promise<Set<string>> {
    const wanted = new Set([...topics].map((topic) => topic.trim()).filter(Boolean));
    for (const topic of wanted) await PushService.subscribeToTopic(topic);
    return wanted;
  },

  /** Drops every subscription this device is known to hold (sign-out). */
  async unsubscribeAll(): Promise<void> {
    writeTopics(new Set());
    notificationChannel?.unsubscribe();
    notificationChannel = null;
    registeredUserId = null;
  },

  startNewOrderAlert(): void {
    if (isAlerting) return;
    isAlerting = true;
    console.debug('Starting new order alert');

    if (alertTimer != null) window.clearTimeout(alertTimer);
    if (vibrationLoop != null) window.clearInterval(vibrationLoop);

    playAlertTone();
    vibratePattern();
    vibrationLoop = window.setInterval(() => {
      playAlertTone();
      vibratePattern();
    }, 2000);

    // Stop alert after 30 seconds.
    alertTimer = window.setTimeout(() => PushService.stopNewOrderAlert(), 30_000);
  },

  stopNewOrderAlert(): void {
    if (!isAlerting) return;
    console.debug('Stopping new order alert');
    isAlerting = false;
    if (alertTimer != null) window.clearTimeout(alertTimer);
    if (vibrationLoop != null) window.clearInterval(vibrationLoop);
    alertTimer = null;
    vibrationLoop = null;
  },

  showNotification,
};
