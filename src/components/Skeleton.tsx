import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';
import { AppBar } from './AppBar';
import { Screen } from './Screen';

interface ShimmerProps {
  width?: ViewStyle['width'];
  height?: ViewStyle['height'];
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  /** Stagger sibling blocks by a few milliseconds for a natural sweep. */
  delay?: number;
}

/**
 * Theme-aware animated skeleton block. The highlight is clipped inside the
 * block and sweeps left-to-right on native.
 */
export function Shimmer({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
  delay = 0,
}: ShimmerProps) {
  const { colors, isDark } = useTheme();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(progress, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [delay, progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['-130%', '230%'],
  });

  return (
    <View
      pointerEvents="none"
      style={[
        styles.block,
        { backgroundColor: colors.primaryContainer, borderRadius, width, height },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.highlight,
          {
            backgroundColor: isDark ? colors.textMuted : colors.card,
            opacity: isDark ? 0.16 : 0.9,
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  );
}

type DeliverySkeletonVariant = 'available' | 'active' | 'history';

export function DeliveryOrderCardSkeleton({
  variant = 'available',
}: {
  variant?: DeliverySkeletonVariant;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.divider }]}>
      <View style={[styles.cardHeader, { backgroundColor: colors.primaryContainer }]}>
        <Shimmer width={18} height={18} borderRadius={9} />
        <Shimmer width="46%" height={14} />
        <Shimmer width={52} height={11} delay={60} />
      </View>

      <View style={styles.routeBody}>
        <View style={styles.rail}>
          <Shimmer width={20} height={20} borderRadius={10} />
          <Shimmer width={2} height={54} borderRadius={1} style={styles.railLine} delay={40} />
          <Shimmer width={20} height={20} borderRadius={10} delay={80} />
        </View>
        <View style={styles.flex}>
          <Shimmer width="36%" height={10} />
          <Shimmer width="92%" height={13} style={styles.spacedTiny} delay={60} />
          <Shimmer width="46%" height={10} style={styles.spacedMedium} delay={110} />
          <Shimmer width="86%" height={13} style={styles.spacedTiny} delay={160} />
        </View>
      </View>

      <View style={styles.meta}>
        <Shimmer width={64} height={12} delay={200} />
        {variant === 'history' ? <Shimmer width={72} height={14} delay={240} /> : null}
      </View>

      {variant === 'available' ? (
        <View style={styles.footer}>
          <Shimmer width="100%" height={50} borderRadius={14} delay={280} />
        </View>
      ) : null}
      {variant === 'active' ? (
        <View style={styles.footer}>
          <View style={styles.actionRow}>
            <Shimmer width="48%" height={44} borderRadius={14} delay={260} />
            <Shimmer width="48%" height={44} borderRadius={14} delay={300} />
          </View>
          <Shimmer width="100%" height={50} borderRadius={14} style={styles.spacedSmall} delay={340} />
        </View>
      ) : null}
    </View>
  );
}

export function DeliveryOrdersSkeleton({
  variant = 'available',
  count = 3,
}: {
  variant?: DeliverySkeletonVariant;
  count?: number;
}) {
  return (
    <Screen padded={false} scroll={false}>
      <View style={styles.cards}>
        {variant === 'history' ? (
          <Shimmer width={150} height={24} style={styles.sectionHeader} />
        ) : null}
        {Array.from({ length: count }, (_, index) => (
          <DeliveryOrderCardSkeleton key={index} variant={variant} />
        ))}
      </View>
    </Screen>
  );
}

