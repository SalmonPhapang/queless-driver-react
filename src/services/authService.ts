// Port of lib/services/auth_service.dart.
//
// State lives in the zustand auth store (the React equivalent of the
// ChangeNotifier) so the router can re-render on sign-in/out.

import type { Session, User } from '@supabase/supabase-js';
import { SupabaseConfig } from '../config/supabaseClient';
import { AppConfig } from '../config/appConfig';
import { Prefs, PrefKeys } from '../lib/storage';
import { DriverStatusX } from '../models/statuses';
import { useAuthStore } from '../stores/authStore';
import { DeviceBindingService } from './deviceBindingService';
import { PushService } from './pushService';
import { DriverService } from './driverService';
import { LocationService } from './locationService';
import { shouldSignOut } from '../core/deviceBinding';

const setUser = (user: User | null): void => {
  useAuthStore.getState().setUser(user);
};

/** The subset of the Supabase auth response the driver app consumes. */
type DriverAuthResponse = { user: User | null; session: Session | null };

export const AuthService = {
  get currentUser(): User | null {
    return SupabaseConfig.currentUser;
  },

  get isAuthenticated(): boolean {
    return AuthService.currentUser != null;
  },

  get deviceSignOutReason(): string | null {
    return useAuthStore.getState().deviceSignOutReason;
  },

  async restoreSession(): Promise<void> {
    try {
      const { data } = await SupabaseConfig.auth.getSession();
      const user = data.session?.user ?? null;
      setUser(user);

      if (user) {
        if (AppConfig.featureFirebase) {
          void PushService.registerDriver(user.id);
        }
        // Cold start is where a lost or replaced device is caught.
        await AuthService.checkDeviceBinding();
      }
    } catch (error) {
      console.debug('restoreSession failed:', error);
      setUser(null);
    } finally {
      useAuthStore.getState().setInitialized(true);
    }
  },

  /**
   * Signs the driver out when this device is not the account's active one any
   * more. Failures are deliberately swallowed: only a server answer that says
   * this device is not current signs a driver off.
   */
  async checkDeviceBinding(): Promise<void> {
    const result = await DeviceBindingService.check();
    if (!shouldSignOut(result)) return;

    console.debug(`Device binding: signing out (${result.status})`);
    try {
      await AuthService.signOut();
    } catch (error) {
      // The device reason stays authoritative even if Supabase also fails.
      console.debug('signOut during device enforcement failed:', error);
    }
    useAuthStore
      .getState()
      .setDeviceSignOutReason(
        result.message ??
          'This phone is no longer authorised for your driver account. Please sign in again.',
      );
  },

  async syncFcmToken(): Promise<void> {
    if (!AppConfig.featureFirebase) return;
    const user = AuthService.currentUser;
    if (!user) return;
    try {
      await DriverService.ensureDriverProfile({ authUserId: user.id });
      await DriverService.updateFCMToken(user.id);
    } catch (error) {
      console.debug('Error syncing FCM token:', error);
    }
  },

  async signInWithEmail(email: string, password: string): Promise<DriverAuthResponse> {
    const { data, error } = await SupabaseConfig.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // A fresh session clears any "this phone was signed out" notice.
    useAuthStore.getState().setDeviceSignOutReason(null);

    const user = data.user;
    if (user) {
      // Check driver status before allowing login to proceed.
      const profile = await DriverService.getDriverProfile(user.id);
      if (profile && profile.driverStatus === 'inactive') {
        try {
          await AuthService.signOut();
        } catch (error) {
          console.debug('signOut for inactive driver failed:', error);
        }
        // Flutter throws a plain String here; keep the interpolated value
        // identical (no JavaScript `Error:` prefix).
        throw `Your account has been ${DriverStatusX.displayName(profile.driverStatus).toLowerCase()}. Please contact support for assistance.`;
      }

      if (AppConfig.featureFirebase) {
        await PushService.registerDriver(user.id);
      }
    }

    setUser(user);
    return data;
  },

  async signUpWithEmail(email: string, password: string): Promise<DriverAuthResponse> {
    try {
      const { data, error } = await SupabaseConfig.auth.signUp({ email, password });
      if (error) throw error;

      const user = data.user;
      if (user) {
        // Clear any old preferences for this new user.
        Prefs.remove(PrefKeys.registrationSuccessSeen);
        Prefs.remove(PrefKeys.approvalWelcomeSeen);
        Prefs.remove(PrefKeys.permissionsRequested);

        try {
          await DriverService.ensureDriverProfile({ authUserId: user.id });
        } catch (error) {
          console.debug('Error creating driver profile:', error);
          // Still update state because the user was created.
        }
      }

      setUser(user);
      return data;
    } catch (error) {
      console.debug('Signup error:', error);
      throw error;
    }
  },

  async signOut(): Promise<void> {
    const id = SupabaseConfig.currentUserId;
    // A manual sign-out is not a device problem: drop any stale notice.
    useAuthStore.getState().setDeviceSignOutReason(null);
    LocationService.stopTracking();
    DeviceBindingService.reset();

    // Supabase failure is surfaced, but only *after* local cleanup and the
    // best-effort topic unsubscribe have run.
    let supabaseError: unknown = null;
    try {
      const { error } = await SupabaseConfig.auth.signOut();
      supabaseError = error ?? null;
    } catch (error) {
      supabaseError = error;
    }

    if (id && AppConfig.featureFirebase) {
      try {
        await PushService.unsubscribeFromTopic('DRIVER_ORDERS_READY');
        await PushService.unsubscribeFromDriverTopic(id);
        await PushService.unsubscribeFromOrdersTopic();
        await PushService.unsubscribeAll();
      } catch {
        // Ignore: sign-out must always complete.
      }
    }

    setUser(null);
    if (supabaseError) throw supabaseError;
  },

  refreshUser(): void {
    setUser(SupabaseConfig.currentUser);
  },
};
