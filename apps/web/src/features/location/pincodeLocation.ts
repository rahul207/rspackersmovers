import {
  PINCODE_PATTERN,
  sanitizeSingleLine,
  type LocationConfidence,
  type PostOfficeEntry,
  type QuoteLocationInput,
} from '@rs/shared';
import type { RouteAnimationLocation } from '../animation/RouteAnimation';

export const PINCODE_LENGTH = 6;
export const MIN_ADDRESS_LENGTH = 5;

export const PINCODE_ERROR = 'Enter a valid 6-digit PIN code';
export const AREA_ERROR = 'Choose your area from the list';
export const ADDRESS_ERROR = 'Enter the full address (house/flat, street, landmark)';

/** Everything the customer provides for one pickup or drop point. */
export interface LocationDraft {
  pincode: string;
  /** `PostOfficeEntry.id` of the chosen office, or '' when none is chosen. */
  officeId: string;
  area: string;
  district: string;
  state: string;
  /** Human-readable area line returned by the area lookup. */
  areaLabel: string;
  latitude: number | null;
  longitude: number | null;
  confidence: LocationConfidence | null;
  /** House / flat no., building, street and landmark, typed by the customer. */
  streetAddress: string;
}

export const EMPTY_LOCATION: LocationDraft = {
  pincode: '',
  officeId: '',
  area: '',
  district: '',
  state: '',
  areaLabel: '',
  latitude: null,
  longitude: null,
  confidence: null,
  streetAddress: '',
};

/** What is reset whenever the PIN code or the chosen area changes. */
export const CLEARED_AREA: Pick<
  LocationDraft,
  'officeId' | 'area' | 'district' | 'state' | 'areaLabel' | 'latitude' | 'longitude' | 'confidence'
> = {
  officeId: '',
  area: '',
  district: '',
  state: '',
  areaLabel: '',
  latitude: null,
  longitude: null,
  confidence: null,
};

/** Keeps digits only and caps the length, so letters and spaces never reach the box. */
export function sanitizePincode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, PINCODE_LENGTH);
}

export function isValidPincode(pincode: string): boolean {
  return PINCODE_PATTERN.test(pincode);
}

/** Text of a `<select>` option: the post office name first, then its branch type. */
export function officeOptionLabel(office: PostOfficeEntry): string {
  return office.branchType ? `${office.name} - ${office.branchType}` : office.name;
}

/** API path (below `/api/v1`) that resolves the coordinates of a chosen post office. */
export function areaLookupPath(office: PostOfficeEntry): string {
  const query = [
    `pincode=${encodeURIComponent(office.pincode)}`,
    `name=${encodeURIComponent(office.name)}`,
    `district=${encodeURIComponent(office.district)}`,
    `state=${encodeURIComponent(office.state)}`,
  ].join('&');
  return `/locations/area?${query}`;
}

export function officesFoundMessage(count: number): string {
  return `${count} post ${count === 1 ? 'office' : 'offices'} found. Choose your area.`;
}

export function isAreaResolved(location: LocationDraft): boolean {
  return location.area !== '' && location.latitude !== null && location.longitude !== null;
}

export interface LocationErrors {
  pincode?: string;
  area?: string;
  streetAddress?: string;
}

export function locationErrors(location: LocationDraft): LocationErrors {
  const errors: LocationErrors = {};
  const pinValid = isValidPincode(location.pincode);
  if (!pinValid) errors.pincode = PINCODE_ERROR;
  else if (!isAreaResolved(location)) errors.area = AREA_ERROR;
  if (sanitizeSingleLine(location.streetAddress).length < MIN_ADDRESS_LENGTH) {
    errors.streetAddress = ADDRESS_ERROR;
  }
  return errors;
}

/** First error in reading order, used as the single message for the whole location. */
export function firstLocationError(errors: LocationErrors): string | undefined {
  return errors.pincode ?? errors.area ?? errors.streetAddress;
}

/** Location shaped for `POST /quotes`. Unresolved coordinates are left for the schema to reject. */
export function toLocationPayload(location: LocationDraft): QuoteLocationInput {
  const payload: Record<string, unknown> = {
    pincode: location.pincode,
    area: location.area,
    district: location.district,
    state: location.state,
    streetAddress: location.streetAddress,
    latitude: location.latitude,
    longitude: location.longitude,
  };
  if (location.confidence) payload.confidence = location.confidence;
  return payload as unknown as QuoteLocationInput;
}

/** Location for the route illustration. The typed street address is never passed on. */
export function toRouteLocation(location: LocationDraft): RouteAnimationLocation | null {
  if (!isAreaResolved(location) || location.latitude === null || location.longitude === null) {
    return null;
  }
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    address: `${location.area}, ${location.district}`,
  };
}

/** Label text of the three controls, preceded by `Pickup` or `Drop`. */
export const LOCATION_LABELS = {
  pincode: 'PIN code',
  area: 'area (post office)',
  streetAddress: 'full address',
} as const;

/** DOM ids of the three controls of a pickup/drop field, given its id prefix. */
export function locationControlIds(id: string) {
  return {
    pincode: `${id}-pincode`,
    area: `${id}-area`,
    streetAddress: `${id}-address`,
  } as const;
}
