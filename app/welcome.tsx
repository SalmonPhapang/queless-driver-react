import React from 'react';
import { RequireGuest } from '../src/components/RequireGuest';
import { WelcomeScreen } from '../src/screens/auth/WelcomeScreen';

export default function WelcomeRoute() {
  return (
    <RequireGuest>
      <WelcomeScreen />
    </RequireGuest>
  );
}
