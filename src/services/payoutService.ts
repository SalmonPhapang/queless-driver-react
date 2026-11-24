// Port of lib/services/payout_service.dart.
//
// Paystack is only ever called server-side through the shared
// `paystack-settlements` edge function; the app never holds the secret key.

import { SupabaseConfig } from '../config/supabaseClient';
import { AppConfig } from '../config/appConfig';
import { DriverService } from './driverService';

/** A South African bank as returned by Paystack's bank list endpoint. */
export interface PaystackBank {
  name: string;
  code: string;
  longcode?: string | null;
  gateway?: string | null;
  active?: boolean | null;
  country?: string | null;
  currency?: string | null;
  type?: string | null;
}

export const PaystackBankModel = {
  fromJson(json: Record<string, unknown>): PaystackBank {
    const str = (v: unknown): string | null => (v == null ? null : String(v));
    return {
      name: String(json.name ?? ''),
      code: String(json.code ?? ''),
      longcode: str(json.longcode),
      gateway: str(json.gateway),
      active: typeof json.active === 'boolean' ? json.active : null,
      country: str(json.country),
      currency: str(json.currency),
      type: str(json.type),
    };
  },
};

export interface SettlementData {
  total_earned: number;
  settled_amount: number;
  pending_amount: number;
}

export interface BankDetails {
  account_holder?: string;
  account_number?: string;
  branch_code?: string;
  bank_name?: string;
  account_type?: string;
  [key: string]: unknown;
}

const invokeSettlements = (body: Record<string, unknown>): Promise<unknown> =>
  SupabaseConfig.edge.call('paystack-settlements', { body });

const isoRange = (from?: Date | null, to?: Date | null): Record<string, string> => ({
  ...(from ? { from: from.toISOString() } : {}),
  ...(to ? { to: to.toISOString() } : {}),
});

