import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';
import { useToastStore } from '../stores/toastStore';

export function ToastHost() {
  const { colors } = useTheme();
  const toast = useToastStore((state) => state.toasts[0]);
  const dismiss = useToastStore((state) => state.dismiss);
  if (!toast) return null;

  const background =
    toast.kind === 'error'
      ? colors.error
      : toast.kind === 'success'
        ? colors.success
        : colors.primaryContainer;
  const textColor = toast.kind === 'info' ? colors.text : colors.onPrimary;

  return (
    <View style={styles.host} pointerEvents="box-none">
      <View style={[styles.toast, { backgroundColor: background }]}>
        {toast.kind === 'loading' ? (
          <Ionicons name="sync" size={18} color={textColor} />
        ) : null}
        <Text style={[typography.bodyMedium, styles.message, { color: textColor }]}>{toast.message}</Text>
        {toast.duration === 0 ? null : (
          <Pressable onPress={() => dismiss(toast.id)} hitSlop={10}>
            <Ionicons name="close" size={18} color={textColor} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 16, right: 16, bottom: 32, zIndex: 1000 },
  toast: { borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  message: { flex: 1 },
});
