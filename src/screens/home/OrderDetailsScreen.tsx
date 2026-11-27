import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { AppBar } from '../../components/AppBar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { SelectField } from '../../components/SelectField';
import { OrderDetailsSkeleton } from '../../components/Skeleton';
import { StatusIcon } from '../../components/StatusIcon';
import { StatusMessage } from '../../components/StatusMessage';
import { SupabaseConfig } from '../../config/supabaseClient';
import { errorMessage } from '../../lib/errors';
import { formatMoney, formatTime } from '../../lib/format';
import { DeliveryOrderModel, type DeliveryOrder } from '../../models/deliveryOrder';
import type { Driver } from '../../models/driver';
import { DriverAssignment, type DriverAssignmentModel } from '../../models/driverAssignment';
import { ORDER_STATUSES, OrderStatusX, type OrderStatus } from '../../models/statuses';
import { BackgroundLocationService } from '../../services/backgroundLocationService';
import { DriverService } from '../../services/driverService';
import { LocationService } from '../../services/locationService';
import { NotificationInboxService } from '../../services/notificationInboxService';
import { OrderService } from '../../services/orderService';
import { UiService } from '../../services/uiService';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';

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

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
    notFoundTitle: { ...typography.headlineSmall, fontWeight: '800', color: colors.text },
    notFoundText: { ...typography.bodyMedium, color: colors.textMuted, textAlign: 'center' },
    scroll: { flex: 1 },
    body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8, gap: 16 },
    statusBlock: { marginBottom: 4 },
    sectionTitle: { ...typography.titleMedium, letterSpacing: 0.08, color: colors.text },
    subSectionTitle: { ...typography.titleSmall, color: colors.text },
    paddedCard: { padding: 16 },
    mt8: { height: 8 },
    mt12: { marginTop: 12 },
    mt16: { marginTop: 16 },
    mt32: { marginTop: 32 },
    stackSm: { gap: 12 },
    divider: { height: 1, backgroundColor: colors.divider, marginVertical: 12 },
    statusHero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      backgroundColor: colors.card,
    },
    statusIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    statusLabel: { ...typography.labelSmall, letterSpacing: 0.08 },
    statusValue: { ...typography.titleLarge, fontWeight: '800', letterSpacing: 0.04 },
    infoCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    infoIcon: { width: 32, alignItems: 'center', justifyContent: 'center' },
    infoText: { flex: 1 },
    infoTitle: { ...typography.bodyMedium, fontWeight: '600', color: colors.text },
    infoSubtitle: { marginTop: 4, ...typography.bodySmall, color: colors.textMuted },
    phoneButton: { padding: 6 },
    timeline: { gap: 0 },
    timelineStep: { flexDirection: 'row', gap: 12, minHeight: 44 },
    timelineRail: { width: 22, alignItems: 'center' },
    timelineDot: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.divider,
    },
    timelineDotDone: { backgroundColor: colors.success, borderColor: colors.success },
    timelineLine: { width: 2, flex: 1, minHeight: 20, backgroundColor: colors.divider },
    timelineLineDone: { backgroundColor: colors.success },
    timelineContent: { flex: 1, paddingBottom: 16 },
    timelineLabel: { ...typography.bodySmall, color: colors.text },
    timelineMuted: { color: colors.textMuted },
    timelineMeta: { ...typography.caption, color: colors.textMuted },
    timelineMessage: { marginTop: 4, ...typography.bodySmall, color: colors.textMuted },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    listItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
    listItemIcon: { width: 40, height: 40, borderRadius: 8 },
    listItemText: { flex: 1 },
    listTitle: { ...typography.bodyMedium, color: colors.text },
    listSubtitle: { marginTop: 2, ...typography.bodySmall, color: colors.textMuted },
    qty: { ...typography.bodySmall, color: colors.textMuted },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    summaryLabel: { ...typography.bodySmall, color: colors.textMuted },
    summaryValue: { ...typography.bodySmall, color: colors.text },
    summaryBold: { ...typography.labelLarge, color: colors.text },
    summaryNegative: { color: colors.error },
    actions: { paddingHorizontal: 20, paddingVertical: 20, borderTopWidth: 1, borderTopColor: colors.divider, gap: 12 },
    offerBanner: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.divider, gap: 10 },
    offerBannerUrgent: { borderColor: colors.error, backgroundColor: colors.errorContainer },
    offerText: { ...typography.bodySmall, color: colors.text },
    unverified: { ...typography.bodySmall, fontWeight: '700', color: colors.error, textAlign: 'center' },
    modalOverlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalCard: { width: '100%', padding: 20, gap: 12 },
    modalTitle: { ...typography.headlineSmall, color: colors.text },
    modalBody: { ...typography.bodySmall, color: colors.textMuted },
    amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    currency: { ...typography.labelLarge, color: colors.text },
    amountInput: { flex: 1 },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  });

