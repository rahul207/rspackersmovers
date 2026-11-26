import { z } from 'zod';
import { singleLine } from '../sanitize';

export const PINCODE_PATTERN = /^[1-9]\d{5}$/;

export const pincodeSchema = z
  .string({ error: 'Enter your 6-digit PIN code' })
  .transform((v) => v.replace(/\s+/g, ''))
  .pipe(z.string().regex(PINCODE_PATTERN, 'Enter a valid 6-digit PIN code'));

export const LOCATION_CONFIDENCES = ['high', 'medium', 'approximate'] as const;
export type LocationConfidence = (typeof LOCATION_CONFIDENCES)[number];

const coordinate = (min: number, max: number) =>
  z
    .number({ error: 'Select your area from the list' })
    .min(min)
    .max(max)
    .transform((n) => Math.round(n * 1e6) / 1e6);

/**
 * A pickup/drop location: the area is chosen from the India Post list for a PIN code (its
 * coordinates are looked up server-side from open geocoders) and the customer types the rest of
 * the address by hand. `address` is always rebuilt here from its parts so what is stored and
 * sent on WhatsApp can never disagree with the structured fields.
 */
export const quoteLocationSchema = z
  .object({
    pincode: pincodeSchema,
    /** Post office / locality name picked from the India Post list. */
    area: singleLine(100),
    district: singleLine(100),
    state: singleLine(100),
    /** House / flat no., street, landmark - typed by the customer. */
    streetAddress: singleLine(250, 5),
    latitude: coordinate(-90, 90),
    longitude: coordinate(-180, 180),
    confidence: z.enum(LOCATION_CONFIDENCES).optional(),
  })
  .transform((l) => ({
    ...l,
    address: `${l.streetAddress}, ${l.area}, ${l.district}, ${l.state} - ${l.pincode}`,
  }));
export type QuoteLocationInput = z.input<typeof quoteLocationSchema>;
export type QuoteLocationData = z.output<typeof quoteLocationSchema>;

/** Query for resolving the coordinates of a post-office area chosen by the customer. */
export const areaQuerySchema = z.object({
  pincode: pincodeSchema,
  name: singleLine(100),
  district: singleLine(100),
  state: singleLine(100),
});
export type AreaQuery = z.output<typeof areaQuerySchema>;
