import React from 'react';
import { RequireGuest } from '../src/components/RequireGuest';
import { SignupScreen } from '../src/screens/auth/SignupScreen';

export default function SignupRoute() {
  return (
    <RequireGuest>
      <SignupScreen />
    </RequireGuest>
  );
}