export function OrderDetailsSkeleton({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  return (
    <Screen padded={false} scroll={false}>
      <AppBar title="Order" onBack={onBack} />
      <View style={styles.detailContent}>
        <Shimmer width="100%" height={92} borderRadius={18} />
        <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.divider }]}>
          <Shimmer width={118} height={13} />
          <View style={styles.detailRow}>
            <Shimmer width={28} height={28} borderRadius={14} delay={60} />
            <View style={styles.flex}>
              <Shimmer width="72%" height={13} delay={100} />
              <Shimmer width="88%" height={11} style={styles.spacedTiny} delay={150} />
            </View>
          </View>
          <View style={styles.detailRow}>
            <Shimmer width={28} height={28} borderRadius={14} delay={200} />
            <View style={styles.flex}>
              <Shimmer width="64%" height={13} delay={240} />
              <Shimmer width="84%" height={11} style={styles.spacedTiny} delay={290} />
            </View>
          </View>
        </View>
        <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.divider }]}>
          <Shimmer width={92} height={13} />
          <Shimmer width="92%" height={13} style={styles.spacedMedium} delay={80} />
          <Shimmer width="74%" height={13} style={styles.spacedTiny} delay={130} />
        </View>
        <Shimmer width="100%" height={50} borderRadius={14} style={styles.spacedSmall} delay={180} />
        <Shimmer width="100%" height={50} borderRadius={14} delay={220} />
      </View>
    </Screen>
  );
}

export function WalletSummarySkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, styles.walletCard, { backgroundColor: colors.card, borderColor: colors.divider }]}>
      <Shimmer width={96} height={11} />
      <Shimmer width="62%" height={14} style={styles.spacedSmall} delay={60} />
      <Shimmer width="72%" height={34} style={styles.spacedMedium} delay={110} />
      <Shimmer width="44%" height={13} style={styles.spacedTiny} delay={160} />
      <Shimmer width="94%" height={12} style={styles.spacedSmall} delay={210} />
      <Shimmer width="78%" height={12} style={styles.spacedTiny} delay={250} />
      <View style={styles.divider} />
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Shimmer width="70%" height={18} delay={300} />
          <Shimmer width="54%" height={11} style={styles.spacedTiny} delay={340} />
        </View>
        <View style={styles.stat}>
          <Shimmer width="70%" height={18} delay={320} />
          <Shimmer width="54%" height={11} style={styles.spacedTiny} delay={360} />
        </View>
      </View>
    </View>
  );
}

export function SettlementRowsSkeleton({ count = 3 }: { count?: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stackSm}>
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          style={[styles.settlementRow, { backgroundColor: colors.card, borderColor: colors.divider }]}
        >
          <Shimmer width={20} height={20} borderRadius={10} delay={index * 60} />
          <View style={styles.flex}>
            <Shimmer width="38%" height={13} delay={index * 60 + 40} />
            <Shimmer width="28%" height={12} style={styles.spacedTiny} delay={index * 60 + 80} />
          </View>
          <Shimmer width={46} height={20} borderRadius={999} delay={index * 60 + 120} />
        </View>
      ))}
    </View>
  );
}

export function BankDetailsFormSkeleton() {
  return (
    <View style={styles.form}>
      <Shimmer width="94%" height={13} />
      <Shimmer width="76%" height={13} style={styles.spacedTiny} delay={50} />
      {[0, 1, 2, 3, 4].map((index) => (
        <View key={index} style={styles.inputBlock}>
          <Shimmer width={index % 2 === 0 ? 96 : 122} height={11} delay={index * 50} />
          <Shimmer width="100%" height={48} borderRadius={12} style={styles.spacedTiny} delay={index * 50 + 50} />
        </View>
      ))}
      <View style={styles.actionRow}>
        <Shimmer width="48%" height={48} borderRadius={14} delay={280} />
        <Shimmer width="48%" height={48} borderRadius={14} delay={320} />
      </View>
    </View>
  );
}

export function NotificationSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.notification, { backgroundColor: colors.card, borderColor: colors.divider }]}>
      <Shimmer width={40} height={40} borderRadius={20} />
      <View style={styles.flex}>
        <View style={styles.rowBetween}>
          <Shimmer width="52%" height={13} delay={60} />
          <Shimmer width={44} height={10} delay={100} />
        </View>
        <Shimmer width="94%" height={12} style={styles.spacedTiny} delay={140} />
        <Shimmer width="72%" height={12} style={styles.spacedTiny} delay={180} />
      </View>
    </View>
  );
}

