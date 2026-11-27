import React from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';

interface InputProps extends TextInputProps {
  label: string;
  error?: string | null;
  multiline?: boolean;
  /** Tighter vertical rhythm for dense forms. */
  compact?: boolean;
  /** Rendered inside the field, e.g. `+27` for South African numbers. */
  prefix?: string;
  /** Rendered at the end of the field, e.g. a show/hide password button. */
  rightAdornment?: React.ReactNode;
}

export function Input({
  label,
  error,
  style,
  multiline,
  compact = false,
  prefix,
  rightAdornment,
  ...rest
}: InputProps) {
  const { colors, isDark } = useTheme();
  const borderColor = error ? colors.error : isDark ? colors.divider : '#E5E7EB';
  const hasFrame = Boolean(prefix || rightAdornment);

  const textInput = (
    <TextInput
      {...rest}
      multiline={multiline}
      placeholderTextColor={colors.textMuted}
      style={
        hasFrame
          ? [
              typography.bodyMedium,
              styles.prefixedInput,
              multiline && styles.multiline,
              { color: colors.text },
              style,
            ]
          : [
              typography.bodyMedium,
              styles.input,
              multiline && styles.multiline,
              {
                color: colors.text,
                backgroundColor: colors.card,
                borderColor,
              },
              style,
            ]
      }
    />
  );

  return (
    <View style={[styles.group, compact && styles.compactGroup]}>
      <Text style={[typography.labelLarge, styles.label, { color: colors.text }]}>{label}</Text>
      {hasFrame ? (
        <View
          style={[
            styles.prefixFrame,
            multiline && styles.prefixFrameMultiline,
            { backgroundColor: colors.card, borderColor },
          ]}
        >
          {prefix ? (
            <Text style={[typography.bodyMedium, styles.prefix, { color: colors.textMuted }]}>
              {prefix}
            </Text>
          ) : null}
          {textInput}
          {rightAdornment ? <View style={styles.adornment}>{rightAdornment}</View> : null}
        </View>
      ) : (
        textInput
      )}
      {error ? (
        <Text style={[typography.labelSmall, styles.error, { color: colors.error }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 14 },
  compactGroup: { marginBottom: 4 },
  label: { marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14 },
  prefixFrame: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  prefixFrameMultiline: { alignItems: 'flex-start' },
  prefix: { fontWeight: '700', marginRight: 8 },
  prefixedInput: { flex: 1, paddingHorizontal: 0, paddingVertical: 0 },
  adornment: { marginLeft: 8, alignSelf: 'center' },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  error: { marginTop: 6 },
});
