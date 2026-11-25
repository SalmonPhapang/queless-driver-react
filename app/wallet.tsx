import React from 'react';
import { Redirect } from 'expo-router';

export default function LegacyWalletRoute() {
  return <Redirect href="/home/wallet" />;
}