const StatusWithRetry = ({
  title,
  message,
  onRetry,
  onDismiss,
  style,
}: {
  title: string;
  message: string;
  onRetry: () => void;
  onDismiss?: () => void;
  style?: object;
}) => (
  <View style={style}>
    <StatusMessage variant="error" title={title} message={message} onDismiss={onDismiss} />
    <Button variant="outline" size="sm" title="Try again" onPress={onRetry} />
  </View>
);

const InfoCard = ({
  icon,
  title,
  subtitle,
  trailing,
  colors,
  styles,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string | null;
  trailing?: ReactNode;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}) => (
  <Card style={styles.infoCard}>
    <View style={styles.infoIcon}>{icon}</View>
    <View style={styles.infoText}>
      <Text style={styles.infoTitle}>{title}</Text>
      {subtitle != null && <Text style={styles.infoSubtitle}>{subtitle}</Text>}
    </View>
    {trailing}
  </Card>
);

const SummaryRow = ({
  label,
  value,
  bold = false,
  negative = false,
  styles,
}: {
  label: string;
  value: string;
  bold?: boolean;
  negative?: boolean;
  styles: ReturnType<typeof makeStyles>;
}) => (
  <View style={styles.summaryRow}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={[styles.summaryValue, bold && styles.summaryBold, negative && styles.summaryNegative]}>{value}</Text>
  </View>
);

