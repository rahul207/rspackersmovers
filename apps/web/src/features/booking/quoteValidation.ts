import {
  quoteRequestSchema,
  type MoveType,
  type QuoteRequestInput,
  type VehicleType,
} from '@rs/shared';
import { todayIso } from '../../lib/format';
import {
  EMPTY_LOCATION,
  firstLocationError,
  locationErrors,
  toLocationPayload,
  type LocationDraft,
} from '../location/pincodeLocation';

export interface QuoteFormValues {
  pickup: LocationDraft;
  drop: LocationDraft;
  pickupDate: string;
  moveType: MoveType | '';
  vehicleType: VehicleType | '';
  customerName: string;
  mobile: string;
  email: string;
  notes: string;
  consent: boolean;
  website: string;
}

export type QuoteFieldName = keyof QuoteFormValues;

export const QUOTE_FIELD_NAMES: readonly QuoteFieldName[] = [
  'pickup',
  'drop',
  'pickupDate',
  'moveType',
  'vehicleType',
  'customerName',
  'mobile',
  'email',
  'notes',
  'consent',
  'website',
];

export const QUOTE_DEFAULTS: QuoteFormValues = {
  pickup: EMPTY_LOCATION,
  drop: EMPTY_LOCATION,
  pickupDate: '',
  moveType: '',
  vehicleType: '',
  customerName: '',
  mobile: '',
  email: '',
  notes: '',
  consent: false,
  website: '',
};

interface PayloadContext {
  sourcePage?: string;
  captchaToken?: string | undefined;
}

/** Shapes the form values into the request body expected by `POST /quotes`. */
export function buildQuotePayload(
  values: QuoteFormValues,
  context: PayloadContext = {},
): QuoteRequestInput {
  const payload: Record<string, unknown> = {
    pickup: toLocationPayload(values.pickup),
    drop: toLocationPayload(values.drop),
    pickupDate: values.pickupDate,
    moveType: values.moveType,
    vehicleType: values.vehicleType,
    customerName: values.customerName,
    mobile: values.mobile,
    consent: values.consent,
    website: values.website,
    sourcePage: context.sourcePage ?? '/',
  };
  if (values.email.trim()) payload.email = values.email;
  if (values.notes.trim()) payload.notes = values.notes;
  if (context.captchaToken) payload.captchaToken = context.captchaToken;
  return payload as unknown as QuoteRequestInput;
}

/** Friendlier wording than the generic schema messages for blank fields. */
export function quoteMessage(field: string, message: string, values: QuoteFormValues): string {
  switch (field) {
    case 'pickup':
      return firstLocationError(locationErrors(values.pickup)) ?? message;
    case 'drop':
      return firstLocationError(locationErrors(values.drop)) ?? message;
    case 'pickupDate':
      return values.pickupDate ? message : 'Select a pickup date';
    case 'customerName':
      return values.customerName.trim() ? message : 'Enter your name';
    case 'mobile':
      return values.mobile.trim() ? message : 'Enter your mobile number';
    default:
      return message;
  }
}

export function quoteExtraChecks(values: QuoteFormValues, today: string = todayIso()) {
  const extra: Partial<Record<QuoteFieldName, string>> = {};
  if (values.pickupDate && values.pickupDate < today) {
    extra.pickupDate = 'Pickup date cannot be in the past';
  }
  return extra;
}

export { quoteRequestSchema };
