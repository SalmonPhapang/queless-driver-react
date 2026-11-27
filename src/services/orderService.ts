// Port of lib/services/order_service.dart.
//
// All order lifecycle writes go through the shared `orders-status` edge
// function (FSM, tracking timeline, audit row, Paystack split, notifications).
// The driver app never touches Paystack secret keys.

import { SupabaseConfig } from '../config/supabaseClient';
import { errorMessage } from '../lib/errors';
import { DeliveryOrder, DeliveryOrderModel } from '../models/deliveryOrder';
import { DriverAssignment, DriverAssignmentModel } from '../models/driverAssignment';
import {
  DriverAssignmentStatus,
  type OrderStatus,
  TERMINAL_ASSIGNMENT_STATUS_LIST,
  TERMINAL_ASSIGNMENT_STATUSES,
} from '../models/statuses';
import { PushService } from './pushService';

const TRACKABLE_STATUSES: OrderStatus[] = ['driver_assigned', 'out_for_delivery', 'arrived'];

const TRACKABLE_STATUS_VALUES: string[] = [...TRACKABLE_STATUSES, DriverAssignmentStatus.assigned];

const PAYMENT_OR_FILTER = [
  'payment_status.eq.completed',
  'payment_method.eq.Cash on Delivery',
  'payment_method.eq.cashOnDelivery',
  'payment_method.eq.cod',
  'payment_method.eq.COD',
  'payment_method.eq.cash_on_delivery',
  'payment_method.eq.Speed Point / Card Machine',
].join(',');

const asDouble = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
};

const toOrders = (rows: unknown): DeliveryOrder[] =>
  (Array.isArray(rows) ? rows : []).map((row) =>
    DeliveryOrderModel.fromJson(row as Record<string, unknown>),
  );

const nowIso = (): string => new Date().toISOString();

export interface DriverPosition {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
}