export const PayoutService = {
  driversTable: 'drivers',
  ordersTable: 'orders',
  customerPaymentsTable: 'payments',
  assignmentsTable: 'driver_assignments',

  /** Fetch the list of South African banks from Paystack (server-side). */
  async getBanks(): Promise<PaystackBank[]> {
    try {
      const data = await invokeSettlements({ action: 'get_banks' });
      const banks =
        data && typeof data === 'object'
          ? ((data as Record<string, unknown>).banks as unknown[] | undefined) ?? []
          : [];
      return banks.map((bank) => PaystackBankModel.fromJson(bank as Record<string, unknown>));
    } catch (error) {
      console.debug('Error fetching banks from Paystack:', error);
      throw error;
    }
  },

  /**
   * Settlement-based balance data for a driver.
   *
   * Queries Paystack's Settlement API server-side using the driver's Paystack
   * subaccount code instead of tracking earnings locally.
   */
  async getSettlementData(
    driverId: string,
    options: { from?: Date | null; to?: Date | null } = {},
  ): Promise<SettlementData> {
    try {
      const data = await invokeSettlements({
        action: 'settlement_data',
        entity_type: 'driver',
        entity_id: driverId,
        ...isoRange(options.from, options.to),
      });
      const settlement =
        data && typeof data === 'object'
          ? ((data as Record<string, unknown>).settlement as Record<string, unknown> | undefined) ?? {}
          : {};
      return {
        total_earned: Number(settlement.total_earned ?? 0),
        settled_amount: Number(settlement.settled_amount ?? 0),
        pending_amount: Number(settlement.pending_amount ?? 0),
      };
    } catch (error) {
      console.debug('Error getting settlement data:', error);
      return { total_earned: 0, settled_amount: 0, pending_amount: 0 };
    }
  },

  /** Payment references already settled to the driver's bank account. */
  async getSettledPaymentRefs(
    driverId: string,
    options: { from?: Date | null; to?: Date | null } = {},
  ): Promise<Set<string>> {
    try {
      const data = await invokeSettlements({
        action: 'settled_refs',
        entity_type: 'driver',
        entity_id: driverId,
        ...isoRange(options.from, options.to),
      });
      const refs =
        data && typeof data === 'object'
          ? ((data as Record<string, unknown>).refs as unknown[] | undefined) ?? []
          : [];
      return new Set(
        refs.filter((ref): ref is string => typeof ref === 'string' && ref.length > 0),
      );
    } catch (error) {
      console.debug('Error getting settled payment refs:', error);
      return new Set();
    }
  },

  /** Map of order_id → payment_reference for a driver's completed orders. */
  async getDriverPaymentRefs(
    driverId: string,
    options: { from?: Date | null; to?: Date | null } = {},
  ): Promise<Map<string, string>> {
    try {
      // 1. Order ids delivered by this driver.
      const { data: assignments, error: assignmentError } = await SupabaseConfig.client
        .from(PayoutService.assignmentsTable)
        .select('order_id')
        .eq('driver_id', driverId)
        .eq('status', 'delivered');
      if (assignmentError) throw assignmentError;

      const orderIds = (Array.isArray(assignments) ? assignments : [])
        .map((row) => (row as Record<string, unknown>).order_id)
        .filter((id): id is string => typeof id === 'string');
      if (orderIds.length === 0) return new Map();

      // 2. Orders with optional date filters.
      let query = SupabaseConfig.client
        .from(PayoutService.ordersTable)
        .select('id')
        .in('id', orderIds)
        .in('status', ['delivered']);
      if (options.from) query = query.gte('updated_at', options.from.toISOString());
      if (options.to) query = query.lte('updated_at', options.to.toISOString());

      const { data: ordersRes, error: ordersError } = await query;
      if (ordersError) throw ordersError;

      const deliveredIds = (Array.isArray(ordersRes) ? ordersRes : [])
        .map((row) => (row as Record<string, unknown>).id)
        .filter((id): id is string => typeof id === 'string');
      if (deliveredIds.length === 0) return new Map();

      // 3. Payments for those orders.
      const { data: paymentsRes, error: paymentsError } = await SupabaseConfig.client
        .from(PayoutService.customerPaymentsTable)
        .select('order_id, payment_reference, transaction_id')
        .in('order_id', deliveredIds)
        .in('status', ['completed', 'success']);
      if (paymentsError) throw paymentsError;

      const refMap = new Map<string, string>();
      for (const raw of Array.isArray(paymentsRes) ? paymentsRes : []) {
        const payment = raw as Record<string, unknown>;
        const orderId = String(payment.order_id ?? '');
        // Prefer payment_reference, fall back to transaction_id.
        const ref =
          payment.payment_reference != null
            ? String(payment.payment_reference)
            : payment.transaction_id != null
              ? String(payment.transaction_id)
              : null;
        if (ref) refMap.set(orderId, ref);
      }
      return refMap;
    } catch (error) {
      console.debug('Error getting driver payment refs:', error);
      return new Map();
    }
  },

  /** Order ids whose payments have been settled to the driver's bank. */
  async getSettledOrderIds(
    driverId: string,
    options: { from?: Date | null; to?: Date | null } = {},
  ): Promise<Set<string>> {
    try {
      const settledRefs = await PayoutService.getSettledPaymentRefs(driverId, options);
      if (settledRefs.size === 0) return new Set();

      const paymentRefs = await PayoutService.getDriverPaymentRefs(driverId, options);
      if (paymentRefs.size === 0) return new Set();

      const settledOrderIds = new Set<string>();
      for (const [orderId, ref] of paymentRefs.entries()) {
        if (settledRefs.has(ref)) settledOrderIds.add(orderId);
      }
      return settledOrderIds;
    } catch (error) {
      console.debug('Error getting settled order IDs:', error);
      return new Set();
    }
  },

  async saveBankDetails(
    driverId: string,
    bankDetails: BankDetails,
    options: { email?: string | null; phone?: string | null } = {},
  ): Promise<void> {
    try {
      // 1. Get the driver profile for the Paystack recipient name.
      const driver = await DriverService.getDriverProfile(driverId);
      if (!driver) throw new Error('Driver profile not found');

      const accountHolder = String(bankDetails.account_holder ?? driver.fullName ?? 'Driver');

      // 2. Create the Paystack transfer recipient server-side.
      const recipientCode = await createRecipient({
        name: accountHolder,
        accountNumber: bankDetails.account_number,
        bankCode: bankDetails.branch_code,
      });

      // 3. Create (or update) the driver's Paystack subaccount server-side.
      const percentageCharge = AppConfig.paystackSubaccountPercentageCharge;
      let subaccountCode = driver.paystackSubaccountCode ?? '';
      if (!subaccountCode) {
        subaccountCode = await createSubaccount({
          driverId,
          businessName: accountHolder,
          bankCode: bankDetails.branch_code,
          accountNumber: bankDetails.account_number,
          percentageCharge,
          email: options.email ?? undefined,
          name: accountHolder,
          phone: options.phone ?? undefined,
        });
      } else {
        try {
          await updateSubaccount({
            driverId,
            subaccountCode,
            businessName: accountHolder,
            bankCode: bankDetails.branch_code,
            accountNumber: bankDetails.account_number,
            percentageCharge,
            email: options.email ?? undefined,
            name: accountHolder,
            phone: options.phone ?? undefined,
          });
        } catch (error) {
          // The stored code may no longer exist on Paystack; recreate it so the
          // driver can always update their details.
          console.debug('Subaccount update failed, recreating...', error);
          subaccountCode = await createSubaccount({
            driverId,
            businessName: accountHolder,
            bankCode: bankDetails.branch_code,
            accountNumber: bankDetails.account_number,
            percentageCharge,
            email: options.email ?? undefined,
            name: accountHolder,
            phone: options.phone ?? undefined,
          });
        }
      }

      // 4. Persist bank details, recipient and subaccount codes.
      const { error } = await SupabaseConfig.client
        .from(PayoutService.driversTable)
        .update({
          bank_details: bankDetails,
          paystack_recipient_code: recipientCode,
          paystack_subaccount_code: subaccountCode,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', driverId);
      if (error) throw error;
    } catch (error) {
      console.debug('Error saving bank details:', error);
      throw error;
    }
  },

  async getBankDetails(driverId: string): Promise<BankDetails | null> {
    try {
      const { data, error } = await SupabaseConfig.client
        .from(PayoutService.driversTable)
        .select('bank_details')
        .eq('user_id', driverId)
        .maybeSingle();
      if (error) throw error;
      const value = (data as Record<string, unknown> | null)?.bank_details;
      return value && typeof value === 'object' ? (value as BankDetails) : null;
    } catch (error) {
      console.debug('Error getting bank details:', error);
      return null;
    }
  },
};

const createRecipient = async ({
  name,
  accountNumber,
  bankCode,
}: {
  name: string;
  accountNumber: unknown;
  bankCode: unknown;
}): Promise<string> => {
  const data = await invokeSettlements({
    action: 'create_recipient',
    name,
    account_number: accountNumber,
    bank_code: bankCode,
  });
  return data && typeof data === 'object'
    ? String((data as Record<string, unknown>).recipient_code ?? '')
    : '';
};

const createSubaccount = async ({
  driverId,
  businessName,
  bankCode,
  accountNumber,
  percentageCharge,
  email,
  name,
  phone,
}: {
  driverId: string;
  businessName: string;
  bankCode: unknown;
  accountNumber: unknown;
  percentageCharge: number;
  email?: string;
  name?: string;
  phone?: string;
}): Promise<string> => {
  const data = await invokeSettlements({
    action: 'create_subaccount',
    entity_type: 'driver',
    entity_id: driverId,
    business_name: businessName,
    bank_code: bankCode,
    account_number: accountNumber,
    percentage_charge: percentageCharge,
    ...(email ? { primary_contact_email: email } : {}),
    ...(name ? { primary_contact_name: name } : {}),
    ...(phone ? { primary_contact_phone: phone } : {}),
  });
  return data && typeof data === 'object'
    ? String((data as Record<string, unknown>).subaccount_code ?? '')
    : '';
};

const updateSubaccount = async ({
  driverId,
  subaccountCode,
  businessName,
  bankCode,
  accountNumber,
  percentageCharge,
  email,
  name,
  phone,
}: {
  driverId: string;
  subaccountCode: string;
  businessName: string;
  bankCode: unknown;
  accountNumber: unknown;
  percentageCharge: number;
  email?: string;
  name?: string;
  phone?: string;
}): Promise<void> => {
  const data = await invokeSettlements({
    action: 'update_subaccount',
    entity_type: 'driver',
    entity_id: driverId,
    subaccount_code: subaccountCode,
    business_name: businessName,
    bank_code: bankCode,
    account_number: accountNumber,
    percentage_charge: percentageCharge,
    ...(email ? { primary_contact_email: email } : {}),
    ...(name ? { primary_contact_name: name } : {}),
    ...(phone ? { primary_contact_phone: phone } : {}),
  });
  if (data && typeof data === 'object') {
    const updated = String((data as Record<string, unknown>).subaccount_code ?? '');
    if (updated && updated !== subaccountCode) {
      console.debug(`Subaccount code updated: ${subaccountCode} -> ${updated}`);
    }
  }
};
