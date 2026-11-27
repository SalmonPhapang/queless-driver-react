// Native port of lib/services/fcm_service.dart.
// Expo Push is the primary transport; native FCM tokens are mirrored for
// server-side senders. Tokens are isolated by app_id = 'driver'.

import * as Audio from 'expo-audio';
import * as Haptics from 'expo-haptics';
import type * as NotificationsTypes from 'expo-notifications';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { AppConfig } from '../config/appConfig';
import { SupabaseConfig } from '../config/supabaseClient';
import { Prefs, PrefKeys } from '../lib/storage';
import { getNotificationsModule } from '../utils/nativeNotifications';

const NEW_ORDERS_CHANNEL = 'driver_new_orders';
const ALERT_AUTO_STOP_MS = 30_000;
const TOKEN_ATTEMPTS = 3;
const APP_ID = 'driver';

if (AppConfig.isExpoGo) {
  console.warn(
    '[push] Expo Go cannot use remote push tokens or topics (SDK 53+). ' +
      'Local notifications and the Supabase realtime order bridge still work. ' +
      'Use a development build to test push alerts.',
  );
}

const bootstrapNotifications = getNotificationsModule();
if (bootstrapNotifications) {
  try {
    bootstrapNotifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (error) {
    console.warn('[push] Could not set notification handler:', error);
  }
}

export const PushTopics = {
  marketing: 'marketing',
  driverOrdersReady: 'DRIVER_ORDERS_READY',
  driver: (driverId: string) => `driver-${driverId.trim()}`,
};

export type PushAuthorization = 'authorized' | 'provisional' | 'denied' | 'notDetermined';
export type PushProvider = 'expo' | 'fcm';
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

let initialized = false;
let registeredUserId: string | null = null;
let notificationChannel: { unsubscribe: () => void } | null = null;
let alertTimer: ReturnType<typeof setTimeout> | null = null;
let vibrationLoop: ReturnType<typeof setInterval> | null = null;
let isAlerting = false;
let sound: Audio.AudioPlayer | null = null;
let lastAlertKey: string | null = null;

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const readTopics = (): Set<string> => {
  const raw = Prefs.getString(PrefKeys.pushTopics);
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
};

const writeTopics = (topics: Set<string>): void => {
  Prefs.setString(PrefKeys.pushTopics, JSON.stringify([...topics]));
};

type PermissionResponseWithIos = NotificationsTypes.PermissionResponse & {
  ios?: { status?: NotificationsTypes.IosAuthorizationStatus };
};

const toAuthorization = (
  permission: NotificationsTypes.PermissionResponse,
): PushAuthorization => {
  if (permission.granted) return 'authorized';
  const ios = (permission as PermissionResponseWithIos).ios;
  const notifications = getNotificationsModule();
  if (ios?.status === notifications?.IosAuthorizationStatus.PROVISIONAL) {
    return 'provisional';
  }
  if (permission.canAskAgain) return 'notDetermined';
  return 'denied';
};

const allowsPush = (value: PushAuthorization): boolean =>
  value === 'authorized' || value === 'provisional';

const payloadData = (data: unknown): Record<string, unknown> => {
  if (!data || typeof data !== 'object') return {};
  const payload = { ...(data as Record<string, unknown>) };
  if (typeof payload.data === 'string') {
    try {
      const parsed: unknown = JSON.parse(payload.data);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        payload.data = parsed;
      }
    } catch {
      // Keep raw value.
    }
  }
  return payload;
};

const orderIdFromPayload = (payload: Record<string, unknown>): string | null => {
  const nested = payloadData(payload.data);
  const raw =
    payload.order_id ??
    payload.orderId ??
    payload.id ??
    nested.order_id ??
    nested.orderId ??
    nested.id;
  return raw == null || raw === '' ? null : String(raw).trim();
};