export const OrderService = {
  table: 'orders',
  assignmentsTable: 'driver_assignments',

  async fetchAvailableOrders(_driverPosition?: DriverPosition | null): Promise<DeliveryOrder[]> {
    try {
      // Stop any ongoing new-order alert when fetching available orders.
      PushService.stopNewOrderAlert();

      const { data: allRes, error: allError } = await SupabaseConfig.client
        .from(OrderService.table)
        .select('*, stores:store_id(*), users:user_id(*)')
        .in('status', ['ready_for_pickup'])
        .or(PAYMENT_OR_FILTER)
        .order('created_at', { ascending: false });
      if (allError) throw allError;

      const allPending = toOrders(allRes);
      if (allPending.length === 0) return [];

      const orderIds = allPending.map((order) => order.id);
      const { data: assignments, error: assignmentError } = await SupabaseConfig.client
        .from(OrderService.assignmentsTable)
        .select('order_id, driver_id, status')
        .in('order_id', orderIds);
      if (assignmentError) throw assignmentError;

      const assignedOrderIds = new Set(
        (Array.isArray(assignments) ? assignments : [])
          .filter((row) => (row as Record<string, unknown>).driver_id != null)
          .map((row) => (row as Record<string, unknown>).order_id as string | null)
          .filter((id): id is string => typeof id === 'string'),
      );

      return allPending.filter((order) => !assignedOrderIds.has(order.id));
    } catch (error) {
      console.debug('Error fetching available orders:', error);
      throw error;
    }
  },

  async fetchUnassignedActiveOrders(): Promise<DeliveryOrder[]> {
    const { data, error } = await SupabaseConfig.client
      .from(OrderService.table)
      .select('*, stores:store_id(*), users:user_id(*)');
    if (error) throw error;

    const orders = toOrders(data);
    if (orders.length === 0) return orders;

    const { data: assignments, error: assignmentError } = await SupabaseConfig.client
      .from(OrderService.assignmentsTable)
      .select('order_id, driver_id')
      .in(
        'order_id',
        orders.map((order) => order.id),
      );
    if (assignmentError) throw assignmentError;

    const assignedOrderIds = new Set(
      (Array.isArray(assignments) ? assignments : [])
        .filter((row) => (row as Record<string, unknown>).driver_id != null)
        .map((row) => (row as Record<string, unknown>).order_id as string | null)
        .filter((id): id is string => typeof id === 'string'),
    );

    return orders.filter((order) => !assignedOrderIds.has(order.id));
  },

  /**
   * Single-order lookup used by the `/home/orders/:orderId` route and notification
   * deep links. Mirrors the joins every list query uses so the model resolves
   * the store and customer the same way.
   */
  async fetchOrderById(orderId: string): Promise<DeliveryOrder | null> {
    const { data, error } = await SupabaseConfig.client
      .from(OrderService.table)
      .select('*, stores:store_id(*), users:user_id(*)')
      .eq('id', orderId)
      .maybeSingle();
    if (error) throw error;
    return data ? DeliveryOrderModel.fromJson(data as Record<string, unknown>) : null;
  },

  async fetchDriverAssignments(driverId: string): Promise<Record<string, unknown>[]> {
    try {
      const { data, error } = await SupabaseConfig.client
        .from('driver_assignments')
        .select('*')
        .eq('driver_id', driverId);
      if (error) throw error;
      return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    } catch (error) {
      console.debug('Error fetching driver assignments:', error);
      throw error;
    }
  },

  async fetchMyActiveOrders({ driverId }: { driverId: string }): Promise<DeliveryOrder[]> {
    try {
      // Get ALL order IDs assigned to this driver (any assignment status),
      // then fetch the orders excluding delivered and cancelled.
      const { data: assignments, error: assignmentError } = await SupabaseConfig.client
        .from(OrderService.assignmentsTable)
        .select('order_id')
        .eq('driver_id', driverId);
      if (assignmentError) throw assignmentError;

      const orderIds = (Array.isArray(assignments) ? assignments : [])
        .map((row) => (row as Record<string, unknown>).order_id)
        .filter((id): id is string => typeof id === 'string');

      if (orderIds.length === 0) return [];

      const { data, error } = await SupabaseConfig.client
        .from(OrderService.table)
        .select('*, stores:store_id(*), users:user_id(*)')
        .in('id', orderIds)
        .not('status', 'in', '(delivered,cancelled)')
        .order('created_at', { ascending: false });
      if (error) throw error;

      return toOrders(data);
    } catch (error) {
      console.debug('Error fetching active orders:', error);
      throw error;
    }
  },

  async invokeOrdersStatus({
    orderId,
    newStatus,
    driverId,
    message,
  }: {
    orderId: string;
    newStatus: OrderStatus;
    driverId?: string | null;
    message?: string;
  }): Promise<void> {
    const resolvedDriverId = driverId ?? SupabaseConfig.currentUserId;
    await SupabaseConfig.edge.call('orders-status', {
      body: {
        order_id: orderId,
        new_status: newStatus,
        actor: 'driver',
        ...(resolvedDriverId ? { driver_id: resolvedDriverId } : {}),
        ...(message ? { reason: message } : {}),
      },
    });
  },

  async acceptOrder({
    orderId,
    driverId,
    customerId,
  }: {
    orderId: string;
    driverId: string;
    customerId: string;
  }): Promise<void> {
    console.debug('=== acceptOrder START ===', { orderId, driverId, customerId });
    PushService.stopNewOrderAlert();

    try {
      const newStatus: OrderStatus = 'driver_assigned';

      // 1. If this order was OFFERED to this driver, the assignment row already
      //    exists. A live offer is accepted through the RPC (the only path that
      //    cannot hand one order to two drivers). A past-deadline offer is first
      //    expired through a narrow RPC so the direct claim below is not blocked
      //    by orders-status. The 30-second acceptance rule is never bypassed.
      const existingOffer = await OrderService.findOfferForDriver({ orderId, driverId });
      if (existingOffer) {
        if (existingOffer.offerExpiresAt == null) {
          // Legacy offer without a deadline: the server derives one from
          // created_at and refuses to expire it while it is still live.
          await OrderService.expireDispatchOffer(existingOffer.id);
        } else {
          try {
            await OrderService.acceptDispatchOffer(existingOffer.id);
            return;
          } catch (error) {
            if (!OrderService.isExpiredOfferError(error)) throw error;
            await OrderService.expireDispatchOffer(existingOffer.id);
          }
        }
      }

      // 2. Otherwise this is a direct claim on an order nobody holds. The
      //    check below is advisory: the one-active-per-order index decides the
      //    winner, so the loser of a race gets a unique violation.
      const { data: existingAssignments, error: existingError } = await SupabaseConfig.client
        .from(OrderService.assignmentsTable)
        .select('driver_id, status')
        .eq('order_id', orderId);
      if (existingError) throw existingError;

      const liveRows = (Array.isArray(existingAssignments) ? existingAssignments : []).filter((row) => {
        const status = String((row as Record<string, unknown>).status ?? '')
          .trim()
          .toLowerCase();
        return !TERMINAL_ASSIGNMENT_STATUSES.has(status);
      });

      const claimedByAnotherDriver = liveRows.some((row) => {
        const assignedDriverId = (row as Record<string, unknown>).driver_id;
        return (
          assignedDriverId != null &&
          String(assignedDriverId).length > 0 &&
          String(assignedDriverId) !== driverId
        );
      });
      if (claimedByAnotherDriver) {
        throw new Error('This order has already been assigned to another driver.');
      }

      // No UPDATE branch here on purpose: rewriting every row for the order
      // would resurrect an expired or declined attempt.
      if (liveRows.length === 0) {
        const { error: insertError } = await SupabaseConfig.client
          .from(OrderService.assignmentsTable)
          .insert({
            order_id: orderId,
            driver_id: driverId,
            status: newStatus,
            accepted_at: nowIso(),
          });
        if (insertError) throw insertError;
      }

      // 3. Update order status via the shared edge function.
      await OrderService.invokeOrdersStatus({
        orderId,
        newStatus,
        driverId,
        message: 'Driver assigned and heading to store',
      });
    } catch (error) {
      console.debug('ERROR in acceptOrder:', error);
      throw error;
    }
  },

  /** Any still-`offered` row for this driver, including one past its deadline. */
  async findOfferForDriver({
    orderId,
    driverId,
  }: {
    orderId: string;
    driverId: string;
  }): Promise<DriverAssignmentModel | null> {
    const { data, error } = await SupabaseConfig.client
      .from(OrderService.assignmentsTable)
      .select('*')
      .eq('order_id', orderId)
      .eq('driver_id', driverId)
      .eq('status', DriverAssignmentStatus.offered);
    if (error) throw error;

    const list = Array.isArray(data) ? data : [];
    if (list.length === 0) return null;
    return DriverAssignment.fromJson(list[0] as Record<string, unknown>);
  },

  /** The live dispatch offer shown by the countdown UI, if any. */
  async findOpenOffer({
    orderId,
    driverId,
  }: {
    orderId: string;
    driverId: string;
  }): Promise<DriverAssignmentModel | null> {
    const offer = await OrderService.findOfferForDriver({ orderId, driverId });
    return offer && DriverAssignment.canRespondToOffer(offer) ? offer : null;
  },

  /** Accept a dispatch offer (server-authoritative RPC). */
  async acceptDispatchOffer(assignmentId: string): Promise<void> {
    const { error } = await SupabaseConfig.client.rpc('accept_dispatch_offer', {
      p_assignment_id: assignmentId,
    });
    if (error) throw error;
  },

  /**
   * Expire only this driver's own past-deadline offer. The server re-checks the
   * deadline, order status and competing assignments; this never runs the
   * global timeout sweep and never accepts an expired offer late.
   */
  async expireDispatchOffer(assignmentId: string): Promise<void> {
    const { error } = await SupabaseConfig.client.rpc('expire_dispatch_offer', {
      p_assignment_id: assignmentId,
    });
    if (error) throw error;
  },

  /** True when accept_dispatch_offer refused a genuinely lapsed offer. */
  isExpiredOfferError(error: unknown): boolean {
    const code = (error as { code?: string } | null)?.code;
    const message = String((error as { message?: unknown } | null)?.message ?? '').toLowerCase();
    return code === '22023' && message.includes('expired');
  },

  /** Decline a dispatch offer so the dispatcher can offer it to someone else. */
  async declineDispatchOffer(assignmentId: string, reason?: string): Promise<void> {
    const params: Record<string, unknown> = { p_assignment_id: assignmentId };
    if (reason && reason.trim().length > 0) params.p_reason = reason;
    const { error } = await SupabaseConfig.client.rpc('decline_dispatch_offer', params);
    if (error) throw error;
  },

  /** Friendly text for a dispatch-offer RPC failure. */
  describeOfferError(error: unknown): string {
    const code = (error as { code?: string } | null)?.code;
    switch (code) {
      case '22023':
        return 'That offer is no longer open.';
      case '42501':
        return 'That offer is not addressed to you.';
      case '23503':
        return 'That offer no longer exists.';
      case '28000':
        return 'Please sign in again to accept offers.';
      default:
        return `Could not update the offer: ${errorMessage(error)}`;
    }
  },

  /**
   * Upsert the per-driver row used by `nearby_eligible_drivers` for dispatch.
   * This is the only write an online-but-idle driver needs: no order is active
   * yet, so there is no assignment row to update.
   */
  async publishDriverLocation({
    driverId,
    lat,
    lng,
    accuracy,
    speed,
    heading,
    timestamp = nowIso(),
  }: {
    driverId: string;
    lat: number;
    lng: number;
    accuracy?: number | null;
    speed?: number | null;
    heading?: number | null;
    timestamp?: string;
  }): Promise<void> {
    const { error } = await SupabaseConfig.client
      .from('driver_locations')
      .upsert(
        {
          driver_id: driverId,
          current_lat: lat,
          current_lng: lng,
          last_location_update: timestamp,
          ...(accuracy == null ? {} : { location_accuracy: accuracy }),
          ...(speed == null ? {} : { location_speed: speed }),
          ...(heading == null ? {} : { location_heading: heading }),
          updated_at: timestamp,
        },
        { onConflict: 'driver_id' },
      );
    if (error) throw error;
  },

  async updateDriverLocation({
    orderIds,
    orderId,
    driverId,
    lat,
    lng,
    accuracy,
    speed,
    heading,
  }: {
    orderIds: string[];
    orderId?: string;
    driverId: string;
    lat: number;
    lng: number;
    accuracy?: number | null;
    speed?: number | null;
    heading?: number | null;
  }): Promise<void> {
    const timestamp = nowIso();
    const targets = orderIds.length > 0 ? orderIds : orderId ? [orderId] : [];

    if (targets.length > 0) {
      const payload: Record<string, unknown> = {
        current_lat: lat,
        current_lng: lng,
        last_location_update: timestamp,
        ...(accuracy == null ? {} : { location_accuracy: accuracy }),
        ...(speed == null ? {} : { location_speed: speed }),
        ...(heading == null ? {} : { location_heading: heading }),
        updated_at: timestamp,
      };

      // One batched UPDATE covering every tracked order.
      const { error } = await SupabaseConfig.client
        .from(OrderService.assignmentsTable)
        .update(payload)
        .eq('driver_id', driverId)
        .in('order_id', targets);
      if (error) throw error;
    }

    // Keep the per-driver live row fresh too. Non-critical during an active
    // delivery: the mirror trigger on driver_assignments writes the same fix.
    // Online-idle presence calls publishDriverLocation directly so failures are
    // surfaced there instead of being swallowed.
    try {
      await OrderService.publishDriverLocation({
        driverId,
        lat,
        lng,
        accuracy,
        speed,
        heading,
        timestamp,
      });
    } catch (error) {
      console.debug('driver_locations upsert skipped (non-critical):', error);
    }
  },

  async markPickedUp(orderId: string, _customerId: string): Promise<void> {
    const newStatus: OrderStatus = 'out_for_delivery';

    await OrderService.invokeOrdersStatus({
      orderId,
      newStatus,
      message: 'Order picked up and en route to you',
    });

    const { error } = await SupabaseConfig.client
      .from(OrderService.assignmentsTable)
      .update({
        status: newStatus,
        picked_up_at: nowIso(),
      })
      .eq('order_id', orderId)
      // Only the live row: an expired or declined attempt must not be
      // resurrected into a live status.
      .not('status', 'in', TERMINAL_ASSIGNMENT_STATUS_LIST);
    if (error) throw error;
  },

  async markDelivered(
    orderId: string,
    _customerId: string,
    options: { amountReceived?: number | null; receiptNumber?: string | null } = {},
  ): Promise<void> {
    const newStatus: OrderStatus = 'delivered';

    // 1. Fetch order details to get the delivery fee and driver id.
    const { data: orderRes, error: orderError } = await SupabaseConfig.client
      .from(OrderService.table)
      .select('delivery_fee, driver_assignments!inner(driver_id, status)')
      .eq('id', orderId)
      .single();
    if (orderError) throw orderError;

    const deliveryFee = asDouble((orderRes as Record<string, unknown>).delivery_fee) ?? 0;

    const assignments = (orderRes as Record<string, unknown>).driver_assignments;
    let driverId: string | null = null;
    if (Array.isArray(assignments) && assignments.length > 0) {
      // One row per dispatch attempt, so credit the LIVE one.
      const rows = assignments as Record<string, unknown>[];
      const live = rows.filter((row) => {
        const status = String(row.status ?? '')
          .trim()
          .toLowerCase();
        return !TERMINAL_ASSIGNMENT_STATUSES.has(status);
      });
      const chosen = live.length > 0 ? live[0] : rows[0];
      driverId = chosen.driver_id == null ? null : String(chosen.driver_id);
    } else if (assignments && typeof assignments === 'object') {
      const value = (assignments as Record<string, unknown>).driver_id;
      driverId = value == null ? null : String(value);
    }

    // 2. Update order status and tracking via the shared edge function.
    await OrderService.invokeOrdersStatus({
      orderId,
      newStatus,
      message: 'Order delivered successfully. Enjoy!',
    });

    // 3. Save payment details if provided.
    const updateData: Record<string, unknown> = { updated_at: nowIso() };
    if (options.amountReceived != null) updateData.amount_received = options.amountReceived;
    if (options.receiptNumber && options.receiptNumber.length > 0) {
      updateData.receipt_number = options.receiptNumber;
    }
    const { error: updateError } = await SupabaseConfig.client
      .from(OrderService.table)
      .update(updateData)
      .eq('id', orderId);
    if (updateError) throw updateError;

    // 4. Update driver assignment status.
    const { error: assignmentError } = await SupabaseConfig.client
      .from(OrderService.assignmentsTable)
      .update({
        status: newStatus,
        delivered_at: nowIso(),
      })
      .eq('order_id', orderId)
      .not('status', 'in', TERMINAL_ASSIGNMENT_STATUS_LIST);
    if (assignmentError) throw assignmentError;

    // 5. Record driver payment.
    if (driverId) {
      const { error: paymentError } = await SupabaseConfig.client
        .from('driver_payments')
        .insert({
          driver_id: driverId,
          order_id: orderId,
          amount: deliveryFee,
          status: 'earned',
        });
      if (paymentError) throw paymentError;
    }
  },

  async updateOrderStatus({
    orderId,
    newStatus,
    message,
  }: {
    orderId: string;
    newStatus: OrderStatus;
    message: string;
  }): Promise<void> {
    await OrderService.invokeOrdersStatus({ orderId, newStatus, message });

    // Keep the driver assignment status in sync so live tracking stops once
    // the order leaves the trackable statuses.
    const { error } = await SupabaseConfig.client
      .from(OrderService.assignmentsTable)
      .update({ status: newStatus })
      .eq('order_id', orderId)
      .not('status', 'in', TERMINAL_ASSIGNMENT_STATUS_LIST);
    if (error) throw error;
  },

  async fetchTrackableOrderIds({ driverId }: { driverId: string }): Promise<string[]> {
    const { data, error } = await SupabaseConfig.client
      .from(OrderService.assignmentsTable)
      .select('order_id, status')
      .eq('driver_id', driverId)
      .in('status', TRACKABLE_STATUS_VALUES);
    if (error) throw error;

    return [
      ...new Set(
        (Array.isArray(data) ? data : [])
          .map((row) => (row as Record<string, unknown>).order_id)
          .filter((id): id is string => typeof id === 'string'),
      ),
    ];
  },

  async fetchMyOrderHistory({ driverId }: { driverId: string }): Promise<DeliveryOrder[]> {
    try {
      const { data: assignments, error: assignmentError } = await SupabaseConfig.client
        .from(OrderService.assignmentsTable)
        .select('order_id')
        .eq('driver_id', driverId)
        .eq('status', 'delivered');
      if (assignmentError) throw assignmentError;

      const orderIds = (Array.isArray(assignments) ? assignments : [])
        .map((row) => (row as Record<string, unknown>).order_id)
        .filter((id): id is string => typeof id === 'string');

      if (orderIds.length === 0) return [];

      const { data, error } = await SupabaseConfig.client
        .from(OrderService.table)
        .select('*, stores:store_id(*), users:user_id(*)')
        .in('id', orderIds)
        .order('created_at', { ascending: false });
      if (error) throw error;

      return toOrders(data);
    } catch (error) {
      console.debug('Error fetching order history:', error);
      throw error;
    }
  },
};
