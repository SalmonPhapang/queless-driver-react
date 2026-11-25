import React from 'react';
import { Redirect } from 'expo-router';

export default function LegacyNotificationsRoute() {
  return <Redirect href="/home/notifications" />;
}
