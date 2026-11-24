/** Port of lib/models/driver_payment_model.dart. */
export interface DriverPayment {
  id: string;
  driverId: string;
  orderId: string;
  payoutId?: string | null;
  amount: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export const DriverPaymentModel = {
  fromJson(json: Record<string, unknown>): DriverPayment {
    return {
      id: String(json.id ?? ''),
      driverId: String(json.driver_id ?? ''),
      orderId: String(json.order_id ?? ''),
      payoutId: json.payout_id == null ? null : String(json.payout_id),
      amount: Number(json.amount ?? 0),
      status: String(json.status ?? ''),
      createdAt: new Date(String(json.created_at ?? '')),
      updatedAt: new Date(String(json.updated_at ?? '')),
    };
  },

  toJson(p: DriverPayment): Record<string, unknown> {
    return {
      id: p.id,
      driver_id: p.driverId,
      order_id: p.orderId,
      ...(p.payoutId != null ? { payout_id: p.payoutId } : {}),
      amount: p.amount,
      status: p.status,
      created_at: p.createdAt.toISOString(),
      updated_at: p.updatedAt.toISOString(),
    };
  },
};
