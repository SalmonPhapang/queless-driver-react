import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';

interface SelectFieldProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  error?: string | null;
  placeholder?: string;
  disabled?: boolean;
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  error,
  placeholder,
  disabled = false,
}: SelectFieldProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.group}>
      <Text style={[typography.labelLarge, styles.label, { color: colors.text }]}>{label}</Text>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[
          styles.control,
          {
            backgroundColor: colors.card,
            borderColor: error ? colors.error : colors.divider,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      >
        <Text style={[typography.bodyMedium, { color: selected ? colors.text : colors.textMuted }]}>
          {selected?.label ?? placeholder ?? 'Select'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>
      {error ? <Text style={[typography.labelSmall, styles.error, { color: colors.error }]}>{error}</Text> : null}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.divider }]}>
            {options.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={({ pressed }) => [
                  styles.option,
                  pressed && { opacity: 0.7 },
                  option.value === value && { backgroundColor: colors.primaryContainer },
                ]}
              >
                <Text style={[typography.bodyMedium, { color: colors.text }]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 14 },
  label: { marginBottom: 6 },
  control: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  error: { marginTop: 6 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)', padding: 16 },
  sheet: { borderWidth: 1, borderRadius: 20, maxHeight: '70%', padding: 8 },
  option: { paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12 },
});
