import React from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';

interface InputProps extends TextInputProps {
  label: string;
  error?: string | null;
  multiline?: boolean;
}

export function Input({ label, error, style, multiline, ...rest }: InputProps) {
  const { colors, isDark } = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[typography.labelLarge, styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        {...rest}
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
        style={[
          typography.bodyMedium,
          styles.input,
          multiline && styles.multiline,
          {
            color: colors.text,
            backgroundColor: colors.card,
            borderColor: error ? colors.error : isDark ? colors.divider : '#E5E7EB',
          },
          style,
        ]}
      />
      {error ? <Text style={[typography.labelSmall, styles.error, { color: colors.error }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 14 },
  label: { marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  error: { marginTop: 6 },
});
