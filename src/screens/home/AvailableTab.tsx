import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { DeliveryEmptyState } from '../../components/DeliveryEmptyState';
import { OrderCard, OrderItemsRow, OrderRoute } from '../../components/OrderCard';
import { Screen } from '../../components/Screen';
import { DeliveryOrdersSkeleton } from '../../components/Skeleton';
import { StatusMessage } from '../../components/StatusMessage';
import { errorMessage } from '../../lib/errors';
import type { DeliveryOrder } from '../../models/deliveryOrder';
import type { Driver } from '../../models/driver';
import { OrderStatusX } from '../../models/statuses';
import { DriverService } from '../../services/driverService';
import { LOCATION_SETTINGS_HELP, LocationService } from '../../services/locationService';
import { NotificationInboxService } from '../../services/notificationInboxService';
import { OrderService } from '../../services/orderService';
import { UiService } from '../../services/uiService';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

type StatusVariant = 'error' | 'warning' | 'info' | 'success';

const greetingForHour = (hour: number): string => {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const firstNameOf = (fullName: string | null | undefined): string => {
  const name = fullName?.trim() || 'Driver';
  return name.split(/\s+/)[0] || 'Driver';
};

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, paddingBottom: 16 },
  greeting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  greetingText: { flex: 1 },
  greetingTitle: { fontWeight: '800' },
  greetingSubtitle: { marginTop: 3 },
  greetingMeta: { alignItems: 'flex-end', gap: 6 },
  statusBlock: { marginBottom: 12 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  bannerText: { flex: 1, ...typography.bodySmall },
  cards: { paddingHorizontal: 16 },
  cardFooter: { paddingTop: 12 },
});

const StatusWithRetry = ({
  variant,
  title,
  message,
  retryLabel = 'Try again',
  onRetry,
  onDismiss,
  style,
}: {
  variant: StatusVariant;
  title?: string;
  message: string;
  retryLabel?: string;
  onRetry: () => void;
  onDismiss?: () => void;
  style?: object;
}) => (
  <View style={style}>
    <StatusMessage variant={variant} title={title ?? ''} message={message} onDismiss={onDismiss} />
    <Button variant="outline" size="sm" title={retryLabel} onPress={onRetry} />
  </View>
);

