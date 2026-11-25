import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';

interface StatusMessageProps {
  variant?: 'error' | 'info' | 'success' | 'warning';
  title: string;
  message?: string | null;
  onDismiss?: () => void;
}

export function StatusMessage({ variant = 'info', title, message, onDismiss }: StatusMessageProps) {
  const { colors } = useTheme();
  const color =
    variant === 'error'
      ? colors.error
      : variant === 'success'
        ? colors.success
        : variant === 'warning'
          ? colors.warning
          : colors.info;
  const icon =
    variant === 'error'
      ? 'alert-circle'
      : variant === 'success'
        ? 'check-circle'
        : variant === 'warning'
          ? 'warning'
          : 'information-circle';

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: color }]}>
      <Ionicons name={icon as never} size={24} color={color} />
      <View style={styles.body}>
        <Text style={[typography.titleMedium, { color: colors.text }]}>{title}</Text>
        {message ? <Text style={[typography.bodyMedium, styles.message, { color: colors.textMuted }]}>{message}</Text> : null}
      </View>
      {onDismiss ? (
        <Pressable onPress={onDismiss} hitSlop={12} accessibilityRole="button">
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16 },
  body: { flex: 1 },
  message: { marginTop: 4 },
});
