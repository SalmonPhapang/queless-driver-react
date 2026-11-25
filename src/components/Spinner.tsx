import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';

export function Spinner() {
  const { colors } = useTheme();
  return <ActivityIndicator size="large" color={colors.secondary} />;
}

export function LoadingScreen({ message }: { message?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, gap: 12 }}>
      <Spinner />
      {message ? <Text style={[typography.bodyMedium, { color: colors.textMuted }]}>{message}</Text> : null}
    </View>
  );
}