/** Port of lib/screens/home/tabs/available_tab.dart. */
export const AvailableTab = () => {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // null = unknown (checking). The banner must never flash while the passive
  // permission probe is still in flight.
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [locationHelpVisible, setLocationHelpVisible] = useState(false);
  const [locationRequestError, setLocationRequestError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const checkLocationPermission = useCallback(async () => {
    try {
      const granted = await LocationService.hasPermission();
      if (alive.current) setHasLocationPermission(granted);
    } catch (error) {
      // A permission probe failure must not hide the orders list.
      console.debug('[available] Location permission check failed:', error);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Orders own this screen's loading state. The profile only controls the
      // verification banner, so it must never block or fail the list.
      const fetched = await OrderService.fetchAvailableOrders();
      if (!alive.current) return;
      setOrders(fetched);
    } catch (error) {
      if (alive.current) setLoadError(`Error loading: ${errorMessage(error)}`);
    } finally {
      if (alive.current) setLoading(false);
    }

    // Best-effort enrichment, deliberately after the list is visible.
    if (user) {
      void DriverService.getDriverProfile(user.id)
        .then((profile) => {
          if (alive.current) setDriver(profile);
        })
        .catch((error) => {
          console.debug('[available] Driver profile check failed:', error);
          if (alive.current) setDriver(null);
        });
    }
    void checkLocationPermission();
  }, [checkLocationPermission, user]);

  useEffect(() => {
    void checkLocationPermission();
    void load();
  }, [checkLocationPermission, load]);

  const requestLocation = async () => {
    setLocationRequestError(null);
    try {
      const granted = await LocationService.requestPermission();
      await checkLocationPermission();
      if (granted) {
        setLocationHelpVisible(false);
        void load();
      } else if (await LocationService.isPermissionDeniedForever()) {
        setLocationHelpVisible(true);
      } else {
        setLocationRequestError(
          `Location access was not granted to see nearby orders. ${LOCATION_SETTINGS_HELP}`,
        );
      }
    } catch (error) {
      setLocationRequestError(`Could not check location permission: ${errorMessage(error)}`);
    }
  };

  const acceptOrder = async (order: DeliveryOrder) => {
    if (!user || acceptingOrderId) return;
    setActionError(null);
    setAcceptingOrderId(order.id);
    try {
      await OrderService.acceptOrder({
        orderId: order.id,
        driverId: user.id,
        customerId: order.userId ?? '',
      });
      await NotificationInboxService.markOrderOffersRead(order.id);
      await UiService.showSuccess('Order accepted. It is now in your Active list.');
      router.replace('/home/active');
    } catch (error) {
      setActionError(`Failed to accept order: ${errorMessage(error)}`);
    } finally {
      setAcceptingOrderId(null);
    }
  };

  const isVerified = driver?.isVerified ?? false;
  const isOnline = driver?.driverStatus === 'online';
  const statusColor = OrderStatusX.color('ready_for_pickup');
  const greetingName = firstNameOf(
    driver?.fullName?.trim() || user?.email?.split('@')[0] || undefined,
  );
  const greetingTitle = `${greetingForHour(new Date().getHours())}, ${greetingName}`;

  let greetingSubtitle: string;
  let badgeLabel: string;
  let badgeTone: 'green' | 'orange' | 'gray';
  if (orders.length > 0) {
    greetingSubtitle = 'Review the pickup details and accept before the offer expires.';
    badgeLabel = `${orders.length} ${orders.length === 1 ? 'OFFER' : 'OFFERS'}`;
    badgeTone = 'green';
  } else if (!driver) {
    greetingSubtitle = 'Checking your driver status...';
    badgeLabel = 'CHECKING';
    badgeTone = 'gray';
  } else if (!isVerified) {
    greetingSubtitle = 'Verification is pending. You can browse, but accepting stays locked.';
    badgeLabel = 'PENDING';
    badgeTone = 'orange';
  } else if (isOnline) {
    greetingSubtitle = "You're online. New pickup requests will appear here automatically.";
    badgeLabel = 'READY';
    badgeTone = 'green';
  } else {
    greetingSubtitle = 'Turn on availability in Profile to start receiving offers.';
    badgeLabel = 'OFFLINE';
    badgeTone = 'gray';
  }

  if (loading) {
    return <DeliveryOrdersSkeleton variant="available" />;
  }

  return (
    <Screen padded={false} scroll={false}>
      <View style={styles.content}>
        <View style={styles.greeting}>
          <Avatar
            name={driver?.fullName ?? user?.email ?? greetingName}
            uri={driver?.imageUrl}
            size={44}
          />
          <View style={styles.greetingText}>
            <Text style={[typography.titleLarge, styles.greetingTitle, { color: colors.text }]}>
              {greetingTitle}
            </Text>
            <Text
              style={[typography.bodySmall, styles.greetingSubtitle, { color: colors.textMuted }]}
            >
              {greetingSubtitle}
            </Text>
          </View>
          <View style={styles.greetingMeta}>
            <Badge label={badgeLabel} tone={badgeTone} />
          </View>
        </View>

        {loadError && (
          <StatusWithRetry
            style={styles.statusBlock}
            variant="error"
            title="Could not load orders"
            message={loadError}
            onRetry={() => void load()}
          />
        )}

        {actionError && (
          <View style={styles.statusBlock}>
            <StatusMessage
              variant="error"
              title="Could not accept order"
              message={actionError}
              onDismiss={() => setActionError(null)}
            />
          </View>
        )}

        {hasLocationPermission === false && (
          <View style={[styles.banner, { backgroundColor: colors.primaryContainer }]}>
            <MaterialCommunityIcons name="map-marker-off" size={20} color={colors.primary} />
            <Text style={[styles.bannerText, { color: colors.primary, fontWeight: '600' }]}>
              Enable location to see nearby orders
            </Text>
            <Button
              variant="ghost"
              size="sm"
              title="ENABLE"
              onPress={() => void requestLocation()}
            />
          </View>
        )}

        {locationHelpVisible && (
          <StatusWithRetry
            style={styles.statusBlock}
            variant="warning"
            title="Location Permission Required"
            message={`To see nearby orders, please enable location permissions in your app settings. ${LOCATION_SETTINGS_HELP}`}
            onRetry={() => void requestLocation()}
            onDismiss={() => setLocationHelpVisible(false)}
          />
        )}

        {locationRequestError && (
          <StatusWithRetry
            style={styles.statusBlock}
            variant="error"
            title="Location unavailable"
            message={locationRequestError}
            onRetry={() => void requestLocation()}
          />
        )}

        {!isVerified && (
          <View style={[styles.banner, { backgroundColor: colors.errorContainer }]}>
            <MaterialCommunityIcons name="alert-outline" size={20} color={colors.warning} />
            <Text style={[styles.bannerText, { fontWeight: '600' }]}>
              Verification Pending. You cannot accept orders until an admin verifies your profile.
            </Text>
          </View>
        )}

        {orders.length === 0 ? (
          <DeliveryEmptyState
            icon={<MaterialCommunityIcons name="bicycle" size={44} color={colors.primary} />}
            title="No orders nearby"
            tips={[
              {
                icon: <MaterialCommunityIcons name="map-marker-radius-outline" size={18} color={colors.primary} />,
                text: 'Keep location enabled so we can match you with nearby stores.',
              },
              {
                icon: <MaterialCommunityIcons name="clock-outline" size={18} color={colors.primary} />,
                text: 'Offers last 30 seconds — accept quickly when one appears.',
              },
            ]}
            action={
              <Button
                variant="primary"
                block
                icon={<MaterialCommunityIcons name="refresh" size={18} color={colors.onPrimary} />}
                title="REFRESH ORDERS"
                onPress={() => void load()}
              />
            }
          />
        ) : (
          <View style={styles.cards}>
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                headerLabel="READY FOR PICKUP"
                headerColor={statusColor}
                headerIcon={OrderStatusX.icon('ready_for_pickup')}
                onPress={() => router.push(`/home/orders/${order.id}`)}
              >
                <OrderRoute order={order} />
                {order.items != null && order.items.length > 0 && <OrderItemsRow order={order} />}
                <View style={styles.cardFooter}>
                  <Button
                    variant="primary"
                    block
                    loading={acceptingOrderId === order.id}
                    disabled={!isVerified || acceptingOrderId != null}
                    style={{ backgroundColor: statusColor, minHeight: 50 }}
                    title={acceptingOrderId === order.id ? 'ACCEPTING...' : 'ACCEPT ORDER'}
                    onPress={() => void acceptOrder(order)}
                  />
                </View>
              </OrderCard>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
};
