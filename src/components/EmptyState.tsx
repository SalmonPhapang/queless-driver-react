import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';

interface EmptyStateProps {
  title: string;
  message?: string | null;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ title, message, icon, action }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      {icon}
      <Text style={[typography.titleMedium, styles.title, { color: colors.text }]}>{title}</Text>
      {message ? <Text style={[typography.bodyMedium, styles.message, { color: colors.textMuted }]}>{message}</Text> : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 8 },
  title: { textAlign: 'center', marginTop: 8 },
  message: { textAlign: 'center' },
});
