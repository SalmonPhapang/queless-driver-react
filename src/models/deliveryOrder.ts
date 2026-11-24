import { Store, StoreModel } from './store';
import { UserModel, UserModelX } from './user';
import { OrderStatus, OrderStatusX, PaymentStatus, PaymentStatusX } from './statuses';

/** Port of lib/models/delivery_order.dart. */
export interface DeliveryOrder {
  id: string;
  orderNumber?: string | null;
  storeId?: string | null;
  userId?: string | null;
  driverId?: string | null;
  code: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  amount?: number | null;
  subtotal?: number | null;
  deliveryFee?: number | null;
  discount?: number | null;
  total?: number | null;
  status: OrderStatus;
  deliveryAddress?: Record<string, unknown> | null;
  paymentMethod?: string | null;
  paymentStatus: PaymentStatus;
  scheduledDelivery?: Date | null;
  trackingUpdates?: unknown[] | null;
  driverName?: string | null;
  driverPhone?: string | null;
  driverLocation?: Record<string, unknown> | null;
  estimatedDeliveryTime?: Date | null;
  createdAt: Date;
  updatedAt?: Date | null;
  orderType: string;
  store?: Store | null;
  items?: unknown[] | null;
  customer?: UserModel | null;
  amountReceived?: number | null;
  receiptNumber?: string | null;
}

const asString = (v: unknown): string | undefined =>
  v === null || v === undefined ? undefined : String(v);

const asDouble = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const parsed = Number.parseFloat(String(v ?? ''));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const asDateTime = (v: unknown): Date | undefined => {
  if (v instanceof Date) return v;
  if (v === null || v === undefined) return undefined;
  const date = new Date(String(v));
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const asMap = (v: unknown): Record<string, unknown> | null => {
  if (Array.isArray(v) && v.length > 0 && v[0] && typeof v[0] === 'object') {
    return { ...(v[0] as Record<string, unknown>) };
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return { ...(v as Record<string, unknown>) };
  }
  return null;
};

const shortCodeFromId = (id?: string | null): string => {
  const raw = id ?? '';
  if (!raw) return '';
  return raw.length <= 8 ? raw : raw.slice(-8).toUpperCase();
};

const formatAddress = (data: Record<string, unknown> | null): string => {
  if (!data) return '';
  const streetAddress =
    asString(data.street_address) ?? asString(data.street) ?? asString(data.line1) ?? asString(data.address_line1);
  const province = asString(data.province) ?? asString(data.state);
  const postalCode = asString(data.postal_code) ?? asString(data.zip_code) ?? asString(data.postcode);

  const parts = [streetAddress, province, postalCode].filter(
    (part): part is string => !!part && part.length > 0,
  );
  if (parts.length > 0) return parts.join(', ');

  return (
    asString(data.address) ?? asString(data.formatted_address) ?? asString(data.full_address) ?? ''
  );
};

export const DeliveryOrderModel = {
  /** `baseSubtotal` from the Dart model. */
  baseSubtotal(order: DeliveryOrder): number {
    if (!order.items || order.items.length === 0) return order.subtotal ?? 0;
    let sum = 0;
    for (const item of order.items) {
      if (item && typeof item === 'object') {
        const row = item as Record<string, unknown>;
        const quantity = asDouble(row.quantity) ?? 1;
        const basePricePerUnit = asDouble(row.base_price_per_unit) ?? 0;
        sum += basePricePerUnit * quantity;
      }
    }
    return sum > 0 ? sum : order.subtotal ?? 0;
  },

  /** `baseTotal` from the Dart model. */
  baseTotal(order: DeliveryOrder): number {
    return DeliveryOrderModel.baseSubtotal(order) + (order.deliveryFee ?? 0) - (order.discount ?? 0);
  },

  fromJson(j: Record<string, unknown>): DeliveryOrder {
    const id = asString(j.id) ?? '';
    const deliveryAddress = asMap(j.delivery_address);

    const formattedDropoff = formatAddress(deliveryAddress);
    const dropoff =
      asString(j.dropoff_address) ??
      (formattedDropoff.length > 0 ? formattedDropoff : undefined) ??
      asString(j.delivery_address);

    const storeJson = asMap(j.stores) ?? asMap(j.store);
    const store = storeJson ? StoreModel.fromJson(storeJson) : null;

    const customerJson = asMap(j.users) ?? asMap(j.user);
    const customer = customerJson ? UserModelX.fromJson(customerJson) : null;

    const orderNumber = asString(j.order_number);
    const orderType = asString(j.order_type) ?? 'standard';

    const useDefaultStore = store === null;
    const defaultStoreName = 'Queless';
    const defaultStoreAddress = 'Online';

    return {
      id,
      orderNumber,
      storeId: asString(j.store_id),
      userId: asString(j.user_id),
      driverId: asString(j.driver_id),
      code: orderNumber ?? asString(j.code) ?? shortCodeFromId(id),
      customerName: customer?.fullName ?? asString(j.customer_name) ?? 'Unknown Customer',
      customerPhone: customer?.phone ?? asString(j.customer_phone) ?? 'No number',
      pickupAddress:
        store?.address ??
        asString(j.pickup_address) ??
        (useDefaultStore ? defaultStoreAddress : 'Store Address'),
      dropoffAddress: dropoff ?? 'No Address Provided',
      amount: asDouble(j.amount) ?? asDouble(j.total),
      subtotal: asDouble(j.subtotal),
      deliveryFee: asDouble(j.delivery_fee),
      discount: asDouble(j.discount),
      total: asDouble(j.total),
      status: OrderStatusX.fromDatabaseValue(asString(j.status), 'pending'),
      deliveryAddress,
      paymentMethod: asString(j.payment_method),
      paymentStatus: PaymentStatusX.fromDatabaseValue(asString(j.payment_status), 'pending'),
      scheduledDelivery: asDateTime(j.scheduled_delivery),
      trackingUpdates: Array.isArray(j.tracking_updates) ? j.tracking_updates : null,
      driverName: asString(j.driver_name),
      driverPhone: asString(j.driver_phone),
      driverLocation: asMap(j.driver_location),
      estimatedDeliveryTime: asDateTime(j.estimated_delivery_time),
      createdAt: asDateTime(j.created_at) ?? new Date(),
      updatedAt: asDateTime(j.updated_at),
      orderType,
      store: store ?? { id: 'default', name: defaultStoreName, address: defaultStoreAddress },
      items: Array.isArray(j.items) ? j.items : null,
      customer,
      amountReceived: asDouble(j.amount_received),
      receiptNumber: asString(j.receipt_number),
    };
  },
};
