import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';

interface BadgeProps {
  label: string;
  tone?: 'green' | 'orange' | 'red' | 'blue' | 'gray';
}

export function Badge({ label, tone = 'gray' }: BadgeProps) {
  const { colors } = useTheme();
  const background =
    tone === 'green'
      ? colors.success
      : tone === 'orange'
        ? colors.warning
        : tone === 'red'
          ? colors.error
          : tone === 'blue'
            ? colors.info
            : colors.primaryContainer;
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[typography.labelSmall, styles.text, { color: colors.onPrimary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
});
