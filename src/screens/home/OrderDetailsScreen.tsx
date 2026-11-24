import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Check, MapPin, Phone, ShoppingBag, Store, UserRound } from 'lucide-react';
import { AppBar } from '../../components/ui/AppBar';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { SelectField, TextField } from '../../components/ui/Field';
import { Spinner } from '../../components/ui/Spinner';
import { StatusMessage } from '../../components/ui/StatusMessage';
import { StatusIcon } from '../../components/StatusIcon';
import { SupabaseConfig } from '../../config/supabaseClient';
import { cn } from '../../lib/cn';
import { errorMessage } from '../../lib/errors';
import { formatMoney, formatTime } from '../../lib/format';
import { DeliveryOrderModel, type DeliveryOrder } from '../../models/deliveryOrder';
import type { Driver } from '../../models/driver';
import { DriverAssignment } from '../../models/driverAssignment';
import type { DriverAssignmentModel } from '../../models/driverAssignment';
import { ORDER_STATUSES, OrderStatusX, type OrderStatus } from '../../models/statuses';
import { BackgroundLocationService } from '../../services/backgroundLocationService';
import { DriverService } from '../../services/driverService';
import { LocationService } from '../../services/locationService';
import { OrderService } from '../../services/orderService';
import { UiService } from '../../services/uiService';
import { useAuthStore } from '../../stores/authStore';
import './order-details.css';

const requiresPaymentDetails = (method?: string | null): boolean => {
  if (!method) return false;
  const value = method.toLowerCase();
  return value.includes('cash') || value.includes('speed point') || value.includes('card machine');
};

const requiresReceiptNumber = (method?: string | null): boolean => {
  if (!method) return false;
  const value = method.toLowerCase();
  return value.includes('speed point') || value.includes('card machine');
};

const SectionTitle = ({ children }: { children: ReactNode }) => <h3 className="section-title">{children}</h3>;

const InfoCard = ({
  icon,
  title,
  subtitle,
  trailing,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string | null;
  trailing?: ReactNode;
}) => (
  <div className="card card--flat">
    <span className="info-card__icon">{icon}</span>
    <div className="grow">
      <div className="info-card__title">{title}</div>
      {subtitle != null && <div className="info-card__subtitle">{subtitle}</div>}
    </div>
    {trailing}
  </div>
);

const SummaryRow = ({
  label,
  value,
  bold = false,
  negative = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
  negative?: boolean;
}) => (
  <div className={cn('summary-row', bold && 'summary-row--bold', negative && 'summary-row--negative')}>
    <span>{label}</span>
    <span className="summary-row__value">{value}</span>
  </div>
);

