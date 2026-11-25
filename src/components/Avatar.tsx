import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';
import { initialsOf } from '../lib/format';

interface AvatarProps {
  name?: string | null;
  uri?: string | null;
  size?: number;
}

export function Avatar({ name, uri, size = 64 }: AvatarProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primaryContainer },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <Text style={[typography.titleMedium, { color: colors.text }]}>{initialsOf(name ?? '')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  imageFallback: { width: '100%', height: '100%' },
});
