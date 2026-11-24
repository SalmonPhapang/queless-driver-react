// Port of lib/services/driver_service.dart.

import { SupabaseConfig } from '../config/supabaseClient';
import { Driver, DriverModel } from '../models/driver';
import { PushService } from './pushService';

const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });

export const DriverService = {
  table: 'drivers',

  async ensureDriverProfile({ authUserId }: { authUserId: string }): Promise<void> {
    // First ensure the user exists in public.users.
    await SupabaseConfig.client.from('users').upsert(
      {
        id: authUserId,
        email: SupabaseConfig.currentUser?.email ?? '',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

    // Then ensure the driver record exists.
    await SupabaseConfig.client.from(DriverService.table).upsert(
      {
        user_id: authUserId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
  },

  async getDriverProfile(id: string): Promise<Driver | null> {
    try {
      const { data, error } = await withTimeout<{
        data: Record<string, unknown> | null;
        error: { message: string } | null;
      }>(
        Promise.resolve(
          SupabaseConfig.client.from(DriverService.table).select('*').eq('user_id', id).maybeSingle(),
        ) as Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>,
        10_000,
        'Driver profile request',
      );
      if (error) throw error;
      if (!data) return null;
      return DriverModel.fromJson(data as Record<string, unknown>);
    } catch (error) {
      console.debug('Error fetching driver profile:', error);
      throw error;
    }
  },

  /**
   * Kept for callers that only want "this device is reachable": registration
   * (token row + driver topics) is the shared PushService.registerDriver.
   */
  async updateFCMToken(id: string): Promise<void> {
    await PushService.registerDriver(id);
  },

  async saveProfile({
    id,
    fullName,
    vehicleMake,
    vehicleModel,
    vehicleColor,
    vehiclePlate,
    vehicleType,
    imageUrl,
    contactNumber,
    idNumber,
    location,
    resetVerification = false,
  }: {
    id: string;
    fullName?: string;
    vehicleMake?: string;
    vehicleModel?: string;
    vehicleColor?: string;
    vehiclePlate?: string;
    vehicleType?: string;
    imageUrl?: string;
    contactNumber?: string;
    idNumber?: string;
    location?: string;
    resetVerification?: boolean;
  }): Promise<void> {
    const updates: Record<string, unknown> = {
      user_id: id,
      updated_at: new Date().toISOString(),
    };

    // Only include non-null values so partial updates don't overwrite
    // existing data with nulls.
    if (fullName != null) updates.full_name = fullName;
    if (vehicleMake != null) updates.vehicle_make = vehicleMake;
    if (vehicleModel != null) updates.vehicle_model = vehicleModel;
    if (vehicleColor != null) updates.vehicle_color = vehicleColor;
    if (vehiclePlate != null) updates.vehicle_plate = vehiclePlate;
    if (vehicleType != null) updates.vehicle_type = vehicleType;
    if (imageUrl != null) updates.image_url = imageUrl;
    if (contactNumber != null) updates.contact_number = contactNumber;
    if (idNumber != null) updates.id_number = idNumber;
    if (location != null) updates.location = location;
    if (resetVerification) updates.is_verified = false;

    const { error } = await SupabaseConfig.client
      .from(DriverService.table)
      .upsert(updates, { onConflict: 'user_id' });
    if (error) throw error;
  },

  async updateOnlineStatus(id: string, isOnline: boolean): Promise<void> {
    const { error } = await SupabaseConfig.client
      .from(DriverService.table)
      .update({
        status: isOnline ? 'online' : 'offline',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', id);
    if (error) throw error;
  },

  async uploadProfileImage(userId: string, image: File): Promise<string> {
    const fileName = `${userId}_${Date.now()}.png`;
    const path = `driver/${fileName}`;
    const bucket = SupabaseConfig.client.storage.from('driver');
    const { error } = await bucket.upload(path, image, { contentType: image.type || 'image/png' });
    if (error) throw error;
    return bucket.getPublicUrl(path).data.publicUrl;
  },
};
