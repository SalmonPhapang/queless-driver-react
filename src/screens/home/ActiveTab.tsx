import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { OrderCard, OrderItemsRow, OrderRoute } from '../../components/OrderCard';
import { Screen } from '../../components/Screen';
import { DeliveryOrdersSkeleton } from '../../components/Skeleton';
import { StatusMessage } from '../../components/StatusMessage';
import { errorMessage } from '../../lib/errors';
import type { DeliveryOrder } from '../../models/deliveryOrder';
import { OrderStatusX } from '../../models/statuses';
import { BackgroundLocationService } from '../../services/backgroundLocationService';
import { LocationService } from '../../services/locationService';
import { OrderService } from '../../services/orderService';
import { UiService } from '../../services/uiService';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeContext';

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: 16 },
  statusBlock: { marginBottom: 12, marginHorizontal: 16 },
  cards: { paddingHorizontal: 16 },
  footer: { paddingTop: 8, paddingHorizontal: 16, paddingBottom: 12 },
  actionRow: { flexDirection: 'row', gap: 10 },
  cta: { marginTop: 12 },
});

const launchMaps = (query: string): void => {
  void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`);
};

const StatusWithRetry = ({
  title,
  message,
  onRetry,
  style,
}: {
  title?: string;
  message: string;
  onRetry: () => void;
  style?: object;
}) => (
  <View style={style}>
    <StatusMessage variant="error" title={title ?? ''} message={message} />
    <Button variant="outline" size="sm" title="Try again" onPress={onRetry} />
  </View>
);

/** Port of lib/screens/home/tabs/active_tab.dart. */
export const ActiveTab = () => {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setActionError(null);
    if (!user) {
      setLoading(false);
      return;
    }
    let fetched: DeliveryOrder[] = [];
    let syncTracking = false;
    try {
      // The active list does not need a profile fetch. The details route loads
      // one itself, so a slow/failed profile request must not blank this tab.
      fetched = await OrderService.fetchMyActiveOrders({ driverId: user.id });
      syncTracking = true;
      if (!alive.current) return;
      setOrders(fetched);
    } catch (error) {
      if (alive.current) setLoadError(`Failed to load: ${errorMessage(error)}`);
    } finally {
      if (alive.current) setLoading(false);
    }

    if (!alive.current || !syncTracking) return;
    // Background tracking sync is best effort and must not turn a successful
    // load into an error state.
    void LocationService.syncTrackingOrderIds({
      driverId: user.id,
      orderIds: fetched.map((order) => order.id),
    }).catch((error) => {
      console.debug('[active] Tracking sync failed:', error);
    });
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const pickUp = async (order: DeliveryOrder) => {
    setActionError(null);
    try {
      await OrderService.markPickedUp(order.id, order.userId ?? '');
      if (user) {
        await BackgroundLocationService.start({ driverId: user.id, orderIds: [order.id] });
      }
      void load();
    } catch (error) {
      setActionError(`Failed to pick up order: ${errorMessage(error)}`);
    }
  };

  const markArrived = async (order: DeliveryOrder) => {
    setActionError(null);
    try {
      await OrderService.updateOrderStatus({
        orderId: order.id,
        newStatus: 'arrived',
        message: 'Driver arrived at delivery location',
      });
      void load();
    } catch (error) {
      setActionError(`Failed to mark as arrived: ${errorMessage(error)}`);
    }
  };

  const markDelivered = async (order: DeliveryOrder) => {
    setActionError(null);
    try {
      await OrderService.markDelivered(order.id, order.userId ?? '');
      // Stop live tracking / dismiss the notification immediately, without
      // waiting for the driver to tap OK on the success dialog.
      if (user) await LocationService.syncTrackingForDriver({ driverId: user.id });
      await UiService.showSuccessDialog({
        title: 'Order Delivered Successfully',
        message: `Order #${order.code} has been delivered.`,
      });
      void load();
    } catch (error) {
      setActionError(`Failed to mark as delivered: ${errorMessage(error)}`);
    }
  };

  if (loading) {
    return <DeliveryOrdersSkeleton variant="active" />;
  }

  return (
    <Screen padded={false} scroll={false}>
      <View style={styles.content}>
        {loadError && (
          <StatusWithRetry
            style={styles.statusBlock}
            title="Could not load active orders"
            message={loadError}
            onRetry={() => void load()}
          />
        )}

        {actionError && (
          <View style={styles.statusBlock}>
            <StatusMessage
              variant="error"
              title="Could not update order"
              message={actionError}
              onDismiss={() => setActionError(null)}
            />
          </View>
        )}

        {orders.length === 0 ? (
          <EmptyState
            title="No active orders"
            message="Orders you accept will appear here."
            icon={<MaterialCommunityIcons name="bike" size={64} color={colors.textMuted} />}
            action={
              <Button
                variant="outline"
                icon={<MaterialCommunityIcons name="refresh" size={18} color={colors.secondary} />}
                title="REFRESH"
                onPress={() => void load()}
              />
            }
          />
        ) : (
          <View style={styles.cards}>
            {orders.map((order) => {
              const isAssigned = order.status === 'driver_assigned';
              const isOutForDelivery = order.status === 'out_for_delivery';
              const isArrived = order.status === 'arrived';
              const isPickedUp = isOutForDelivery || isArrived;
              const color = OrderStatusX.color(order.status);
              const label = isArrived ? 'ARRIVED' : isOutForDelivery ? 'EN ROUTE' : 'DRIVER ASSIGNED';

              return (
                <OrderCard
                  key={order.id}
                  order={order}
                  headerLabel={label}
                  headerColor={color}
                  headerIcon={OrderStatusX.icon(order.status)}
                  onPress={() => router.push(`/home/orders/${order.id}`)}
                >
                  <OrderRoute
                    order={order}
                    pickupDone={isPickedUp}
                    pickupCompleted={isPickedUp}
                    dropoffActive={isPickedUp}
                  />
                  {order.items != null && order.items.length > 0 && (
                    <OrderItemsRow order={order} showTotal={false} />
                  )}
                  <View style={styles.footer}>
                    <View style={styles.actionRow}>
                      <Button
                        variant="outline"
                        icon={<MaterialCommunityIcons name="navigation" size={18} color={colors.secondary} />}
                        title="NAV"
                        onPress={() => launchMaps(isPickedUp ? order.dropoffAddress : order.pickupAddress)}
                      />
                      <Button
                        variant="outline"
                        icon={<MaterialCommunityIcons name="help-circle-outline" size={18} color={colors.secondary} />}
                        title="INFO"
                        onPress={() => router.push(`/home/orders/${order.id}`)}
                      />
                    </View>

                    {isAssigned && (
                      <View style={styles.cta}>
                        <Button variant="primary" block title="PICK UP" onPress={() => void pickUp(order)} />
                      </View>
                    )}
                    {isOutForDelivery && (
                      <View style={styles.cta}>
                        <Button
                          variant="primary"
                          block
                          style={{ backgroundColor: OrderStatusX.color('arrived') }}
                          title="MARK AS ARRIVED"
                          onPress={() => void markArrived(order)}
                        />
                      </View>
                    )}
                    {isArrived && (
                      <View style={styles.cta}>
                        <Button
                          variant="green"
                          block
                          title="MARK AS DELIVERED"
                          onPress={() => void markDelivered(order)}
                        />
                      </View>
                    )}
                  </View>
                </OrderCard>
              );
            })}
          </View>
        )}
      </View>
    </Screen>
  );
};
