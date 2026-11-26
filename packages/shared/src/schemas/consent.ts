import { z } from 'zod';
import { singleLine } from '../sanitize';

export const consentPreferencesSchema = z.object({
  analytics: z.boolean(),
  marketing: z.boolean(),
  location: z.boolean(),
  consentVersion: singleLine(30),
  privacyNoticeVersion: singleLine(30),
});
export type ConsentPreferencesPayload = z.output<typeof consentPreferencesSchema>;

const campaignValue = z
  .string()
  .max(100)
  .transform((v) => v.replace(/[^\w .\-+%]/g, '').slice(0, 100))
  .optional();

export const analyticsEventSchema = z.object({
  type: z.literal('page_view'),
  /** Path only. Query strings and fragments are discarded server-side. */
  path: z.string().max(300),
  referrer: z.string().max(500).optional(),
  language: z.string().max(35).optional(),
  utm: z
    .object({ source: campaignValue, medium: campaignValue, campaign: campaignValue })
    .optional(),
});
export type AnalyticsEventPayload = z.output<typeof analyticsEventSchema>;
