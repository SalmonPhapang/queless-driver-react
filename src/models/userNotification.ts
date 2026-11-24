/** Port of queless_core/lib/models/user_notification.dart. */
export interface UserNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  orderId?: string | null;
  orderNumber?: string | null;
  status?: string | null;
  data: Record<string, unknown>;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const asDate = (value: unknown): Date => {
  const date = new Date(String(value ?? ''));
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

export const UserNotificationModel = {
  fromJson(json: Record<string, unknown>): UserNotification {
    return {
      id: String(json.id ?? ''),
      type: String(json.type ?? 'order'),
      title: String(json.title ?? ''),
      body: String(json.body ?? ''),
      orderId: json.order_id == null ? null : String(json.order_id),
      orderNumber: json.order_number == null ? null : String(json.order_number),
      status: json.status == null ? null : String(json.status),
      data:
        json.data && typeof json.data === 'object' && !Array.isArray(json.data)
          ? (json.data as Record<string, unknown>)
          : {},
      isRead: json.is_read === true,
      createdAt: asDate(json.created_at),
      updatedAt: asDate(json.updated_at),
    };
  },

  toJson(n: UserNotification): Record<string, unknown> {
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      order_id: n.orderId,
      order_number: n.orderNumber,
      status: n.status,
      data: n.data,
      is_read: n.isRead,
      created_at: n.createdAt.toISOString(),
      updated_at: n.updatedAt.toISOString(),
    };
  },

  copyWith(n: UserNotification, changes: { isRead?: boolean }): UserNotification {
    return { ...n, isRead: changes.isRead ?? n.isRead };
  },

  isOrderRelated(n: UserNotification): boolean {
    return !!n.orderId && n.orderId.length > 0;
  },
};
