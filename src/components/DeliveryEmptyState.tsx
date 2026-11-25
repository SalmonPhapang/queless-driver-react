import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';

interface DeliveryEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  message: string;
  tips?: { icon: React.ReactNode; text: string }[];
  action?: React.ReactNode;
}

/**
 * Centered empty state used by the delivery tabs. It deliberately owns its
 * height so it does not collapse inside a non-scrolling tab container.
 */
export function DeliveryEmptyState({ icon, title, message, tips = [], action }: DeliveryEmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <View style={[styles.iconBubble, { backgroundColor: colors.primaryContainer }]}>{icon}</View>
        <Text style={[typography.titleLarge, styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[typography.bodyMedium, styles.message, { color: colors.textMuted }]}>{message}</Text>

        {tips.length > 0 && (
          <View style={styles.tips}>
            {tips.map((tip, index) => (
              <View
                key={`${index}-${tip.text}`}
                style={[styles.tip, { backgroundColor: colors.card, borderColor: colors.divider }]}
              >
                <View style={styles.tipIcon}>{tip.icon}</View>
                <Text style={[typography.bodySmall, styles.tipText, { color: colors.textMuted }]}>
                  {tip.text}
                </Text>
              </View>
            ))}
          </View>
        )}

        {action && <View style={styles.action}>{action}</View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  inner: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
  },
  iconBubble: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 22,
  },
  tips: {
    width: '100%',
    gap: 10,
    marginTop: 24,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tipIcon: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: {
    flex: 1,
    textAlign: 'left',
  },
  action: {
    width: '100%',
    marginTop: 24,
    gap: 10,
  },
});