export function NotificationsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, index) => (
        <NotificationSkeleton key={index} />
      ))}
    </View>
  );
}

export function ProfileSkeleton() {
  const { colors } = useTheme();
  return (
    <Screen scroll contentContainerStyle={styles.profileContent}>
      <View style={styles.hero}>
        <Shimmer width={72} height={72} borderRadius={36} />
        <View style={styles.flex}>
          <Shimmer width="64%" height={19} />
          <Shimmer width="42%" height={12} style={styles.spacedTiny} delay={60} />
          <View style={styles.badgeRow}>
            <Shimmer width={68} height={22} borderRadius={999} delay={100} />
            <Shimmer width={82} height={22} borderRadius={999} delay={140} />
          </View>
        </View>
      </View>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.divider }]}>
        <Shimmer width={116} height={13} />
        {[0, 1, 2, 3].map((index) => (
          <View key={index} style={styles.detailRow}>
            <Shimmer width={18} height={18} borderRadius={9} delay={index * 50 + 50} />
            <View style={styles.flex}>
              <Shimmer width="38%" height={12} delay={index * 50 + 90} />
              <Shimmer width="72%" height={12} style={styles.spacedTiny} delay={index * 50 + 130} />
            </View>
          </View>
        ))}
      </View>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.divider }]}>
        <Shimmer width={140} height={13} />
        {[0, 1, 2, 3, 4].map((index) => (
          <View key={index} style={styles.detailRow}>
            <Shimmer width={44} height={12} delay={index * 50 + 50} />
            <Shimmer width="58%" height={12} delay={index * 50 + 90} />
          </View>
        ))}
      </View>
    </Screen>
  );
}

export function PermissionRequestSkeleton() {
  const { colors } = useTheme();
  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.permissionBody}>
        <Text style={[typography.headlineLarge, styles.permissionTitle, { color: colors.accent }]}>
          Help us serve you better
        </Text>
        <Text style={[typography.bodyLarge, { color: colors.textMuted }]}>
          To provide the best delivery experience, we need a few permissions.
        </Text>
        <View style={styles.permissionTiles}>
          {[0, 1, 2, 3].map((index) => (
            <View
              key={index}
              style={[styles.permissionTile, { backgroundColor: colors.card, borderColor: colors.divider }]}
            >
              <Shimmer width={40} height={40} borderRadius={20} delay={index * 60} />
              <View style={styles.flex}>
                <Shimmer width="48%" height={14} delay={index * 60 + 50} />
                <Shimmer width="90%" height={11} style={styles.spacedTiny} delay={index * 60 + 100} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { overflow: 'hidden' },
  highlight: { position: 'absolute', top: 0, bottom: 0, left: 0, width: '60%' },
  card: { borderWidth: 1, borderRadius: 18, overflow: 'hidden', marginBottom: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  routeBody: { flexDirection: 'row', padding: 16, gap: 12 },
  rail: { alignItems: 'center', width: 20 },
  railLine: { marginVertical: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14 },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  cards: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  sectionHeader: { marginBottom: 12 },
  detailContent: { padding: 16, gap: 16 },
  detailCard: { borderRadius: 18, borderWidth: 1, padding: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  walletCard: { padding: 20 },
  divider: { height: 1, marginVertical: 16, backgroundColor: 'rgba(128,128,128,0.18)' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { flex: 1, alignItems: 'center' },
  stackSm: { gap: 8 },
  settlementRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 12 },
  form: { gap: 16 },
  inputBlock: { gap: 6 },
  notification: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  list: { gap: 10 },
  profileContent: { padding: 16, gap: 16 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  permissionBody: { paddingTop: 56, paddingBottom: 32, paddingHorizontal: 24 },
  permissionTitle: { fontSize: 28 },
  permissionTiles: { marginTop: 32, gap: 12 },
  permissionTile: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  flex: { flex: 1 },
  spacedTiny: { marginTop: 6 },
  spacedSmall: { marginTop: 10 },
  spacedMedium: { marginTop: 16 },
});