/** Flutter's fallback steps when the order has no detailed tracking updates. */
const TrackingTimeline = ({
  order,
  colors,
  styles,
}: {
  order: DeliveryOrder;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}) => {
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
      <View style={styles.timeline}>
        {steps.map((step, index) => (
          <View style={styles.timelineStep} key={step.label}>
            <View style={styles.timelineRail}>
              <View style={[styles.timelineDot, step.isDone && styles.timelineDotDone]}>
                {step.isDone && <MaterialCommunityIcons name="check" size={12} color={colors.onPrimary} />}
              </View>
              {index < steps.length - 1 && (
                <View style={[styles.timelineLine, step.isDone && styles.timelineLineDone]} />
              )}
            </View>
            <View style={styles.timelineContent}>
              <Text style={[styles.timelineLabel, !step.isDone && styles.timelineMuted]}>{step.label}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.timeline}>
      {updates.map((raw, index) => {
        const update = raw && typeof raw === 'object' ? (raw as unknown as Record<string, unknown>) : {};
        const status = update.status != null ? String(update.status).toUpperCase() : 'UPDATE';
        const message = update.message != null ? String(update.message) : '';
        const parsed = new Date(String(update.timestamp ?? ''));
        const timestamp = Number.isNaN(parsed.getTime()) ? null : parsed;
        return (
          <View style={styles.timelineStep} key={`${status}-${index}`}>
            <View style={styles.timelineRail}>
              <View style={[styles.timelineDot, styles.timelineDotDone]}>
                <MaterialCommunityIcons name="check" size={12} color={colors.onPrimary} />
              </View>
              {index < updates.length - 1 && <View style={[styles.timelineLine, styles.timelineLineDone]} />}
            </View>
            <View style={styles.timelineContent}>
              <View style={styles.rowBetween}>
                <Text style={[styles.timelineLabel, { color: colors.primary }]}>{status}</Text>
                {timestamp && <Text style={styles.timelineMeta}>{formatTime(timestamp)}</Text>}
              </View>
              <Text style={styles.timelineMessage}>{message}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

/** Structured-address formatter carried over from `_buildAddressCard`. */
const fullAddress = (order: DeliveryOrder): string => {
  const data = order.deliveryAddress;
  const str = (value: unknown): string | undefined => (value == null ? undefined : String(value));
  const street = data
    ? str(data.street_address) ?? str(data.street) ?? str(data.line1) ?? str(data.address_line1)
    : undefined;
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
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const params = useLocalSearchParams();
  const rawOrderId = params.orderId;
  const orderId = Array.isArray(rawOrderId) ? rawOrderId[0] : rawOrderId;
  const rawFromNotification = params.fromNotification;
  const fromNotificationValue = Array.isArray(rawFromNotification) ? rawFromNotification[0] : rawFromNotification;
  const fromNotification = fromNotificationValue === '1' || fromNotificationValue === 'true';
  // Flutter's inbox deep link constructs details with `isVerified: true` and
  // `driver: null`, so carry that intent in a route parameter.
  // A cold-start deep link has no previous route to pop to.
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/home/available');
  }, []);

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
          user && !fromNotification ? DriverService.getDriverProfile(user.id) : Promise.resolve(null),
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
    const timer = setInterval(() => {
      if (!DriverAssignment.canRespondToOffer(openOffer)) {
        setOpenOffer(null);
        setOfferError('The dispatch offer expired.');
        return;
      }
      setTick((value) => value + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [openOffer]);

  const syncTracking = async () => {
    if (!user) return;
    try {
      await LocationService.syncTrackingForDriver({ driverId: user.id });
    } catch (error) {
      // A completed status change must not be rolled back in the UI just
      // because a background tracking refresh failed.
      console.debug('[order] Tracking sync failed:', error);
    }
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

  const closePaymentDialog = (confirmed: boolean) => {
    paymentResolver.current?.(confirmed);
    paymentResolver.current = null;
    setPaymentDialog(false);
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

      if (action === 'accept') {
        await NotificationInboxService.markOrderOffersRead(order.id);
        await UiService.showSuccess('Order accepted. It is now in your Active list.');
        router.replace('/home/active');
        return;
      }

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
    return <OrderDetailsSkeleton onBack={goBack} />;
  }

  if (!order) {
    if (fromNotification) return null;
    return (
      <Screen padded={false} scroll={false}>
        <AppBar title="Order" onBack={goBack} />
        <View style={styles.notFound}>
          <Text style={styles.notFoundTitle}>Order not found</Text>
          <Text style={styles.notFoundText}>{loadError ?? 'This order is no longer available.'}</Text>
          <Button variant="outline" title="Go back" onPress={goBack} />
        </View>
      </Screen>
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

  const ctaTitle = isPending
    ? 'ACCEPT ORDER'
    : isAssigned
      ? 'MARK AS PICKED UP'
      : isPickedUp
        ? 'MARK AS ARRIVED'
        : isArrived
          ? 'MARK AS DELIVERED'
          : 'CLOSE';

  return (
    <Screen padded={false} scroll={false}>
      <AppBar title={`Order #${order.code}`} onBack={goBack} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
        {offerError && (
          <StatusWithRetry
            style={styles.statusBlock}
            title="Offer status"
            message={offerError}
            onRetry={() => void refreshOffer()}
            onDismiss={() => setOfferError(null)}
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

        {/* Status card */}
        <Card style={[styles.statusHero, { borderColor: statusColor }]}>
          <View style={[styles.statusIcon, { backgroundColor: statusColor }]}>
            <StatusIcon status={order.status} size={26} color={colors.onPrimary} />
          </View>
          <View>
            <Text style={[styles.statusLabel, { color: statusColor }]}>STATUS</Text>
            <Text style={[styles.statusValue, { color: statusColor }]}>
              {OrderStatusX.displayName(order.status).toUpperCase()}
            </Text>
          </View>
        </Card>

        {/* Admin controls */}
        {isAdmin && (
          <>
            <Text style={styles.sectionTitle}>ADMIN CONTROLS</Text>
            <Card style={styles.paddedCard}>
              <Text style={styles.subSectionTitle}>Change Order Status</Text>
              <View style={styles.mt12}>
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
              </View>
              <View style={styles.mt12}>
                <Button
                  variant="primary"
                  block
                  loading={busy}
                  disabled={!selectedStatus}
                  style={{ backgroundColor: colors.warning }}
                  title="UPDATE STATUS"
                  onPress={() => void adminUpdateStatus(selectedStatus as OrderStatus)}
                />
              </View>
            </Card>
          </>
        )}

        {/* Tracking timeline — hidden once delivered */}
        {(isAssigned || isPickedUp || isArrived) && (
          <>
            <Text style={styles.sectionTitle}>TRACKING INFO</Text>
            <TrackingTimeline order={order} colors={colors} styles={styles} />
          </>
        )}

        <Text style={styles.sectionTitle}>STORE DETAILS</Text>
        <View style={styles.stackSm}>
          <InfoCard
            icon={<MaterialCommunityIcons name="store-outline" size={20} color={colors.primary} />}
            title={order.store?.name ?? 'Store Name'}
            trailing={
              order.store?.phone != null ? (
                // Flutter leaves the phone action as a placeholder.
                <TouchableOpacity accessibilityLabel="Call store" style={styles.phoneButton} onPress={() => {}}>
                  <MaterialCommunityIcons name="phone" size={20} color={colors.success} />
                </TouchableOpacity>
              ) : undefined
            }
            colors={colors}
            styles={styles}
          />
          <InfoCard
            icon={<MaterialCommunityIcons name="map-marker-outline" size={20} color={colors.primary} />}
            title="Pickup Address"
            subtitle={order.store?.address ?? order.pickupAddress}
            colors={colors}
            styles={styles}
          />
        </View>

        <Text style={styles.sectionTitle}>CUSTOMER DETAILS</Text>
        <InfoCard
          icon={<MaterialCommunityIcons name="account-outline" size={20} color={colors.primary} />}
          title={
            order.customerName || order.customerPhone
              ? `${order.customerName || 'Unknown'} • ${order.customerPhone || 'No number'}`
              : 'Customer details not provided'
          }
          trailing={
            order.customerPhone ? (
              // Flutter leaves the phone action as a placeholder.
              <TouchableOpacity accessibilityLabel="Call customer" style={styles.phoneButton} onPress={() => {}}>
                <MaterialCommunityIcons name="phone" size={20} color={colors.success} />
              </TouchableOpacity>
            ) : undefined
          }
          colors={colors}
          styles={styles}
        />

        <Text style={styles.sectionTitle}>DELIVERY ADDRESS</Text>
        <InfoCard
          icon={<MaterialCommunityIcons name="map-marker-outline" size={20} color={colors.primary} />}
          title="Destination"
          subtitle={fullAddress(order)}
          colors={colors}
          styles={styles}
        />

        <Text style={styles.sectionTitle}>ORDER ITEMS</Text>
        {order.items != null && order.items.length > 0 ? (
          <Card style={{ padding: 0 }}>
            {order.items.map((raw, index) => {
              const item = raw && typeof raw === 'object' ? (raw as unknown as Record<string, unknown>) : {};
              const qty = Number(item.quantity ?? 1);
              const unit = Number(item.base_price_per_unit ?? 0);
              const imageUrl = item.product_image_url != null ? String(item.product_image_url) : '';
              return (
                <View
                  style={[
                    styles.listItem,
                    index > 0 ? { borderTopWidth: 1, borderTopColor: colors.divider } : undefined,
                  ]}
                  key={`${String(item.product_name ?? 'item')}-${index}`}
                >
                  {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={styles.listItemIcon} />
                  ) : (
                    <View style={[styles.listItemIcon, { alignItems: 'center', justifyContent: 'center' }]}>
                      <MaterialCommunityIcons name="basket-outline" size={20} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={styles.listItemText}>
                    <Text style={styles.listTitle}>{String(item.product_name ?? 'Unknown Item')}</Text>
                    <Text style={styles.listSubtitle}>{formatMoney(unit * qty)}</Text>
                  </View>
                  <Text style={styles.qty}>x{qty}</Text>
                </View>
              );
            })}
          </Card>
        ) : (
          <InfoCard
            icon={<MaterialCommunityIcons name="basket-outline" size={20} color={colors.primary} />}
            title="No items"
            subtitle="No product information found for this order."
            colors={colors}
            styles={styles}
          />
        )}

        <Text style={styles.sectionTitle}>PAYMENT SUMMARY</Text>
        <Card style={styles.paddedCard}>
          <SummaryRow label="Subtotal (Base)" value={formatMoney(DeliveryOrderModel.baseSubtotal(order))} styles={styles} />
          <View style={styles.mt8} />
          <SummaryRow label="Delivery Fee" value={formatMoney(order.deliveryFee ?? 0)} styles={styles} />
          {(order.discount ?? 0) > 0 && (
            <>
              <View style={styles.mt8} />
              <SummaryRow
                label="Discount"
                value={`-${formatMoney(order.discount ?? 0)}`}
                negative
                styles={styles}
              />
            </>
          )}
          <View style={styles.divider} />
          <SummaryRow label="Total (Base)" value={formatMoney(DeliveryOrderModel.baseTotal(order))} bold styles={styles} />
        </Card>
      </ScrollView>

      {!isDelivered && (
        <View style={styles.actions}>
          {openOffer && (
            <View style={[styles.offerBanner, urgent && styles.offerBannerUrgent]}>
              <Text style={styles.offerText}>
                {seconds > 0 ? `Respond within ${seconds}s to keep this order` : 'Offer closing…'}
              </Text>
              <Button
                variant="outline"
                block
                loading={busy}
                title="DECLINE OFFER"
                onPress={() => void declineOffer()}
              />
            </View>
          )}

          {isPending && !isVerified && !isAdmin && (
            <Text style={styles.unverified}>You must be verified to accept orders</Text>
          )}

          <Button
            variant={isPickedUp ? 'green' : 'primary'}
            block
            loading={busy}
            disabled={!canAct}
            title={ctaTitle}
            onPress={() => {
              if (isPending) void updateStatus('accept');
              else if (isAssigned) void updateStatus('pickup');
              else if (isPickedUp) void adminUpdateStatus('arrived', 'Driver arrived at delivery location');
              else if (isArrived) void updateStatus('deliver');
            }}
          />
        </View>
      )}

      <Modal
        visible={paymentDialog}
        transparent
        animationType="fade"
        onRequestClose={() => undefined}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm Delivery</Text>
            <Text style={styles.modalBody}>Enter payment details below:</Text>
            <View style={styles.amountRow}>
              <Text style={styles.currency}>R</Text>
              <View style={styles.amountInput}>
                <Input
                  label="Amount Received (R)"
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>
            </View>
            {requiresReceiptNumber(order.paymentMethod) && (
              <View style={styles.mt16}>
                <Input label="Receipt Number" value={receipt} onChangeText={setReceipt} />
              </View>
            )}
            <View style={styles.modalActions}>
              <Button variant="ghost" title="Cancel" onPress={() => closePaymentDialog(false)} />
              <Button
                variant="primary"
                disabled={amount.length === 0 || (requiresReceiptNumber(order.paymentMethod) && receipt.length === 0)}
                title="Confirm"
                onPress={() => closePaymentDialog(true)}
              />
            </View>
          </Card>
        </View>
      </Modal>
    </Screen>
  );
};
