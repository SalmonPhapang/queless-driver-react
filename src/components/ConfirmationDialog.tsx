import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';
import { Button } from './Button';

interface ConfirmationDialogProps {
  visible: boolean;
  icon: React.ReactNode;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Small, theme-aware confirmation modal for user-initiated state changes. */
export function ConfirmationDialog({
  visible,
  icon,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const { colors } = useTheme();
  const accent =
    tone === 'success'
      ? colors.success
      : tone === 'warning'
        ? colors.warning
        : tone === 'danger'
          ? colors.error
          : colors.primary;
  const confirmVariant: 'primary' | 'green' | 'danger' =
    tone === 'success' ? 'green' : tone === 'danger' ? 'danger' : 'primary';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!loading) onCancel();
      }}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.divider }]}>
          <View style={[styles.iconBubble, { backgroundColor: accent }]}>{icon}</View>
          <Text style={[typography.titleLarge, styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[typography.bodyMedium, styles.message, { color: colors.textMuted }]}>
            {message}
          </Text>
          <View style={styles.actions}>
            <Button
              title={cancelLabel}
              variant="ghost"
              onPress={onCancel}
              disabled={loading}
            />
            <Button
              title={confirmLabel}
              variant={confirmVariant}
              loading={loading}
              onPress={onConfirm}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  iconBubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 21,
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
  },
});
