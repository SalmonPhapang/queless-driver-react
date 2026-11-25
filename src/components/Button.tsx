import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'green' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  block?: boolean;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  block,
  loading,
  disabled,
  icon,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const background =
    variant === 'primary'
      ? colors.secondary
      : variant === 'green'
        ? colors.success
        : variant === 'secondary'
          ? colors.primaryContainer
          : variant === 'danger'
            ? colors.error
            : 'transparent';
  const textColor =
    variant === 'outline' || variant === 'ghost'
      ? variant === 'ghost'
        ? colors.textMuted
        : colors.secondary
      : variant === 'secondary'
        ? colors.text
        : variant === 'green'
          ? colors.onSecondary
          : colors.onPrimary;
  const borderColor = variant === 'danger' ? colors.error : colors.secondary;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.small,
        block && styles.block,
        {
          backgroundColor: background,
          borderColor: variant === 'outline' || variant === 'ghost' ? borderColor : background,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[size === 'sm' ? typography.labelSmall : typography.labelLarge, styles.text, { color: textColor }]}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingHorizontal: 24,
  },
  small: { minHeight: 38, borderRadius: 12, paddingHorizontal: 16 },
  block: { width: '100%' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  text: { textAlign: 'center' },
});