/** Flutter's fallback steps when the order has no detailed tracking updates. */
const TrackingTimeline = ({ order }: { order: DeliveryOrder }) => {
  const updates = order.trackingUpdates ?? [];

  if (updates.length === 0) {
    const steps = [
      { label: 'Order Placed', isDone: true },
      {
        label: 'Driver Assigned',
        isDone: order.status !== 'pending' && order.status !== 'preparing',
      },
      {
        label: 'Picked Up',
        isDone: ['out_for_delivery', 'arrived', 'delivered'].includes(order.status),
      },
      { label: 'Arrived', isDone: ['arrived', 'delivered'].includes(order.status) },
      { label: 'Delivered', isDone: order.status === 'delivered' },
    ];
    return (
      <div className="timeline">
        {steps.map((step, index) => (
          <div className="timeline__step" key={step.label}>
            <div className="timeline__rail">
              <span className={cn('timeline__dot', step.isDone && 'timeline__dot--done')}>
                {step.isDone && <Check size={12} />}
              </span>
              {index < steps.length - 1 && (
                <span className={cn('timeline__line', step.isDone && 'timeline__line--done')} />
              )}
            </div>
            <div className="timeline__content">
              <span className={cn('timeline__label', !step.isDone && 'timeline__label--muted')}>
                {step.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="timeline">
      {updates.map((raw, index) => {
        const update = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
        const status = update.status != null ? String(update.status).toUpperCase() : 'UPDATE';
        const message = update.message != null ? String(update.message) : '';
        const parsed = new Date(String(update.timestamp ?? ''));
        const timestamp = Number.isNaN(parsed.getTime()) ? null : parsed;
        return (
          <div className="timeline__step" key={`${status}-${index}`}>
            <div className="timeline__rail">
              <span className="timeline__dot timeline__dot--done">
                <Check size={12} />
              </span>
              {index < updates.length - 1 && <span className="timeline__line timeline__line--done" />}
            </div>
            <div className="timeline__content">
              <div className="row-between">
                <span className="timeline__label text-primary">{status}</span>
                {timestamp && <span className="timeline__meta">{formatTime(timestamp)}</span>}
              </div>
              <p className="timeline__message">{message}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** Structured-address formatter carried over from `_buildAddressCard`. */
const fullAddress = (order: DeliveryOrder): string => {
  const data = order.deliveryAddress;
  const str = (value: unknown): string | undefined => (value == null ? undefined : String(value));
  const street = data ? str(data.street_address) ?? str(data.street) ?? str(data.line1) ?? str(data.address_line1) : undefined;
  const province = data ? str(data.province) ?? str(data.state) : undefined;
  const postal = data ? str(data.postal_code) ?? str(data.zip_code) ?? str(data.postcode) : undefined;
  const parts = [street, province, postal].filter((part): part is string => !!part && part.length > 0);
  if (parts.length > 0) return parts.join(', ');
  return (
    (data ? str(data.address) ?? str(data.formatted_address) ?? str(data.full_address) : undefined) ??
    order.dropoffAddress ??
    'Address not provided'
  );
};

/** Port of lib/screens/home/order_details_screen.dart. */
export const OrderDetailsScreen = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // Flutter's inbox deep link constructs details with `isVerified: true` and
  // `driver: null`, so carry that intent in route state.
  const fromNotification =
    (location.state as { fromNotification?: boolean } | null)?.fromNotification === true;
  // A cold-start deep link has no previous route to pop to.
  const goBack = () => {
    if (location.key === 'default') navigate('/home/available', { replace: true });
    else navigate(-1);
  };
  const user = useAuthStore((state) => state.user);
  const [order, setOrder] = useState<DeliveryOrder | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [openOffer, setOpenOffer] = useState<DriverAssignmentModel | null>(null);
  const [, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [amount, setAmount] = useState('');
  const [receipt, setReceipt] = useState('');
  const paymentResolver = useRef<((confirmed: boolean) => void) | null>(null);

  const refreshOffer = useCallback(async () => {
    if (!user || !orderId) return;
    try {
      setOpenOffer(await OrderService.findOpenOffer({ orderId, driverId: user.id }));
      setOfferError(null);
    } catch (error) {
      // Silent failure would leave the accept/decline UI in a stale state.
      setOfferError(`Could not refresh the dispatch offer: ${errorMessage(error)}`);
    }
  }, [orderId, user]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!orderId) return;
      setLoading(true);
      try {
        const [fetched, profile] = await Promise.all([
          OrderService.fetchOrderById(orderId),
          user && !fromNotification
            ? DriverService.getDriverProfile(user.id)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setOrder(fetched);
        setDriver(profile);
        setLoadError(null);
      } catch (error) {
        if (!cancelled) setLoadError(errorMessage(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromNotification, orderId, user]);

  // A stale/deep-linked notification row silently returns to the inbox in
  // Flutter; it never shows a standalone "Order not found" screen.
  useEffect(() => {
    if (fromNotification && !loading && !order) goBack();
  }, [fromNotification, goBack, loading, order]);

  // Live order rows + live assignment rows, mirroring both streams in Dart.
  useEffect(() => {
    if (!orderId) return;
    const channel = SupabaseConfig.client
      .channel(`order-details-${orderId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown> | null;
          if (row && typeof row === 'object' && Object.keys(row).length > 0) {
            setOrder(DeliveryOrderModel.fromJson(row));
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_assignments', filter: `order_id=eq.${orderId}` },
        () => void refreshOffer(),
      )
      .subscribe();
    void refreshOffer();
    return () => {
      void SupabaseConfig.client.removeChannel(channel);
    };
  }, [orderId, refreshOffer]);

  // One-second countdown repaint, driven by the server's offer deadline.
  useEffect(() => {
    if (!openOffer) return;
    const timer = window.setInterval(() => {
      if (!DriverAssignment.canRespondToOffer(openOffer)) {
        setOpenOffer(null);
        setOfferError('The dispatch offer expired.');
        return;
      }
      setTick((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [openOffer]);

  const syncTracking = async () => {
    if (user) await LocationService.syncTrackingForDriver({ driverId: user.id });
  };

  const adminUpdateStatus = async (newStatus: OrderStatus, message?: string) => {
    if (!order) return;
    setActionError(null);
    setBusy(true);
    try {
      await OrderService.updateOrderStatus({
        orderId: order.id,
        newStatus,
        message: message ?? `Admin updated order status to ${OrderStatusX.displayName(newStatus)}`,
      });
      await syncTracking();
      UiService.showSuccess(`Order status updated to: ${OrderStatusX.displayName(newStatus)}`);
      goBack();
    } catch (error) {
      setActionError(`Failed to update status: ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelivery = (): Promise<boolean> => {
    if (order) setAmount(order.total?.toFixed(2) ?? '');
    // Flutter keeps the previous receipt text between dialog openings.
    setPaymentDialog(true);
    return new Promise((resolve) => {
      paymentResolver.current = resolve;
    });
  };

  const updateStatus = async (action: 'accept' | 'pickup' | 'deliver') => {
    if (!user || !order) return;
    let amountReceived: number | undefined;
    let receiptNumber: string | undefined;

    if (action === 'deliver' && requiresPaymentDetails(order.paymentMethod)) {
      const confirmed = await confirmDelivery();
      if (!confirmed) return;
      const parsed = Number(amount.replace(',', '.'));
      amountReceived = Number.isFinite(parsed) ? parsed : undefined;
      receiptNumber = receipt.trim() || undefined;
    }

    setActionError(null);
    setBusy(true);
    try {
      const customerId = order.userId ?? '';
      if (action === 'accept') {
        await OrderService.acceptOrder({ orderId: order.id, driverId: user.id, customerId });
      } else if (action === 'pickup') {
        await OrderService.markPickedUp(order.id, customerId);
        // The foreground service keeps GPS publishing while the driver
        // navigates with Google Maps in the background.
        await BackgroundLocationService.start({ driverId: user.id, orderIds: [order.id] });
      } else if (action === 'deliver') {
        await OrderService.markDelivered(order.id, customerId, {
          amountReceived,
          receiptNumber,
        });
      }

      await syncTracking();

      if (action === 'deliver') {
        await UiService.showSuccessDialog({
          title: 'Order Delivered Successfully',
          message: `Order #${order.code} has been delivered.`,
        });
      } else {
        UiService.showSuccess(`Order status updated: ${action}`);
      }
      goBack();
    } catch (error) {
      setActionError(`Failed to update status: ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const declineOffer = async () => {
    if (!openOffer) return;
    setActionError(null);
    setBusy(true);
    try {
      await OrderService.declineDispatchOffer(openOffer.id);
      setOpenOffer(null);
      UiService.showSuccess('Offer declined.');
      goBack();
    } catch (error) {
      setActionError(OrderService.describeOfferError(error));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="app-frame">
        <div className="loading-screen">
          <Spinner />
        </div>
      </div>
    );
  }

  if (!order) {
    if (fromNotification) return null;
    return (
      <div className="app-frame">
        <div className="screen">
          <AppBar title="Order" back onBack={() => goBack()} />
          <div className="centered-screen">
            <h2 style={{ fontWeight: 800 }}>Order not found</h2>
            <p className="text-muted">{loadError ?? 'This order is no longer available.'}</p>
            <Button variant="outline" onClick={() => goBack()}>
              Go back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isPending = order.status === 'ready_for_pickup';
  const isAssigned = order.status === 'driver_assigned';
  const isPickedUp = order.status === 'out_for_delivery';
  const isDelivered = order.status === 'delivered';
  const isArrived = order.status === 'arrived';
  const isAdmin = driver?.roleType === 'admin';
  const isVerified = driver?.isVerified ?? true;
  const statusColor = OrderStatusX.color(order.status);
  const canAct = isPending ? isVerified || isAdmin : isAssigned || isPickedUp || isArrived;
  const remainingMs = openOffer ? DriverAssignment.offerRemaining(openOffer) ?? 0 : 0;
  const seconds = Math.max(0, Math.floor(remainingMs / 1000));
  const urgent = seconds <= 10;

  return (
    <div className="app-frame">
      <div className="screen">
        <AppBar title={`Order #${order.code}`} back onBack={() => goBack()} />
        <div className="screen-body">
          <div className="order-details-body">
            {offerError && (
              <StatusMessage
                variant="error"
                title="Offer status"
                message={offerError}
                onRetry={() => void refreshOffer()}
                onDismiss={() => setOfferError(null)}
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

            {/* Status card */}
            <div className="status-hero" style={{ background: `color-mix(in srgb, ${statusColor} 12%, transparent)`, borderColor: `color-mix(in srgb, ${statusColor} 25%, transparent)` }}>
              <span className="status-hero__icon" style={{ background: `color-mix(in srgb, ${statusColor} 22%, transparent)`, color: statusColor }}>
                <StatusIcon name={OrderStatusX.icon(order.status)} size={26} />
              </span>
              <div>
                <div className="status-hero__label" style={{ color: statusColor }}>STATUS</div>
                <div className="status-hero__value" style={{ color: statusColor }}>
                  {OrderStatusX.displayName(order.status).toUpperCase()}
                </div>
              </div>
            </div>

            {/* Admin controls */}
            {isAdmin && (
              <>
                <SectionTitle>ADMIN CONTROLS</SectionTitle>
                <div className="card card--padded">
                  <div className="section-title">Change Order Status</div>
                  <div className="mt-12">
                    <SelectField
                      label=""
                      value={selectedStatus}
                      placeholder="Select new status"
                      onChange={setSelectedStatus}
                      options={ORDER_STATUSES.map((status) => ({
                        value: status,
                        label: OrderStatusX.displayName(status).toUpperCase(),
                      }))}
                    />
                  </div>
                  <Button
                    variant="primary"
                    block
                    loading={busy}
                    disabled={!selectedStatus}
                    className="mt-12"
                    style={{ background: '#FFC107', color: '#000' }}
                    onClick={() => void adminUpdateStatus(selectedStatus as OrderStatus)}
                  >
                    UPDATE STATUS
                  </Button>
                </div>
              </>
            )}

            {/* Tracking timeline — hidden once delivered */}
            {(isAssigned || isPickedUp || isArrived) && (
              <>
                <SectionTitle>TRACKING INFO</SectionTitle>
                <TrackingTimeline order={order} />
              </>
            )}

            <SectionTitle>STORE DETAILS</SectionTitle>
            <div className="stack-sm">
              <InfoCard
                icon={<Store size={20} />}
                title={order.store?.name ?? 'Store Name'}
                trailing={
                  order.store?.phone != null ? (
                    // TODO: Implement phone call (same placeholder as Flutter).
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Call store"
                      style={{ color: 'var(--success)' }}
                    >
                      <Phone size={20} />
                    </button>
                  ) : undefined
                }
              />
              <InfoCard
                icon={<MapPin size={20} />}
                title="Pickup Address"
                subtitle={order.store?.address ?? order.pickupAddress}
              />
            </div>

            <SectionTitle>CUSTOMER DETAILS</SectionTitle>
            <InfoCard
              icon={<UserRound size={20} />}
              title={
                order.customerName || order.customerPhone
                  ? `${order.customerName || 'Unknown'} • ${order.customerPhone || 'No number'}`
                  : 'Customer details not provided'
              }
              trailing={
                order.customerPhone ? (
                  // TODO: Implement phone call (same placeholder as Flutter).
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Call customer"
                    style={{ color: 'var(--success)' }}
                  >
                    <Phone size={20} />
                  </button>
                ) : undefined
              }
            />

            <SectionTitle>DELIVERY ADDRESS</SectionTitle>
            <InfoCard icon={<MapPin size={20} />} title="Destination" subtitle={fullAddress(order)} />

            <SectionTitle>ORDER ITEMS</SectionTitle>
            {order.items != null && order.items.length > 0 ? (
              <div className="card" style={{ padding: 0 }}>
                {order.items.map((raw, index) => {
                  const item = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
                  const qty = Number(item.quantity ?? 1);
                  const unit = Number(item.base_price_per_unit ?? 0);
                  const imageUrl = item.product_image_url != null ? String(item.product_image_url) : '';
                  return (
                    <div
                      className="list-item"
                      key={`${String(item.product_name ?? 'item')}-${index}`}
                      style={index > 0 ? { borderTop: '1px solid var(--border)' } : undefined}
                    >
                      {imageUrl ? (
                        <img src={imageUrl} alt="" className="list-item__icon" style={{ objectFit: 'cover', borderRadius: 8 }} />
                      ) : (
                        <span className="list-item__icon">
                          <ShoppingBag size={20} />
                        </span>
                      )}
                      <span className="grow">
                        <span className="list-item__title">{String(item.product_name ?? 'Unknown Item')}</span>
                        <span className="list-item__subtitle">{formatMoney(unit * qty)}</span>
                      </span>
                      <span className="text-muted text-sm">x{qty}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <InfoCard
                icon={<ShoppingBag size={20} />}
                title="No items"
                subtitle="No product information found for this order."
              />
            )}

            <SectionTitle>PAYMENT SUMMARY</SectionTitle>
            <div className="card card--padded">
              <SummaryRow label="Subtotal (Base)" value={formatMoney(DeliveryOrderModel.baseSubtotal(order))} />
              <div className="mt-8" />
              <SummaryRow label="Delivery Fee" value={formatMoney(order.deliveryFee ?? 0)} />
              {(order.discount ?? 0) > 0 && (
                <>
                  <div className="mt-8" />
                  <SummaryRow label="Discount" value={`-${formatMoney(order.discount ?? 0)}`} negative />
                </>
              )}
              <div className="divider" />
              <SummaryRow label="Total (Base)" value={formatMoney(DeliveryOrderModel.baseTotal(order))} bold />
            </div>
          </div>

          {!isDelivered && (
            <div className="order-details-actions">
              {openOffer && (
                <div className={`offer-banner${urgent ? ' offer-banner--urgent' : ''}`}>
                  <p className="offer-banner__text">
                    {seconds > 0 ? `Respond within ${seconds}s to keep this order` : 'Offer closing…'}
                  </p>
                  <Button variant="outline" block loading={busy} onClick={() => void declineOffer()}>
                    DECLINE OFFER
                  </Button>
                </div>
              )}

              {isPending && !isVerified && !isAdmin && (
                <p className="text-error text-sm" style={{ fontWeight: 700, textAlign: 'center' }}>
                  You must be verified to accept orders
                </p>
              )}

              <Button
                variant={isPickedUp ? 'green' : 'primary'}
                block
                loading={busy}
                disabled={!canAct}
                className="order-details-actions__cta"
                onClick={() => {
                  if (isPending) void updateStatus('accept');
                  else if (isAssigned) void updateStatus('pickup');
                  else if (isPickedUp)
                    void adminUpdateStatus('arrived', 'Driver arrived at delivery location');
                  else if (isArrived) void updateStatus('deliver');
                }}
              >
                {isPending
                  ? 'ACCEPT ORDER'
                  : isAssigned
                    ? 'MARK AS PICKED UP'
                    : isPickedUp
                      ? 'MARK AS ARRIVED'
                      : isArrived
                        ? 'MARK AS DELIVERED'
                        : 'CLOSE'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {paymentDialog && (
        <Modal
          title="Confirm Delivery"
          dismissible={false}
          onClose={() => {
            paymentResolver.current?.(false);
            paymentResolver.current = null;
            setPaymentDialog(false);
          }}
          actions={
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  paymentResolver.current?.(false);
                  paymentResolver.current = null;
                  setPaymentDialog(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={amount.length === 0 || (requiresReceiptNumber(order.paymentMethod) && receipt.length === 0)}
                onClick={() => {
                  paymentResolver.current?.(true);
                  paymentResolver.current = null;
                  setPaymentDialog(false);
                }}
              >
                Confirm
              </Button>
            </>
          }
        >
          <p className="text-sm">Enter payment details below:</p>
          <div className="mt-16">
            <TextField
              label="Amount Received (R)"
              inputMode="decimal"
              icon={<span style={{ fontWeight: 700 }}>R</span>}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          {requiresReceiptNumber(order.paymentMethod) && (
            <div className="mt-16">
              <TextField
                label="Receipt Number"
                value={receipt}
                onChange={(event) => setReceipt(event.target.value)}
              />
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};
