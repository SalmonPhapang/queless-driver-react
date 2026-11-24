import type { ReactNode } from 'react';
import { Check, MapPin, ShoppingBag, Store } from 'lucide-react';
import type { DeliveryOrder } from '../models/deliveryOrder';
import { DeliveryOrderModel } from '../models/deliveryOrder';
import { formatMoney } from '../lib/format';
import { cn } from '../lib/cn';
import { LocationInfoRow } from './LocationInfoRow';
import { StatusIcon } from './StatusIcon';

/** Port of the card shell shared by lib/screens/home/tabs/*.dart. */
interface OrderCardProps {
  order: DeliveryOrder;
  headerLabel: string;
  headerColor?: string;
  headerIcon?: string;
  onOpen: () => void;
  children: ReactNode;
}

export const OrderCard = ({
  order,
  headerLabel,
  headerColor = 'var(--primary)',
  headerIcon,
  onOpen,
  children,
}: OrderCardProps) => (
  // A div rather than a button: Flutter's GestureDetector wraps the card, but
  // the real buttons inside it still win the gesture arena. Nested <button>s
  // would bubble their clicks into this navigation handler.
  <div
    role="button"
    tabIndex={0}
    className="order-card"
    onClick={(event) => {
      // Flutter's inner buttons win the gesture arena; emulate that by
      // ignoring clicks that originated from one of them.
      if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return;
      onOpen();
    }}
    onKeyDown={(event) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onOpen();
      }
    }}
  >
    <div
      className="order-card__header"
      style={{ color: headerColor, background: `color-mix(in srgb, ${headerColor} 6%, transparent)` }}
    >
      {headerIcon ? (
        <span style={{ display: 'inline-flex', color: headerColor }}>
          <StatusIcon name={headerIcon} size={18} />
        </span>
      ) : (
        <Check size={18} color={headerColor} />
      )}
      {headerLabel}
      <span className="order-card__code">#{order.code}</span>
    </div>
    {children}
  </div>
);

/**
 * Route visualisation shared by the three tabs. `pickupDone` mirrors Flutter's
 * `isPickedUp`: the pickup dot becomes a check and the gradient reverses.
 */
interface OrderRouteProps {
  order: DeliveryOrder;
  pickupDone?: boolean;
  pickupCompleted?: boolean;
  dropoffActive?: boolean;
}

export const OrderRoute = ({
  order,
  pickupDone = false,
  pickupCompleted = false,
  dropoffActive = true,
}: OrderRouteProps) => (
  <div className="order-card__body">
    <div className="route-rail">
      <span className={cn('route-dot', pickupDone && 'route-dot--muted')}>
        {pickupDone ? <Check size={14} /> : <Store size={14} />}
      </span>
      <span className={cn('route-line', pickupDone && 'route-line--reversed')} />
      <span className={cn('route-dot', !pickupDone && 'route-dot--muted')}>
        <MapPin size={14} />
      </span>
    </div>
    <div className="grow">
      <LocationInfoRow
        label={order.store?.name?.toUpperCase() ?? 'STORE'}
        address={order.pickupAddress}
        completed={pickupCompleted}
      />
      <div style={{ height: 24 }} />
      <LocationInfoRow
        label={`${order.customerName.toUpperCase()} • ${order.customerPhone}`}
        address={order.dropoffAddress}
        inactive={!dropoffActive}
      />
    </div>
  </div>
);

/** "N items" row with the optional CASH badge and the order total. */
export const OrderItemsRow = ({
  order,
  showTotal = true,
  showCash = true,
}: {
  order: DeliveryOrder;
  showTotal?: boolean;
  showCash?: boolean;
}) => {
  const isCash =
    order.paymentMethod?.toLowerCase().includes('cash') === true ||
    order.paymentMethod?.toLowerCase().includes('cod') === true;

  return (
    <div className="order-card__meta">
      <ShoppingBag size={14} />
      {order.items?.length ?? 0} items
      {showCash && isCash && <span className="badge badge--orange">CASH</span>}
      {showTotal && (
        <strong className="grow" style={{ textAlign: 'right', color: 'var(--text)', fontSize: 14 }}>
          {formatMoney(DeliveryOrderModel.baseTotal(order))}
        </strong>
      )}
    </div>
  );
};
