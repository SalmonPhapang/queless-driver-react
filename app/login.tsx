import React from 'react';
import { RequireGuest } from '../src/components/RequireGuest';
import { LoginScreen } from '../src/screens/auth/LoginScreen';

export default function LoginRoute() {
  return (
    <RequireGuest>
      <LoginScreen />
    </RequireGuest>
  );
}
