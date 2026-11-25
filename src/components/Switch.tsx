import React from 'react';
import { Switch as RNSwitch, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';

interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Switch({ value, onValueChange, label, disabled, style }: SwitchProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.root, style]}>
      {label ? <Text style={[typography.bodyMedium, { color: colors.text, flex: 1 }]}>{label}</Text> : null}
      <RNSwitch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.divider, true: colors.primary }}
        thumbColor={colors.onPrimary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
});
