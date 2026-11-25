import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { OrderCard, OrderItemsRow, OrderRoute } from '../../components/OrderCard';
import { Screen } from '../../components/Screen';
import { Spinner } from '../../components/Spinner';
import { StatusMessage } from '../../components/StatusMessage';
import { errorMessage } from '../../lib/errors';
import type { DeliveryOrder } from '../../models/deliveryOrder';
import type { Driver } from '../../models/driver';
import { OrderStatusX } from '../../models/statuses';
import { DriverService } from '../../services/driverService';
import { LOCATION_SETTINGS_HELP, LocationService } from '../../services/locationService';
import { OrderService } from '../../services/orderService';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

type StatusVariant = 'error' | 'warning' | 'info' | 'success';

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: 16 },
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
  // null = unknown (checking). The banner must never flash while the passive
  // permission probe is still in flight.
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [locationHelpVisible, setLocationHelpVisible] = useState(false);
  const [locationRequestError, setLocationRequestError] = useState<string | null>(null);

  const checkLocationPermission = useCallback(async () => {
    setHasLocationPermission(await LocationService.hasPermission());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [fetched, profile] = await Promise.all([
        OrderService.fetchAvailableOrders(),
        user ? DriverService.getDriverProfile(user.id) : Promise.resolve(null),
      ]);
      setOrders(fetched);
      setDriver(profile);
      // Orders are shown first; the passive check is deliberately un-awaited
      // and outside this try, exactly like Flutter's `_load`.
      void checkLocationPermission();
    } catch (error) {
      setLoadError(`Error loading: ${errorMessage(error)}`);
    } finally {
      setLoading(false);
    }
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

  const isVerified = driver?.isVerified ?? false;
  const statusColor = OrderStatusX.color('ready_for_pickup');

  if (loading) {
    return (
      <Screen padded={false} scroll={false}>
        <View style={styles.centered}>
          <Spinner />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} scroll={false}>
      <View style={styles.content}>
        {loadError && (
          <StatusWithRetry
            style={styles.statusBlock}
            variant="error"
            title="Could not load orders"
            message={loadError}
            onRetry={() => void load()}
          />
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
          <EmptyState
            title="No available orders"
            message="Orders will appear here for you to accept."
            icon={<MaterialCommunityIcons name="package-variant-closed" size={64} color={colors.textMuted} />}
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
                    disabled={!isVerified}
                    style={{ backgroundColor: statusColor, minHeight: 50 }}
                    title="ACCEPT ORDER"
                    onPress={() => router.push(`/home/orders/${order.id}`)}
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
