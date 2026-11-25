import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';

interface AppBarProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
  actions?: React.ReactNode;
}

export function AppBar({ title, subtitle, right, onBack, actions }: AppBarProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: colors.headerBackground, borderColor: colors.divider }]}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={12} style={styles.back} accessibilityRole="button">
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
      ) : null}
      <View style={styles.titleGroup}>
        <Text style={[typography.titleLarge, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[typography.bodySmall, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {right ?? actions}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  back: { width: 32, alignItems: 'flex-start' },
  titleGroup: { flex: 1 },
});
