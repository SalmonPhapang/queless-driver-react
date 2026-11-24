// ============================================================================
// QUELESS DRIVER (React) — UNIFIED STATUS SYSTEM
//
// Direct port of queless-core/lib/statuses.dart (the single source of truth
// shared by the Customer, Driver and Store apps). Values written to Supabase
// are identical; parsing is deliberately lenient in the same places.
//
// Differences from the Dart original:
//  - enums become const arrays + union types;
//  - Flutter Color/IconData hints become hex strings and lucide icon names.
// ============================================================================

export const ORDER_STATUSES = [
  'pending',
  'awaiting_payment',
  'awaiting_store_acceptance',
  'preparing',
  'ready_for_pickup',
  'driver_assigned',
  'out_for_delivery',
  'arrived',
  'delivered',
  'cancelled',
  'rejected',
  'failed_delivery',
  'refunded',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface StatusMeta {
  displayName: string;
  icon: string;
  color: string;
}

const ORDER_META: Record<OrderStatus, StatusMeta> = {
  pending: { displayName: 'Pending', icon: 'hourglass', color: '#607D8B' },
  awaiting_payment: { displayName: 'Awaiting Payment', icon: 'banknote', color: '#FFC107' },
  awaiting_store_acceptance: { displayName: 'Awaiting Store Acceptance', icon: 'store', color: '#FF9800' },
  preparing: { displayName: 'Preparing', icon: 'utensils', color: '#FF5722' },
  ready_for_pickup: { displayName: 'Ready for Pickup', icon: 'package', color: '#009688' },
  driver_assigned: { displayName: 'Driver Assigned', icon: 'user-pin', color: '#3F51B5' },
  out_for_delivery: { displayName: 'Out for Delivery', icon: 'bike', color: '#2196F3' },
  arrived: { displayName: 'Arrived', icon: 'map-pin', color: '#00BCD4' },
  delivered: { displayName: 'Delivered', icon: 'check-circle', color: '#4CAF50' },
  cancelled: { displayName: 'Cancelled', icon: 'x-circle', color: '#9E9E9E' },
  rejected: { displayName: 'Rejected', icon: 'ban', color: '#F44336' },
  failed_delivery: { displayName: 'Failed Delivery', icon: 'alert-circle', color: '#795548' },
  refunded: { displayName: 'Refunded', icon: 'banknote-x', color: '#9C27B0' },
};

const ORDER_NEXT: Record<OrderStatus, OrderStatus[]> = {
  pending: ['awaiting_payment', 'awaiting_store_acceptance', 'cancelled'],
  awaiting_payment: ['awaiting_store_acceptance', 'cancelled'],
  awaiting_store_acceptance: ['preparing', 'rejected', 'cancelled'],
  preparing: ['ready_for_pickup', 'cancelled', 'refunded'],
  ready_for_pickup: ['driver_assigned', 'cancelled'],
  driver_assigned: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['arrived', 'failed_delivery'],
  arrived: ['delivered', 'failed_delivery'],
  delivered: ['refunded'],
  cancelled: [],
  rejected: [],
  failed_delivery: [],
  refunded: [],
};

const TERMINAL_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set([
  'delivered',
  'cancelled',
  'rejected',
  'failed_delivery',
  'refunded',
]);

export const OrderStatusX = {
  meta(status: OrderStatus): StatusMeta {
    return ORDER_META[status];
  },
  displayName(status: OrderStatus): string {
    return ORDER_META[status].displayName;
  },
  color(status: OrderStatus): string {
    return ORDER_META[status].color;
  },
  icon(status: OrderStatus): string {
    return ORDER_META[status].icon;
  },
  allowedNextStatuses(status: OrderStatus): OrderStatus[] {
    return ORDER_NEXT[status];
  },
  isTerminal(status: OrderStatus): boolean {
    return TERMINAL_ORDER_STATUSES.has(status);
  },
  isActive(status: OrderStatus): boolean {
    return !TERMINAL_ORDER_STATUSES.has(status);
  },
  userCanCancel(status: OrderStatus): boolean {
    return (
      status === 'pending' ||
      status === 'awaiting_payment' ||
      status === 'awaiting_store_acceptance' ||
      status === 'preparing' ||
      status === 'ready_for_pickup' ||
      status === 'driver_assigned'
    );
  },
  storeCanUpdate(status: OrderStatus): boolean {
    return (
      status === 'awaiting_store_acceptance' ||
      status === 'preparing' ||
      status === 'ready_for_pickup'
    );
  },
  driverCanUpdate(status: OrderStatus): boolean {
    return (
      status === 'driver_assigned' ||
      status === 'out_for_delivery' ||
      status === 'arrived'
    );
  },

  /**
   * Parse a DB string back into an OrderStatus (case-insensitive & lenient).
   * Accepts snake_case (what edge functions write) and camelCase (older app
   * versions), plus every legacy alias the three apps historically accepted.
   */
  fromDatabaseValue(value: string | null | undefined, fallback: OrderStatus = 'pending'): OrderStatus {
    if (!value) return fallback;
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const status of ORDER_STATUSES) {
      if (status.replace(/_/g, '') === normalized) return status;
    }
    switch (normalized) {
      case 'confirmed':
        return 'awaiting_store_acceptance';
      case 'delivering':
      case 'enroute':
      case 'ontheway':
      case 'ontheway2':
      case 'pickedup':
        return 'out_for_delivery';
      case 'complete':
      case 'completed':
      case 'success':
        return 'delivered';
      case 'canceled':
        return 'cancelled';
      case 'assigned':
        return 'driver_assigned';
      case 'ready':
        return 'ready_for_pickup';
      case 'inprogress':
      case 'cooking':
        return 'preparing';
      case 'atdoor':
      case 'customerlocation':
        return 'arrived';
      case 'declined':
      case 'denied':
        return 'rejected';
      case 'failed':
      case 'undelivered':
        return 'failed_delivery';
      case 'refund':
        return 'refunded';
      case 'aborted':
        return 'cancelled';
      default:
        return fallback;
    }
  },
};

