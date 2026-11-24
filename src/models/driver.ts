import { DriverStatus, DriverStatusX } from './statuses';

/** Port of lib/models/driver_model.dart (the `drivers` table row). */
export interface Driver {
  /** drivers.id (primary key). */
  id: string;
  /** drivers.user_id — the Supabase auth user id. Most driver APIs key on this. */
  userId: string;
  email?: string | null;
  fullName?: string | null;
  fcmToken?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleColor?: string | null;
  vehiclePlate?: string | null;
  vehicleType?: string | null;
  imageUrl?: string | null;
  driverStatus: DriverStatus;
  contactNumber?: string | null;
  idNumber?: string | null;
  location?: string | null;
  isVerified: boolean;
  bankDetails?: Record<string, unknown> | null;
  paystackRecipientCode?: string | null;
  paystackSubaccountCode?: string | null;
  roleType: string;
}

export const DriverModel = {
  fromJson(json: Record<string, unknown>): Driver {
    const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
    return {
      id: String(json.id ?? json.user_id ?? ''),
      userId: String(json.user_id ?? json.id ?? ''),
      email: str(json.email),
      fullName: str(json.full_name),
      fcmToken: str(json.fcm_token),
      vehicleMake: str(json.vehicle_make),
      vehicleModel: str(json.vehicle_model),
      vehicleColor: str(json.vehicle_color),
      vehiclePlate: str(json.vehicle_plate),
      vehicleType: str(json.vehicle_type),
      imageUrl: str(json.image_url),
      driverStatus: DriverStatusX.fromDatabaseValue(str(json.status), 'offline'),
      contactNumber: str(json.contact_number),
      idNumber: str(json.id_number),
      location: str(json.location),
      isVerified: json.is_verified === true,
      bankDetails:
        json.bank_details && typeof json.bank_details === 'object'
          ? (json.bank_details as Record<string, unknown>)
          : null,
      paystackRecipientCode: str(json.paystack_recipient_code),
      paystackSubaccountCode: str(json.paystack_subaccount_code),
      roleType: str(json.role_type) ?? 'driver',
    };
  },

  toJson(driver: Driver): Record<string, unknown> {
    return {
      id: driver.id,
      ...(driver.email != null ? { email: driver.email } : {}),
      ...(driver.fullName != null ? { full_name: driver.fullName } : {}),
      ...(driver.fcmToken != null ? { fcm_token: driver.fcmToken } : {}),
      ...(driver.vehicleMake != null ? { vehicle_make: driver.vehicleMake } : {}),
      ...(driver.vehicleModel != null ? { vehicle_model: driver.vehicleModel } : {}),
      ...(driver.vehicleColor != null ? { vehicle_color: driver.vehicleColor } : {}),
      ...(driver.vehiclePlate != null ? { vehicle_plate: driver.vehiclePlate } : {}),
      ...(driver.vehicleType != null ? { vehicle_type: driver.vehicleType } : {}),
      ...(driver.imageUrl != null ? { image_url: driver.imageUrl } : {}),
      status: driver.driverStatus,
      ...(driver.contactNumber != null ? { contact_number: driver.contactNumber } : {}),
      ...(driver.idNumber != null ? { id_number: driver.idNumber } : {}),
      ...(driver.location != null ? { location: driver.location } : {}),
      is_verified: driver.isVerified,
      ...(driver.bankDetails != null ? { bank_details: driver.bankDetails } : {}),
      ...(driver.paystackRecipientCode != null
        ? { paystack_recipient_code: driver.paystackRecipientCode }
        : {}),
      ...(driver.paystackSubaccountCode != null
        ? { paystack_subaccount_code: driver.paystackSubaccountCode }
        : {}),
      role_type: driver.roleType,
    };
  },
};
