import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { AppState, StyleSheet, Text, View } from 'react-native';
import {
  completeDeviceChallenge,
  DeviceVerificationModal,
  getPendingDeviceChallenge,
  subscribeDeviceChallenge,
} from '../components/DeviceVerificationModal';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { Spinner } from '../components/Spinner';
import { StatusMessage } from '../components/StatusMessage';
import { errorMessage } from '../lib/errors';
import { Prefs, PrefKeys } from '../lib/storage';
import type { Driver } from '../models/driver';
import { DriverStatusX } from '../models/statuses';
import { AuthService } from '../services/authService';
import { DriverService } from '../services/driverService';
import { LocationService } from '../services/locationService';
import { UiService } from '../services/uiService';
import { useAuthStore } from '../stores/authStore';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';

/**
 * Port of `RootRouter` in lib/main.dart.
 *
 * Resolves the one place the driver is allowed to be right now. Every gate is
 * ordered exactly like the Flutter original: inactive account, missing
 * profile, unverified (registration + permissions), verified (approval +
 * permissions), then home.
 */
export const RootGate = () => {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const initialized = useAuthStore((state) => state.initialized);
  // A sign-in challenge is awaited across the guest-gate redirect, so it is
  // rendered and gated here rather than being tied to LoginScreen's lifetime.
  const challenge = useSyncExternalStore(subscribeDeviceChallenge, getPendingDeviceChallenge);

  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user) {
      setDriver(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setDriver(await DriverService.getDriverProfile(user.id));
    } catch (loadError) {
      setError(String(loadError));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  // Restore online presence on app start and refresh the fix when the app
  // returns from the background. Force-killed apps cannot publish; the backend
  // 15-minute freshness window naturally excludes them until they reopen.
  const driverStatus = driver?.driverStatus ?? '';
  const hasDriver = Boolean(driver);
  useEffect(() => {
    if (!user || !hasDriver) {
      void LocationService.stopOnlinePresence().catch((error) => {
        console.debug('[presence] Stop failed:', error);
      });
      return;
    }

    void LocationService.syncDriverPresence({
      driverId: user.id,
      driverStatus,
    }).catch((error) => {
      console.debug('[presence] Sync failed:', error);
    });

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void LocationService.refreshOnlinePresence().catch((error) => {
          console.debug('[presence] Resume refresh failed:', error);
        });
      }
    });
    return () => subscription.remove();
  }, [user, hasDriver, driverStatus]);

  const signOut = useCallback(() => {
    setSignOutError(null);
    void AuthService.signOut()
      .then(() => router.replace('/welcome'))
      .catch((failure) => {
        const reason = errorMessage(failure);
        setSignOutError(reason);
        UiService.showError(`Could not sign out: ${reason}`);
      });
  }, []);

  // The native equivalent of <Navigate replace>: routing is a side effect, so
  // it runs after render and never renders a screen the driver may not see.
  let destination: string | null = null;
  if (initialized && !challenge) {
    if (!user) {
      destination = '/welcome';
    } else if (!loading && !error && driver && driver.driverStatus !== 'inactive') {
      // DB defaults full_name to '' NOT NULL, so check both null and empty.
      const needsOnboarding = !driver.fullName || driver.fullName.trim() === '';
      if (needsOnboarding) {
        destination = '/onboarding';
      } else {
        const registrationSuccessSeen = Prefs.getBool(PrefKeys.registrationSuccessSeen);
        const approvalWelcomeSeen = Prefs.getBool(PrefKeys.approvalWelcomeSeen);
        const permissionsRequested = Prefs.getBool(PrefKeys.permissionsRequested);

        if (!driver.isVerified) {
          if (!registrationSuccessSeen) destination = '/registration-success';
          else if (!permissionsRequested) destination = '/permissions';
          else destination = '/home/available';
        } else if (!approvalWelcomeSeen) {
          destination = '/approval-success';
        } else if (!permissionsRequested) {
          destination = '/permissions';
        } else {
          destination = '/home/available';
        }
      }
    }
  }

  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination]);

  if (challenge) {
    return (
      <Screen scroll={false} padded={false}>
        <View style={styles.loading}>
          <Spinner />
        </View>
        <DeviceVerificationModal
          client={challenge.client}
          onVerified={() => completeDeviceChallenge()}
        />
      </Screen>
    );
  }

  if (!initialized || loading || destination) {
    return (
      <Screen scroll={false} padded={false}>
        <View style={styles.loading}>
          <Spinner />
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen scroll={false} padded={false}>
        <View style={styles.centered}>
          <MaterialCommunityIcons name="cancel" size={48} color={colors.error} />
          <Text style={[typography.headlineSmall, styles.boldTitle, { color: colors.error }]}>
            Error loading profile
          </Text>
          <Text style={[typography.bodyMedium, styles.muted, { color: colors.textMuted }]}>
            {error}
          </Text>
          <Button title="Retry" variant="primary" onPress={() => void loadProfile()} />
        </View>
      </Screen>
    );
  }

  // A signed-in auth user can exist without a drivers row (for example, an
  // account created outside the app). Do not silently jump into onboarding:
  // explain what happened and let the driver choose to create the profile.
  if (!driver) {
    return (
      <Screen scroll={false} padded={false}>
        <View style={styles.centered}>
          <MaterialCommunityIcons name="account-question-outline" size={64} color={colors.accent} />
          <Text style={[typography.headlineMedium, styles.boldTitle, { color: colors.text }]}>
            No Driver Profile Found
          </Text>
          <Text style={[typography.bodyLarge, styles.message, { color: colors.textMuted }]}>
            {`We couldn't find a driver profile for ${user?.email ?? 'this account'}. Fill one out to start receiving delivery offers.`}
          </Text>
          {signOutError && (
            <StatusMessage
              variant="error"
              title="Could not sign out"
              message={signOutError}
              onDismiss={() => setSignOutError(null)}
            />
          )}
          <View style={styles.actions}>
            <Button
              title="Fill Out Driver Profile"
              variant="primary"
              block
              onPress={() => router.replace('/onboarding')}
            />
            <Button title="Log Out" variant="outline" block onPress={signOut} />
          </View>
        </View>
      </Screen>
    );
  }

  if (driver.driverStatus === 'inactive') {
    const statusName = DriverStatusX.displayName(driver.driverStatus);
    return (
      <Screen scroll={false} padded={false}>
        <View style={styles.centered}>
          <MaterialCommunityIcons name="cancel" size={80} color={colors.error} />
          <Text style={[typography.headlineMedium, styles.boldTitle, { color: colors.text }]}>
            {`Account ${statusName}`}
          </Text>
          <Text style={[typography.bodyLarge, styles.message, { color: colors.textMuted }]}>
            {`Your driver profile has been ${statusName.toLowerCase()}. You no longer have access to the platform.`}
          </Text>
          {signOutError && (
            <StatusMessage
              variant="error"
              title="Could not sign out"
              message={signOutError}
              onDismiss={() => setSignOutError(null)}
            />
          )}
          <View style={styles.logout}>
            <Button title="Log Out" variant="outline" block onPress={signOut} />
          </View>
        </View>
      </Screen>
    );
  }

  // Every remaining branch above resolves to a route; this is only a safe
  // fallback while the replacement is being committed by the router.
  return (
    <Screen>
      <View style={styles.loading}>
        <Spinner />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  boldTitle: { fontWeight: '800', textAlign: 'center' },
  muted: { textAlign: 'center' },
  message: { textAlign: 'center', lineHeight: 24 },
  actions: { marginTop: 16, width: '100%', gap: 12 },
  logout: { marginTop: 16, width: '100%' },
});
