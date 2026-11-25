import React, { useSyncExternalStore } from 'react';
import { Redirect } from 'expo-router';
import {
  getPendingDeviceChallenge,
  subscribeDeviceChallenge,
} from './DeviceVerificationModal';
import { useAuthStore } from '../stores/authStore';
import { LoadingScreen } from './Spinner';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const initialized = useAuthStore((state) => state.initialized);
  const user = useAuthStore((state) => state.user);
  const pendingChallenge = useSyncExternalStore(
    subscribeDeviceChallenge,
    getPendingDeviceChallenge,
    getPendingDeviceChallenge,
  );
  if (!initialized) return <LoadingScreen />;
  if (!user) return <Redirect href="/welcome" />;
  // A sign-in challenge outlives LoginScreen. Send deep links and notification
  // taps back to RootGate, which owns the forced modal until the code is verified.
  if (pendingChallenge) return <Redirect href="/" />;
  return <>{children}</>;
}
