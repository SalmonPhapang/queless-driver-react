import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';
import { formatMoney } from '../lib/format';
import { DeliveryOrderModel, type DeliveryOrder } from '../models/deliveryOrder';
import { LocationInfoRow } from './LocationInfoRow';
import { StatusIcon } from './StatusIcon';

interface OrderCardProps {
  order: DeliveryOrder;
  headerLabel?: string;
  headerColor?: string;
  headerIcon?: string;
  onPress?: () => void;
  onOpen?: () => void;
  children: React.ReactNode;
}

export function OrderCard({
  order,
  headerLabel,
  headerColor,
  headerIcon,
  onPress,
  onOpen,
  children,
}: OrderCardProps) {
  const { colors } = useTheme();
  const tint = headerColor ?? colors.secondary;
  return (
    <Pressable
      onPress={onPress ?? onOpen}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.divider, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={[styles.header, { backgroundColor: colors.primaryContainer }]}>
        {headerIcon ? (
          <StatusIcon name={headerIcon} size={18} color={tint} />
        ) : (
          <MaterialCommunityIcons name="check-circle" size={18} color={tint} />
        )}
        <Text style={[typography.labelLarge, styles.headerLabel, { color: tint }]}>{headerLabel ?? order.code}</Text>
        <Text style={[typography.labelSmall, styles.code, { color: colors.textMuted }]}>#{order.code}</Text>
      </View>
      {children}
    </Pressable>
  );
}

interface OrderRouteProps {
  order: DeliveryOrder;
  pickupDone?: boolean;
  pickupCompleted?: boolean;
  dropoffActive?: boolean;
}

export function OrderRoute({
  order,
  pickupDone = false,
  pickupCompleted = false,
  dropoffActive = true,
}: OrderRouteProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.body}>
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: pickupDone ? colors.divider : colors.success }]}>
          {pickupDone ? (
            <MaterialCommunityIcons name="check" size={14} color={colors.onPrimary} />
          ) : (
            <MaterialCommunityIcons name="store" size={14} color={colors.onPrimary} />
          )}
        </View>
        <View style={[styles.line, { backgroundColor: colors.divider }]} />
        <View style={[styles.dot, { backgroundColor: pickupDone ? colors.secondary : colors.divider }]}>
          <MaterialCommunityIcons name="map-marker" size={14} color={colors.onPrimary} />
        </View>
      </View>
      <View style={styles.routeBody}>
        <LocationInfoRow
          label={order.store?.name?.toUpperCase() ?? 'STORE'}
          address={order.pickupAddress}
          completed={pickupCompleted}
        />
        <View style={{ height: 24 }} />
        <LocationInfoRow
          label={`${order.customerName.toUpperCase()} • ${order.customerPhone}`}
          address={order.dropoffAddress}
          inactive={!dropoffActive}
        />
      </View>
    </View>
  );
}

export function OrderItemsRow({
  order,
  showTotal = true,
  showCash = true,
}: {
  order: DeliveryOrder;
  showTotal?: boolean;
  showCash?: boolean;
}) {
  const { colors } = useTheme();
  const paymentMethod = order.paymentMethod?.toLowerCase() ?? '';
  const isCash = paymentMethod.includes('cash') || paymentMethod.includes('cod');
  return (
    <View style={styles.meta}>
      <MaterialCommunityIcons name="shopping" size={15} color={colors.textMuted} />
      <Text style={[typography.bodySmall, { color: colors.textMuted }]}>{order.items?.length ?? 0} items</Text>
      {showCash && isCash ? (
        <View style={[styles.cash, { backgroundColor: colors.warning }]}>
          <Text style={[typography.labelSmall, styles.cashText]}>CASH</Text>
        </View>
      ) : null}
      {showTotal ? (
        <Text style={[typography.labelLarge, styles.total, { color: colors.text }]}>
          {formatMoney(DeliveryOrderModel.baseTotal(order))}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, overflow: 'hidden', marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  headerLabel: { flexShrink: 1 },
  code: { marginLeft: 'auto' },
  body: { flexDirection: 'row', padding: 16, gap: 12 },
  rail: { alignItems: 'center', width: 20 },
  dot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  line: { width: 2, flex: 1, minHeight: 48 },
  routeBody: { flex: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 14 },
  cash: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  cashText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  total: { marginLeft: 'auto' },
});