const isNewOrderPayload = (payload: Record<string, unknown>): boolean => {
  const type = String(payload.type ?? payload.event ?? '').toLowerCase();
  const title = String(payload.title ?? '');
  const body = String(payload.body ?? '');
  return (
    type.includes('new_order') ||
    type.includes('order') ||
    `${title} ${body}`.toLowerCase().includes('order')
  );
};

const alertKey = (payload: Record<string, unknown>): string =>
  [
    String(payload.notificationId ?? ''),
    String(payload.type ?? payload.event ?? ''),
    String(orderIdFromPayload(payload) ?? ''),
  ].join('|');

const startAlert = (): void => {
  if (isAlerting || !AppConfig.featureFirebase) return;
  isAlerting = true;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  try {
    sound ??= Audio.createAudioPlayer(require('../../assets/sounds/order_alert.wav'));
    sound.loop = true;
    sound.seekTo(0);
    sound.play();
  } catch {
    // Alert feedback is best effort.
  }
  vibrationLoop = setInterval(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  }, 2000);
  alertTimer = setTimeout(() => PushService.stopNewOrderAlert(), ALERT_AUTO_STOP_MS);
};

const handleIncomingPayload = (payload: Record<string, unknown>): void => {
  if (!isNewOrderPayload(payload)) return;
  const key = alertKey(payload);
  if (lastAlertKey === key) return;
  lastAlertKey = key;
  startAlert();
};

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
      (changes) => {
        const row = (changes.new ?? {}) as Record<string, unknown>;
        const createdAt = String(row.created_at ?? '');
        if (createdAt && createdAt < lastSeen) return;
        lastSeen = createdAt || lastSeen;
        const payload = {
          ...row,
          title: String(row.title ?? 'Queless Driver'),
          body: String(row.body ?? ''),
          notificationId: String(row.id ?? ''),
        };
        handleIncomingPayload(payload);
      },
    )
    .subscribe();

  notificationChannel = {
    unsubscribe: () => {
      void SupabaseConfig.client.removeChannel(channel);
    },
  };
};

const fetchPushToken = async (): Promise<{ token: string; provider: PushProvider } | null> => {
  // Expo Go and stale native clients cannot load the notification module, so
  // skip token APIs entirely instead of triggering a fatal native exception.
  const notifications = getNotificationsModule();
  if (!AppConfig.remotePushAvailable || !notifications) return null;

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const expoToken = await notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = String(expoToken?.data ?? '').trim();
    if (token) return { token, provider: 'expo' };
  } catch (error) {
    console.debug('[push] Expo token unavailable:', error);
  }

  if (Platform.OS !== 'android') return null;
  try {
    const deviceToken = await notifications.getDevicePushTokenAsync();
    const token = String(deviceToken?.data ?? '').trim();
    return token ? { token, provider: 'fcm' } : null;
  } catch (error) {
    console.debug('[push] FCM token unavailable:', error);
    return null;
  }
};

