import { DriverAssignmentStatus } from './statuses';
import { Driver, DriverModel } from './driver';

/** Port of queless_core/lib/models/driver_assignment.dart. */
export interface DriverAssignmentModel {
  id: string;
  orderId: string;
  driverId: string;
  status: string;
  notes?: string | null;
  currentLat?: number | null;
  currentLng?: number | null;
  lastLocationUpdate?: Date | null;
  locationAccuracy?: number | null;
  locationSpeed?: number | null;
  locationHeading?: number | null;
  acceptedAt?: Date | null;
  pickedUpAt?: Date | null;
  deliveredAt?: Date | null;
  cancelledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  driver?: Driver | null;
  /** Phase B — dispatch offer timeout. */
  offerExpiresAt?: Date | null;
  timeoutSeconds?: number | null;
}

const asDouble = (value: unknown): number | undefined => {
  if (typeof value === 'number') return value;
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const asDateTime = (value: unknown): Date | undefined => {
  if (value instanceof Date) return value;
  if (value === null || value === undefined) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const DriverAssignment = {
  fromJson(json: Record<string, unknown>): DriverAssignmentModel {
    const driverData =
      json.drivers && typeof json.drivers === 'object'
        ? (json.drivers as Record<string, unknown>)
        : null;

    return {
      id: String(json.id ?? ''),
      orderId: String(json.order_id ?? ''),
      driverId: String(json.driver_id ?? ''),
      status: String(json.status ?? 'assigned'),
      notes: json.notes == null ? null : String(json.notes),
      currentLat: asDouble(json.current_lat),
      currentLng: asDouble(json.current_lng),
      lastLocationUpdate: asDateTime(json.last_location_update),
      locationAccuracy: asDouble(json.location_accuracy),
      locationSpeed: asDouble(json.location_speed),
      locationHeading: asDouble(json.location_heading),
      acceptedAt: asDateTime(json.accepted_at),
      pickedUpAt: asDateTime(json.picked_up_at),
      deliveredAt: asDateTime(json.delivered_at),
      cancelledAt: asDateTime(json.cancelled_at),
      createdAt: asDateTime(json.created_at) ?? new Date(),
      updatedAt: asDateTime(json.updated_at) ?? new Date(),
      driver: driverData ? DriverModel.fromJson(driverData) : null,
      offerExpiresAt: asDateTime(json.offer_expires_at),
      timeoutSeconds:
        json.timeout_seconds == null ? null : Number(json.timeout_seconds),
    };
  },

  hasLiveLocation(assignment: DriverAssignmentModel): boolean {
    return assignment.currentLat != null && assignment.currentLng != null;
  },

  isOfferedStatus(assignment: DriverAssignmentModel): boolean {
    return assignment.status.toLowerCase() === DriverAssignmentStatus.offered;
  },

  isExpiredOfferStatus(assignment: DriverAssignmentModel): boolean {
    return assignment.status.toLowerCase() === DriverAssignmentStatus.expired;
  },

  isDeclinedOfferStatus(assignment: DriverAssignmentModel): boolean {
    return assignment.status.toLowerCase() === DriverAssignmentStatus.declined;
  },

  isClosedOfferStatus(assignment: DriverAssignmentModel): boolean {
    return DriverAssignment.isExpiredOfferStatus(assignment) || DriverAssignment.isDeclinedOfferStatus(assignment);
  },

  isPendingOffer(assignment: DriverAssignmentModel): boolean {
    return DriverAssignment.isOfferedStatus(assignment) && assignment.offerExpiresAt != null;
  },

  /** Milliseconds left on the offer (negative once past due), or null. */
  offerRemainingAt(assignment: DriverAssignmentModel, now: Date = new Date()): number | null {
    if (!assignment.offerExpiresAt) return null;
    return assignment.offerExpiresAt.getTime() - now.getTime();
  },

  offerRemaining(assignment: DriverAssignmentModel): number | null {
    return DriverAssignment.offerRemainingAt(assignment, new Date());
  },

  isOfferExpiredAt(assignment: DriverAssignmentModel, now: Date): boolean {
    if (!assignment.offerExpiresAt) return false;
    return now.getTime() >= assignment.offerExpiresAt.getTime();
  },

  isOfferExpired(assignment: DriverAssignmentModel): boolean {
    return DriverAssignment.isOfferExpiredAt(assignment, new Date());
  },

  canRespondToOfferAt(assignment: DriverAssignmentModel, now: Date): boolean {
    return DriverAssignment.isPendingOffer(assignment) && !DriverAssignment.isOfferExpiredAt(assignment, now);
  },

  canRespondToOffer(assignment: DriverAssignmentModel): boolean {
    return DriverAssignment.canRespondToOfferAt(assignment, new Date());
  },
};
