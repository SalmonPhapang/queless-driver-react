import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { errorMessage } from '../../lib/errors';
import { Spinner } from '../../components/ui/Spinner';
import { OrderCard, OrderRoute } from '../../components/OrderCard';
import type { DeliveryOrder } from '../../models/deliveryOrder';
import { DeliveryOrderModel } from '../../models/deliveryOrder';
import { OrderStatusX } from '../../models/statuses';
import { DriverService } from '../../services/driverService';
import { OrderService } from '../../services/orderService';
import { UiService } from '../../services/uiService';
import { useAuthStore } from '../../stores/authStore';
import { EmptyHistoryIllustration } from './EmptyHistoryIllustration';

/** Port of lib/screens/home/tabs/history_tab.dart. */
export const HistoryTab = () => {
  const navigate = useNavigate();
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
    return (
      <div className="loading-screen">
        <Spinner />
      </div>
    );
  }

  if (orders.length === 0) {
    return <EmptyHistoryIllustration onRefresh={() => void load()} />;
  }

  const successColor = OrderStatusX.color('delivered');

  return (
    <div style={{ paddingBottom: 16 }}>
      <h2 className="section-title" style={{ padding: '0 16px 12px' }}>Order History</h2>
      <div className="stack" style={{ padding: '0 16px' }}>
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            headerLabel="DELIVERED"
            headerColor={successColor}
            headerIcon={OrderStatusX.icon('delivered')}
            onOpen={() => navigate(`/home/orders/${order.id}`)}
          >
            <OrderRoute order={order} pickupDone pickupCompleted dropoffActive />
            <div className="order-card__meta">
              <ShoppingBag size={14} />
              {order.items?.length ?? 0} items
              <strong className="grow" style={{ textAlign: 'right', color: 'var(--text)', fontSize: 14 }}>
                R{DeliveryOrderModel.baseTotal(order).toFixed(2)}
              </strong>
            </div>
          </OrderCard>
        ))}
      </div>
    </div>
  );
};
