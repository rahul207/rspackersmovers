export const MOVE_TYPES = [
  'LOCAL_HOUSEHOLD',
  'INTERCITY_HOUSEHOLD',
  'OFFICE_RELOCATION',
  'VEHICLE_TRANSPORT',
  'COURIER_PARCEL',
  'COMMERCIAL_GOODS',
] as const;
export type MoveType = (typeof MOVE_TYPES)[number];

export const MOVE_TYPE_LABELS: Record<MoveType, string> = {
  LOCAL_HOUSEHOLD: 'Local household shifting',
  INTERCITY_HOUSEHOLD: 'Intercity household shifting',
  OFFICE_RELOCATION: 'Office relocation',
  VEHICLE_TRANSPORT: 'Vehicle transportation',
  COURIER_PARCEL: 'Courier or parcel delivery',
  COMMERCIAL_GOODS: 'Commercial goods movement',
};

export const VEHICLE_TYPES = [
  'TWO_WHEELER',
  'THREE_WHEELER',
  'TATA_ACE',
  'PICKUP_TRUCK',
  'TRUCK_14FT',
  'TRUCK_17FT',
  'TRUCK_20FT',
  'CONTAINER_TRUCK',
] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  TWO_WHEELER: 'Two-wheeler delivery',
  THREE_WHEELER: 'Three-wheeler cargo',
  TATA_ACE: 'Tata Ace or mini truck',
  PICKUP_TRUCK: 'Pickup truck',
  TRUCK_14FT: '14-foot truck',
  TRUCK_17FT: '17-foot truck',
  TRUCK_20FT: '20-foot truck',
  CONTAINER_TRUCK: 'Container truck',
};

export const CONTACT_METHODS = ['PHONE_CALL', 'WHATSAPP', 'EMAIL'] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];

export const CONTACT_METHOD_LABELS: Record<ContactMethod, string> = {
  PHONE_CALL: 'Phone call',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
};

export const QUOTE_STATUSES = ['NEW', 'CONTACTED', 'CONFIRMED', 'CANCELLED', 'CLOSED'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const CONTACT_STATUSES = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'SPAM'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

/** Bump when the wording or the categories of the cookie/consent banner change. */
export const CONSENT_VERSION = '2026-01';
/** Bump when the privacy notice changes. Final wording needs legal review. */
export const PRIVACY_NOTICE_VERSION = '2026-01-draft';

export const CONSENT_PURPOSES = ['COOKIE_PREFERENCES', 'QUOTATION', 'CONTACT'] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'CSRF_INVALID',
  'RATE_LIMITED',
  'NOT_FOUND',
  'CAPTCHA_FAILED',
  'SUBMISSION_REJECTED',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'STORAGE_UNAVAILABLE',
  'UPSTREAM_UNAVAILABLE',
  'FEATURE_DISABLED',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const CSRF_HEADER = 'x-csrf-token';
export const IDEMPOTENCY_HEADER = 'idempotency-key';
export const CORRELATION_HEADER = 'x-correlation-id';
