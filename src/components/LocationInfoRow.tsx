import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';

interface LocationInfoRowProps {
  label: string;
  address: string;
  icon?: React.ReactNode;
  completed?: boolean;
  inactive?: boolean;
}

export function LocationInfoRow({ label, address, icon, completed, inactive }: LocationInfoRowProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, inactive && styles.inactive]}>
      <View style={[styles.icon, { backgroundColor: colors.primaryContainer }]}>
        {icon ?? <MaterialCommunityIcons name="map-marker" size={18} color={colors.secondary} />}
      </View>
      <View style={styles.body}>
        <Text style={[typography.labelSmall, styles.label, { color: completed ? colors.success : colors.secondary }]}>
          {label}
        </Text>
        <Text style={[typography.bodyMedium, { color: colors.text }]}>{address}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  label: { fontWeight: '700', letterSpacing: 0.5, marginBottom: 2 },
  inactive: { opacity: 0.55 },
});
