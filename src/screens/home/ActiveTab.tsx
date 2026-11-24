import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bike, CircleHelp, Navigation, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StatusMessage } from '../../components/ui/StatusMessage';
import { Spinner } from '../../components/ui/Spinner';
import { errorMessage } from '../../lib/errors';
import { OrderCard, OrderItemsRow, OrderRoute } from '../../components/OrderCard';
import type { DeliveryOrder } from '../../models/deliveryOrder';
import { OrderStatusX } from '../../models/statuses';
import { BackgroundLocationService } from '../../services/backgroundLocationService';
import { DriverService } from '../../services/driverService';
import { LocationService } from '../../services/locationService';
import { OrderService } from '../../services/orderService';
import { UiService } from '../../services/uiService';
import { useAuthStore } from '../../stores/authStore';

/** Web equivalent of `MapsLauncher.launchQuery`. */
const launchMaps = (query: string): void => {
  window.open(
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
    '_blank',
    'noopener,noreferrer',
  );
};

/** Port of lib/screens/home/tabs/active_tab.dart. */
export const ActiveTab = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setActionError(null);
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      // Flutter loads the profile alongside the orders so the details screen
      // can be opened with it; our details route loads it itself, but the
      // query is kept so the same freshness checks run on every refresh.
      const [fetched] = await Promise.all([
        OrderService.fetchMyActiveOrders({ driverId: user.id }),
        DriverService.getDriverProfile(user.id),
      ]);
      setOrders(fetched);
      setLoading(false);
      await LocationService.syncTrackingOrderIds({
        driverId: user.id,
        orderIds: fetched.map((order) => order.id),
      });
    } catch (error) {
      setLoading(false);
      setLoadError(`Failed to load: ${errorMessage(error)}`);
    }
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
          title="Could not load active orders"
          message={loadError}
          onRetry={() => void load()}
        />
      )}

      {actionError && (
        <StatusMessage
          variant="error"
          title="Could not update order"
          message={actionError}
          onDismiss={() => setActionError(null)}
        />
      )}

      {orders.length === 0 ? (
        <div className="empty" style={{ minHeight: '65vh' }}>
          <div className="empty__icon">
            <Bike size={64} />
          </div>
          <div className="empty__title">No active orders</div>
          <p className="empty__text">Orders you accept will appear here.</p>
          <Button variant="outline" icon={<RefreshCw size={18} />} className="mt-32" onClick={() => void load()}>
            REFRESH
          </Button>
        </div>
      ) : (
        <div className="stack" style={{ padding: '0 16px' }}>
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
                onOpen={() => navigate(`/home/orders/${order.id}`)}
              >
                <OrderRoute
                  order={order}
                  pickupDone={isPickedUp}
                  pickupCompleted={isPickedUp}
                  dropoffActive={isPickedUp}
                />
                {order.items != null && order.items.length > 0 && <OrderItemsRow order={order} showTotal={false} />}
                <div className="order-card__footer" style={{ paddingTop: 8 }}>
                  <div className="order-card__actions">
                    <Button
                      variant="outline"
                      icon={<Navigation size={18} />}
                      onClick={() => launchMaps(isPickedUp ? order.dropoffAddress : order.pickupAddress)}
                    >
                      NAV
                    </Button>
                    <Button
                      variant="outline"
                      icon={<CircleHelp size={18} />}
                      onClick={() => navigate(`/home/orders/${order.id}`)}
                    >
                      INFO
                    </Button>
                  </div>

                  {isAssigned && (
                    <Button variant="primary" block className="mt-12" style={{ minHeight: 50 }} onClick={() => void pickUp(order)}>
                      PICK UP
                    </Button>
                  )}
                  {isOutForDelivery && (
                    <Button
                      variant="primary"
                      block
                      className="mt-12"
                      style={{ minHeight: 50, background: OrderStatusX.color('arrived') }}
                      onClick={() => void markArrived(order)}
                    >
                      MARK AS ARRIVED
                    </Button>
                  )}
                  {isArrived && (
                    <Button variant="green" block className="mt-12" style={{ minHeight: 50 }} onClick={() => void markDelivered(order)}>
                      MARK AS DELIVERED
                    </Button>
                  )}
                </div>
              </OrderCard>
            );
          })}
        </div>
      )}
    </div>
  );
};
