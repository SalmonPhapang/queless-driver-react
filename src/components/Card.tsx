import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export function Card({ children, style, onPress }: CardProps) {
  const { colors } = useTheme();
  const content = [
    styles.card,
    { backgroundColor: colors.card, borderColor: colors.divider },
    style,
  ];
  if (!onPress) return <View style={content}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [...content, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 12 },
});
