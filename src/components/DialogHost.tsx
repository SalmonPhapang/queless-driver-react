import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';
import { useDialogStore } from '../stores/dialogStore';

export function DialogHost() {
  const { colors } = useTheme();
  const dialog = useDialogStore((state) => state.dialog);
  const close = useDialogStore((state) => state.close);
  if (!dialog) return null;

  const icon =
    dialog.icon === 'warning'
      ? 'alert-circle'
      : dialog.icon === 'info'
        ? 'information-circle'
        : 'check-circle';
  const color =
    dialog.icon === 'warning' ? colors.warning : dialog.icon === 'info' ? colors.info : colors.success;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (dialog.dismissible) close();
      }}
    >
      <View style={styles.backdrop}>
        <View style={[styles.dialog, { backgroundColor: colors.card, borderColor: colors.divider }]}>
          <Ionicons name={icon as never} size={40} color={color} style={styles.icon} />
          <Text style={[typography.titleLarge, styles.title, { color: colors.text }]}>{dialog.title}</Text>
          <Text style={[typography.bodyMedium, styles.message, { color: colors.textMuted }]}>{dialog.message}</Text>
          <Pressable onPress={close} style={[styles.button, { backgroundColor: colors.secondary }]}>
            <Text style={[typography.labelLarge, { color: colors.onSecondary }]}>
              {dialog.confirmLabel ?? 'OK'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', borderWidth: 1, borderRadius: 24, padding: 24, alignItems: 'center' },
  icon: { marginBottom: 12 },
  title: { textAlign: 'center' },
  message: { textAlign: 'center', marginTop: 8, marginBottom: 20 },
  button: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
});
