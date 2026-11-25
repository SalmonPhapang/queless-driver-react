import React from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { LoadingScreen } from './Spinner';

export function RequireGuest({ children }: { children: React.ReactNode }) {
  const initialized = useAuthStore((state) => state.initialized);
  const user = useAuthStore((state) => state.user);
  if (!initialized) return <LoadingScreen />;
  if (user) return <Redirect href="/" />;
  return <>{children}</>;
}
