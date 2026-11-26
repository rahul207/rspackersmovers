import type { MoveType, QuoteStatus, VehicleType } from '@rs/shared';
import { PickupDateError } from '../shared-kernel/errors';
import { daysBetween } from '../shared-kernel/time';
import type { Location } from '../location/location';

export const MAX_PICKUP_DAYS_AHEAD = 365;

export interface QuoteRequest {
  referenceNumber: string;
  createdAt: Date;
  customerName: string;
  /** Normalised `91XXXXXXXXXX`. */
  mobile: string;
  email?: string | undefined;
  pickup: Location;
  drop: Location;
  distanceKm: number;
  moveType: MoveType;
  vehicleType: VehicleType;
  /** ISO date (YYYY-MM-DD) in IST. */
  pickupDate: string;
  notes?: string | undefined;
  consentReference: string;
  status: QuoteStatus;
  sourcePage: string;
}

/** Pickup must be today (IST) or later, and within the booking horizon. */
export function assertPickupDateAllowed(pickupDate: string, todayIst: string): void {
  const diff = daysBetween(todayIst, pickupDate);
  if (diff < 0) throw new PickupDateError('Pickup date cannot be in the past');
  if (diff > MAX_PICKUP_DAYS_AHEAD) {
    throw new PickupDateError(`Pickup date must be within ${MAX_PICKUP_DAYS_AHEAD} days`);
  }
}

export function createQuoteRequest(
  props: Omit<QuoteRequest, 'status'>,
  todayIst: string,
): QuoteRequest {
  assertPickupDateAllowed(props.pickupDate, todayIst);
  return { ...props, status: 'NEW' };
}