// ============================================================================
// PAYMENT LIFECYCLE
// ============================================================================

export const PAYMENT_STATUSES = [
  'pending',
  'awaiting_payment',
  'processing',
  'completed',
  'failed',
  'refunded',
  'partially_refunded',
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

const PAYMENT_META: Record<PaymentStatus, StatusMeta> = {
  pending: { displayName: 'Pending', icon: 'hourglass', color: '#FF9800' },
  awaiting_payment: { displayName: 'Awaiting Payment', icon: 'banknote', color: '#FF9800' },
  processing: { displayName: 'Processing', icon: 'loader', color: '#2196F3' },
  completed: { displayName: 'Paid', icon: 'check-circle', color: '#4CAF50' },
  failed: { displayName: 'Failed', icon: 'alert-circle', color: '#F44336' },
  refunded: { displayName: 'Refunded', icon: 'banknote-x', color: '#9C27B0' },
  partially_refunded: { displayName: 'Partially Refunded', icon: 'banknote-x', color: '#9C27B0' },
};

export const PaymentStatusX = {
  meta(status: PaymentStatus): StatusMeta {
    return PAYMENT_META[status];
  },
  displayName(status: PaymentStatus): string {
    return PAYMENT_META[status].displayName;
  },
  color(status: PaymentStatus): string {
    return PAYMENT_META[status].color;
  },
  icon(status: PaymentStatus): string {
    return PAYMENT_META[status].icon;
  },
  isTerminal(status: PaymentStatus): boolean {
    return (
      status === 'completed' ||
      status === 'failed' ||
      status === 'refunded' ||
      status === 'partially_refunded'
    );
  },
  isPaid(status: PaymentStatus): boolean {
    return status === 'completed' || status === 'partially_refunded';
  },
  fromDatabaseValue(
    value: string | null | undefined,
    fallback: PaymentStatus = 'pending',
  ): PaymentStatus {
    if (!value) return fallback;
    switch (value.trim().toLowerCase().replace(/-/g, '_')) {
      case 'pending':
      case 'unpaid':
        return 'pending';
      case 'awaiting_payment':
      case 'awaitingpayment':
      case 'payment_pending':
        return 'awaiting_payment';
      case 'processing':
      case 'in_progress':
        return 'processing';
      case 'completed':
      case 'complete':
      case 'success':
      case 'succeeded':
      case 'paid':
      case 'captured':
        return 'completed';
      case 'failed':
      case 'failure':
      case 'declined':
      case 'error':
        return 'failed';
      case 'refunded':
      case 'reversed':
      case 'refund':
        return 'refunded';
      case 'partially_refunded':
      case 'partial':
        return 'partially_refunded';
      default:
        return fallback;
    }
  },
};

// ============================================================================
// DRIVER LIFECYCLE
// ============================================================================

export const DRIVER_STATUSES = ['offline', 'online', 'on_delivery', 'on_break', 'inactive'] as const;

export type DriverStatus = (typeof DRIVER_STATUSES)[number];

const DRIVER_META: Record<DriverStatus, StatusMeta> = {
  offline: { displayName: 'Offline', icon: 'cloud-off', color: '#9E9E9E' },
  online: { displayName: 'Online', icon: 'cloud-check', color: '#4CAF50' },
  on_delivery: { displayName: 'On Delivery', icon: 'bike', color: '#2196F3' },
  on_break: { displayName: 'On Break', icon: 'coffee', color: '#FFC107' },
  inactive: { displayName: 'Inactive', icon: 'ban', color: '#F44336' },
};

export const DriverStatusX = {
  meta(status: DriverStatus): StatusMeta {
    return DRIVER_META[status];
  },
  displayName(status: DriverStatus): string {
    return DRIVER_META[status].displayName;
  },
  color(status: DriverStatus): string {
    return DRIVER_META[status].color;
  },
  icon(status: DriverStatus): string {
    return DRIVER_META[status].icon;
  },
  canReceiveOrders(status: DriverStatus): boolean {
    return status === 'online';
  },
  fromDatabaseValue(
    value: string | null | undefined,
    fallback: DriverStatus = 'offline',
  ): DriverStatus {
    if (!value) return fallback;
    const lower = value.trim().toLowerCase().replace(/-/g, '_');
    switch (lower) {
      case 'active':
      case 'available':
        return 'online';
      case 'unavailable':
        return 'offline';
      case 'busy':
      case 'delivering':
        return 'on_delivery';
      case 'on_break':
      case 'break':
        return 'on_break';
      case 'banned':
      case 'disabled':
        return 'inactive';
    }
    // Flutter also compares against Dart enum names (`onDelivery`, `onBreak`).
    const compact = lower.replace(/_/g, '');
    const match = DRIVER_STATUSES.find(
      (status) => status.toLowerCase().replace(/_/g, '') === compact,
    );
    return match ?? fallback;
  },
};

// ============================================================================
// DRIVER ASSIGNMENT / DISPATCH OFFER VOCABULARY
// ============================================================================

export const DriverAssignmentStatus = {
  offered: 'offered',
  expired: 'expired',
  declined: 'declined',
  assigned: 'assigned',
} as const;

/**
 * Assignment statuses that are over. `driver_assignments` keeps one row per
 * dispatch attempt, so "update this order's assignment" must target the single
 * live row.
 */
export const TERMINAL_ASSIGNMENT_STATUSES: ReadonlySet<string> = new Set([
  'delivered',
  'cancelled',
  'canceled',
  'expired',
  'declined',
  'failed',
  'failed_delivery',
  'rejected',
]);

/** The same statuses as a PostgREST `in` list, for `.not('status', 'in', …)`. */
export const TERMINAL_ASSIGNMENT_STATUS_LIST = `(${[...TERMINAL_ASSIGNMENT_STATUSES].join(',')})`;
