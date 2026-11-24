import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes, LocateOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StatusMessage } from '../../components/ui/StatusMessage';
import { errorMessage } from '../../lib/errors';
import { Spinner } from '../../components/ui/Spinner';
import { OrderCard, OrderItemsRow, OrderRoute } from '../../components/OrderCard';
import type { DeliveryOrder } from '../../models/deliveryOrder';
import type { Driver } from '../../models/driver';
import { OrderStatusX } from '../../models/statuses';
import { DriverService } from '../../services/driverService';
import {
  LOCATION_SETTINGS_HELP,
  LocationService,
} from '../../services/locationService';
import { OrderService } from '../../services/orderService';
import { useAuthStore } from '../../stores/authStore';

/** Port of lib/screens/home/tabs/available_tab.dart. */
export const AvailableTab = () => {
  const navigate = useNavigate();
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
          'Location access was not granted. Enable it in your browser settings to see nearby orders.',
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
      <div className="loading-screen">
        <Spinner />
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 16 }}>
      {loadError && (
        <StatusMessage
          variant="error"
          title="Could not load orders"
          message={loadError}
          onRetry={() => void load()}
        />
      )}

      {hasLocationPermission === false && (
        <div className="info-banner" style={{ background: 'var(--primary-soft-2)' }}>
          <LocateOff size={20} className="text-primary" />
          <span className="grow text-primary text-sm" style={{ fontWeight: 600 }}>
            Enable location to see nearby orders
          </span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => void requestLocation()}>
            ENABLE
          </button>
        </div>
      )}

      {locationHelpVisible && (
        <StatusMessage
          variant="warning"
          title="Location Permission Required"
          message={`To see nearby orders, please enable location permissions in your app settings. ${LOCATION_SETTINGS_HELP}`}
          onRetry={() => void requestLocation()}
          retryLabel="Try again"
          onDismiss={() => setLocationHelpVisible(false)}
        />
      )}

      {locationRequestError && (
        <StatusMessage
          variant="error"
          title="Location unavailable"
          message={locationRequestError}
          onRetry={() => void requestLocation()}
        />
      )}

      {!isVerified && (
        <div className="info-banner info-banner--orange">
          <TriangleAlert size={20} />
          <span className="grow text-sm" style={{ fontWeight: 600 }}>
            Verification Pending. You cannot accept orders until an admin verifies your profile.
          </span>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="empty" style={{ minHeight: '55vh' }}>
          <div className="empty__icon">
            <Boxes size={64} />
          </div>
          <div className="empty__title">No available orders</div>
          <p className="empty__text">Orders will appear here for you to accept.</p>
          <Button variant="outline" icon={<RefreshCw size={18} />} className="mt-32" onClick={() => void load()}>
            REFRESH
          </Button>
        </div>
      ) : (
        <div className="stack" style={{ padding: '0 16px' }}>
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              headerLabel="READY FOR PICKUP"
              headerColor={statusColor}
              headerIcon={OrderStatusX.icon('ready_for_pickup')}
              onOpen={() => navigate(`/home/orders/${order.id}`)}
            >
              <OrderRoute order={order} />
              {order.items != null && order.items.length > 0 && <OrderItemsRow order={order} />}
              <div className="order-card__footer">
                <Button
                  variant="primary"
                  block
                  disabled={!isVerified}
                  style={{ background: statusColor, minHeight: 50, letterSpacing: '0.08em' }}
                  onClick={() => navigate(`/home/orders/${order.id}`)}
                >
                  ACCEPT ORDER
                </Button>
              </div>
            </OrderCard>
          ))}
        </div>
      )}
    </div>
  );
};
