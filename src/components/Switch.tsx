import React from 'react';
import { Switch as RNSwitch, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';

interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Switch({ value, onValueChange, label, disabled }: SwitchProps) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
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
