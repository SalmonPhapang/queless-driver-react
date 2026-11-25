import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function LegacyOrderRoute() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  return <Redirect href={`/home/orders/${orderId ?? ''}`} />;
}
