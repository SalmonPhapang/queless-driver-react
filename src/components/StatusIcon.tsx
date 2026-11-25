import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { OrderStatusX, type OrderStatus } from '../models/statuses';

const ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  hourglass: 'timer-sand',
  banknote: 'cash',
  'banknote-x': 'cash-remove',
  store: 'store',
  utensils: 'silverware-fork-knife',
  package: 'package',
  'user-pin': 'account',
  bike: 'bike',
  'map-pin': 'map-marker',
  'check-circle': 'check-circle',
  'x-circle': 'close-circle',
  ban: 'cancel',
  'alert-circle': 'alert-circle',
  'cloud-off': 'cloud-off',
  'cloud-check': 'cloud-check',
  coffee: 'coffee',
  loader: 'loading',
  truck: 'truck',
};

interface StatusIconProps {
  name?: string;
  status?: OrderStatus | string;
  size?: number;
  color?: string;
}

export function StatusIcon({ name, status, size = 18, color }: StatusIconProps) {
  const { colors } = useTheme();
  const resolved =
    status != null
      ? OrderStatusX.icon(status as OrderStatus)
      : (name ?? 'circle');
  const icon = (ICONS[resolved] ?? 'circle-outline') as keyof typeof MaterialCommunityIcons.glyphMap;
  return (
    <MaterialCommunityIcons
      name={icon}
      size={size}
      color={color ?? colors.secondary}
      style={styles.icon}
    />
  );
}

const styles = StyleSheet.create({ icon: { lineHeight: undefined } });
