import React from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';

interface ScreenProps extends Omit<ScrollViewProps, 'contentContainerStyle'> {
  children: React.ReactNode;
  padded?: boolean;
  scroll?: boolean;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
}

export function Screen({
  children,
  padded = true,
  scroll = true,
  contentContainerStyle,
  ...rest
}: ScreenProps) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
      {scroll ? (
        <ScrollView
          {...rest}
          contentContainerStyle={[styles.scrollContent, padded && styles.padded, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, padded && styles.padded, contentContainerStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  padded: { paddingHorizontal: 16, paddingTop: 16 },
  scrollContent: { flexGrow: 1, paddingBottom: 32 },
});
