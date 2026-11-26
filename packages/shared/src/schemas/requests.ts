import { z } from 'zod';
import { CONTACT_METHODS, MOVE_TYPES, VEHICLE_TYPES } from '../constants';
import { multiline, optionalText, singleLine } from '../sanitize';
import { normalizeIndianMobile } from '../phone';
import { quoteLocationSchema } from './location';

export const mobileSchema = z.string({ error: 'Enter your mobile number' }).transform((v, ctx) => {
  const normalized = normalizeIndianMobile(v);
  if (!normalized) {
    ctx.issues.push({
      code: 'custom',
      message: 'Enter a valid 10-digit Indian mobile number',
      input: v,
    });
    return z.NEVER;
  }
  return normalized;
});

export const emailSchema = z
  .string()
  .transform((v) => v.normalize('NFKC').trim())
  .pipe(z.email({ error: 'Enter a valid email address' }).max(254));

export const optionalEmailSchema = optionalText(emailSchema);

export const sourcePageSchema = z
  .string()
  .max(200)
  .transform((v) => v.split(/[?#]/)[0] ?? '/')
  .pipe(z.string().regex(/^\/[A-Za-z0-9/_\-.]*$/, 'Invalid page path'))
  .default('/');

export const consentGivenSchema = z.literal(true, {
  error: 'Please confirm your consent to continue',
});

export const moveTypeSchema = z.enum(MOVE_TYPES, { error: 'Select a move type' });
export const vehicleTypeSchema = z.enum(VEHICLE_TYPES, { error: 'Select a vehicle type' });

/** Bot-protection fields shared by every public form. */
export const botProtectionShape = {
  /** Honeypot: real users never see or fill this field. */
  website: z.string().max(200).optional(),
  captchaToken: z.string().max(4096).optional(),
};

export const pickupDateSchema = z.iso.date({ error: 'Select a valid pickup date' });

export const quoteRequestSchema = z.object({
  pickup: quoteLocationSchema,
  drop: quoteLocationSchema,
  pickupDate: pickupDateSchema,
  moveType: moveTypeSchema,
  vehicleType: vehicleTypeSchema,
  customerName: singleLine(80, 2),
  mobile: mobileSchema,
  email: optionalEmailSchema,
  notes: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    multiline(1000).optional(),
  ),
  consent: consentGivenSchema,
  sourcePage: sourcePageSchema,
  ...botProtectionShape,
});
export type QuoteRequestPayload = z.output<typeof quoteRequestSchema>;
export type QuoteRequestInput = z.input<typeof quoteRequestSchema>;

export const contactRequestSchema = z
  .object({
    name: singleLine(80, 2),
    mobile: mobileSchema,
    email: optionalEmailSchema,
    subject: singleLine(120, 3),
    message: multiline(2000, 10),
    preferredContactMethod: z.enum(CONTACT_METHODS, { error: 'Select a contact method' }),
    consent: consentGivenSchema,
    sourcePage: sourcePageSchema,
    ...botProtectionShape,
  })
  .refine((v) => v.preferredContactMethod !== 'EMAIL' || v.email !== undefined, {
    message: 'Enter an email address to be contacted by email',
    path: ['email'],
  });
export type ContactRequestPayload = z.output<typeof contactRequestSchema>;
export type ContactRequestInput = z.input<typeof contactRequestSchema>;
