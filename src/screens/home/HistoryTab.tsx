import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Button } from '../../components/Button';
import { DeliveryEmptyState } from '../../components/DeliveryEmptyState';
import { OrderCard, OrderRoute } from '../../components/OrderCard';
import { Screen } from '../../components/Screen';
import { DeliveryOrdersSkeleton } from '../../components/Skeleton';
import { errorMessage } from '../../lib/errors';
import { DeliveryOrderModel, type DeliveryOrder } from '../../models/deliveryOrder';
import { OrderStatusX } from '../../models/statuses';
import { DriverService } from '../../services/driverService';
import { OrderService } from '../../services/orderService';
import { UiService } from '../../services/uiService';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, paddingBottom: 16 },
  sectionTitle: { paddingHorizontal: 16, paddingBottom: 12, ...typography.headlineSmall },
  cards: { paddingHorizontal: 16 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 14 },
  metaText: { ...typography.bodySmall },
  metaTotal: { marginLeft: 'auto', ...typography.labelLarge },
});

const EmptyHistory = ({ onRefresh }: { onRefresh?: () => void }) => {
  const { colors } = useTheme();
  return (
    <DeliveryEmptyState
      icon={<MaterialCommunityIcons name="clipboard-check-outline" size={44} color={colors.primary} />}
      title="No completed orders yet"
      message="Your delivery history will appear here once you've completed your first order."
      tips={[
        {
          icon: <MaterialCommunityIcons name="information-outline" size={18} color={colors.primary} />,
          text: 'Switch to the Available tab to find new orders.',
        },
        {
          icon: <MaterialCommunityIcons name="white-balance-sunny" size={18} color={colors.primary} />,
          text: 'Keep your app open to receive order notifications.',
        },
      ]}
      action={
        <Button
          variant="primary"
          block
          icon={<MaterialCommunityIcons name="refresh" size={18} color={colors.onPrimary} />}
          title="REFRESH HISTORY"
          onPress={() => onRefresh?.()}
        />
      }
    />
  );
};

/** Port of lib/screens/home/tabs/history_tab.dart. */
export const HistoryTab = () => {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Flutter fetches the profile alongside history for the details route;
      // our route resolves it itself, so only the history result is kept.
      const [fetched] = await Promise.all([
        OrderService.fetchMyOrderHistory({ driverId: user.id }),
        DriverService.getDriverProfile(user.id),
      ]);
      setOrders(fetched);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      UiService.showError(`Error loading history: ${errorMessage(error)}`);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <DeliveryOrdersSkeleton variant="history" />;
  }

  if (orders.length === 0) {
    return (
      <Screen padded={false} scroll={false}>
        <EmptyHistory onRefresh={() => void load()} />
      </Screen>
    );
  }

  const successColor = OrderStatusX.color('delivered');

  return (
    <Screen padded={false} scroll={false}>
      <View style={styles.content}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Order History</Text>
        <View style={styles.cards}>
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              headerLabel="DELIVERED"
              headerColor={successColor}
              headerIcon={OrderStatusX.icon('delivered')}
              onPress={() => router.push(`/home/orders/${order.id}`)}
            >
              <OrderRoute order={order} pickupDone pickupCompleted dropoffActive />
              <View style={styles.meta}>
                <MaterialCommunityIcons name="basket-outline" size={14} color={colors.textMuted} />
                <Text style={[styles.metaText, { color: colors.text }]}>{order.items?.length ?? 0} items</Text>
                <Text style={[styles.metaTotal, { color: colors.text }]}>
                  R{DeliveryOrderModel.baseTotal(order).toFixed(2)}
                </Text>
              </View>
            </OrderCard>
          ))}
        </View>
      </View>
    </Screen>
  );
};