const registerToken = async (
  userId: string,
  token: string,
  provider: PushProvider,
): Promise<unknown | null> => {
  const previousToken = Prefs.getString(PrefKeys.pushToken);
  if (previousToken && previousToken !== token) {
    const { error } = await SupabaseConfig.client
      .from('user_fcm_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('token', previousToken)
      .eq('app_id', APP_ID);
    if (error) console.debug('[push] Could not retire old token:', error.message);
  }

  const { error } = await SupabaseConfig.client.from('user_fcm_tokens').upsert(
    {
      user_id: userId,
      token,
      provider,
      app_id: APP_ID,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,token' },
  );
  if (error) return error;

  // Legacy column only understands native FCM tokens.
  if (provider === 'fcm') {
    const { error: mirrorError } = await SupabaseConfig.client
      .from('users')
      .update({ fcm_token: token })
      .eq('id', userId);
    if (mirrorError) console.debug('[push] Legacy token mirror failed:', mirrorError.message);
  }

  Prefs.setString(PrefKeys.pushToken, token);
  Prefs.setString(PrefKeys.pushProvider, provider);
  return null;
};

export const PushService = {
  driverTopics(userId: string): Set<string> {
    return new Set([PushTopics.driverOrdersReady, PushTopics.driver(userId)]);
  },

  async initialize(): Promise<void> {
    if (initialized || !AppConfig.featureFirebase) return;
    initialized = true;

    const notifications = getNotificationsModule();
    if (!notifications) return;

    try {
      await Promise.allSettled([
        notifications.setNotificationChannelAsync(NEW_ORDERS_CHANNEL, {
          name: 'New Orders',
          description: 'Notifications when a new order is offered or assigned',
          importance: notifications.AndroidImportance.MAX,
          // Do not pass a string here on Android: expo-notifications treats it as a
          // custom raw resource filename and logs an error when it is not bundled.
          // Omitting `sound` uses the system default notification sound.
          vibrationPattern: [0, 400, 200, 400, 200, 400],
          lightColor: '#D13540',
        }),
      ]);

      notifications.addNotificationReceivedListener((notification) => {
        handleIncomingPayload(payloadData(notification.request.content.data));
      });

      notifications.addNotificationResponseReceivedListener((response) => {
        void PushService.stopNewOrderAlert();
        const payload = payloadData(response.notification.request.content.data);
        const orderId = orderIdFromPayload(payload);
        if (orderId) router.push(`/home/orders/${orderId}`);
        else router.push('/home/active');
      });

      const last = await notifications.getLastNotificationResponseAsync().catch(() => null);
      if (last) {
        const payload = payloadData(last.notification.request.content.data);
        const orderId = orderIdFromPayload(payload);
        if (orderId) router.push(`/home/orders/${orderId}`);
      }

      // Token listeners throw in Expo Go. Skip them there; real devices and
      // development builds still register token refreshes.
      if (AppConfig.remotePushAvailable) {
        notifications.addPushTokenListener(() => {
          const userId = registeredUserId ?? SupabaseConfig.currentUserId;
          if (userId) void PushService.registerDriver(userId);
        });
      }
    } catch (error) {
      console.warn('[push] Notification initialization failed:', error);
    }
  },

  async notificationSettings(): Promise<PushAuthorization> {
    const notifications = getNotificationsModule();
    if (!AppConfig.remotePushAvailable || !notifications) return 'authorized';
    await PushService.initialize();
    return toAuthorization(await notifications.getPermissionsAsync());
  },

  async isAuthorized(): Promise<boolean> {
    return allowsPush(await PushService.notificationSettings());
  },

  async requestPermission(): Promise<boolean> {
    const notifications = getNotificationsModule();
    if (!AppConfig.remotePushAvailable || !notifications) return true;
    await PushService.initialize();
    const current = await notifications.getPermissionsAsync();
    if (allowsPush(toAuthorization(current))) return true;
    const requested = await notifications.requestPermissionsAsync();
    return allowsPush(toAuthorization(requested));
  },

  async registerDriver(userId: string): Promise<PushRegistrationResult> {
    if (!AppConfig.remotePushAvailable) {
      return { outcome: 'unsupported', userId, authorization: 'authorized', topics: new Set() };
    }
    if (!userId.trim()) {
      return { outcome: 'noSession', authorization: 'notDetermined', topics: new Set() };
    }

    await PushService.initialize();
    if (registeredUserId === userId) {
      return {
        outcome: 'alreadyRegistered',
        userId,
        authorization: await PushService.notificationSettings(),
        topics: PushService.driverTopics(userId),
      };
    }

    try {
      const granted = await PushService.requestPermission();
      if (!granted) {
        return {
          outcome: 'permissionDenied',
          userId,
          authorization: 'denied',
          topics: new Set(),
        };
      }

      let registration = await fetchPushToken();
      for (let attempt = 1; !registration && attempt < TOKEN_ATTEMPTS; attempt++) {
        await wait(attempt * 1000);
        registration = await fetchPushToken();
      }
      if (!registration) {
        return { outcome: 'noToken', userId, authorization: 'authorized', topics: new Set() };
      }

      const saveError = await registerToken(userId, registration.token, registration.provider);
      if (saveError) {
        return {
          outcome: 'saveFailed',
          userId,
          token: registration.token,
          authorization: 'authorized',
          topics: new Set(),
          error: saveError,
        };
      }
      registeredUserId = userId;
      const topics = await PushService.syncTopics(PushService.driverTopics(userId));
      startNotificationBridge(userId);

      return {
        outcome: 'registered',
        userId,
        token: registration.token,
        authorization: 'authorized',
        topics,
      };
    } catch (error) {
      console.debug('[push] registration failed:', error);
      return {
        outcome: 'failed',
        userId,
        authorization: await PushService.notificationSettings(),
        topics: new Set(),
        error,
      };
    }
  },

  async subscribeToTopic(topic: string): Promise<boolean> {
    const trimmed = topic.trim();
    if (!trimmed) return false;
    const topics = readTopics();
    if (!topics.has(trimmed)) {
      const notifications = getNotificationsModule();
      if (notifications && AppConfig.remotePushAvailable) {
        try {
          await notifications.subscribeToTopicAsync(trimmed);
        } catch {
          // Best effort; retain locally so a later native build can retry.
        }
      }
      // Expo Go cannot subscribe to topics; keep the preference so a
      // development build can sync it without asking the driver again.
      topics.add(trimmed);
      writeTopics(topics);
    }
    return true;
  },

  async unsubscribeFromTopic(topic: string): Promise<void> {
    const topics = readTopics();
    const trimmed = topic.trim();
    if (topics.delete(trimmed)) {
      const notifications = getNotificationsModule();
      if (notifications && AppConfig.remotePushAvailable) {
        try {
          await notifications.unsubscribeFromTopicAsync(trimmed);
        } catch {
          // Best effort.
        }
      }
      writeTopics(topics);
    }
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

  async unsubscribeAll(): Promise<void> {
    const notifications = getNotificationsModule();
    const stored = readTopics();
    for (const topic of stored) {
      if (!notifications || !AppConfig.remotePushAvailable) continue;
      try {
        await notifications.unsubscribeFromTopicAsync(topic);
      } catch {
        // Best effort.
      }
    }
    writeTopics(new Set());
    notificationChannel?.unsubscribe();
    notificationChannel = null;
    registeredUserId = null;
  },

  async clearRegistration(userId: string): Promise<void> {
    const token = Prefs.getString(PrefKeys.pushToken);
    if (userId.trim() && token) {
      const { error } = await SupabaseConfig.client
        .from('user_fcm_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('token', token)
        .eq('app_id', APP_ID);
      if (error) console.debug('[push] Could not delete token:', error.message);
    }
    Prefs.remove(PrefKeys.pushToken);
    Prefs.remove(PrefKeys.pushProvider);
    registeredUserId = null;
  },

  startNewOrderAlert(): void {
    handleIncomingPayload({ type: 'new_order', notificationId: 'manual' });
  },

  stopNewOrderAlert(): void {
    if (alertTimer) clearTimeout(alertTimer);
    if (vibrationLoop) clearInterval(vibrationLoop);
    alertTimer = null;
    vibrationLoop = null;
    isAlerting = false;
    try {
      if (sound) {
        if (sound.playing) sound.pause();
        sound.loop = false;
        sound.seekTo(0);
      }
    } catch {
      // Best effort.
    }
  },

  async showNotification(
    title: string,
    body: string,
    orderId?: string | null,
  ): Promise<void> {
    const notifications = getNotificationsModule();
    if (!notifications) return;
    try {
      await notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          data: orderId ? { order_id: orderId, type: 'order' } : { type: 'order' },
        },
        trigger: Platform.OS === 'android' ? { channelId: NEW_ORDERS_CHANNEL } : null,
      });
    } catch (error) {
      console.debug('[push] Local notification unavailable:', error);
    }
  },
};
