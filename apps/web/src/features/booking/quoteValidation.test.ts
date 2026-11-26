import { describe, expect, it } from 'vitest';
import { quoteRequestSchema } from '@rs/shared';
import { createSchemaResolver } from '../../lib/schemaResolver';
import {
  QUOTE_DEFAULTS,
  buildQuotePayload,
  quoteExtraChecks,
  quoteMessage,
  type QuoteFormValues,
} from './quoteValidation';

import { EMPTY_LOCATION, type LocationDraft } from '../location/pincodeLocation';

const pickup: LocationDraft = {
  pincode: '400053',
  officeId: '400053:Andheri West',
  area: 'Andheri West',
  district: 'Mumbai',
  state: 'Maharashtra',
  areaLabel: 'Andheri West, Mumbai, Maharashtra - 400053',
  latitude: 19.1364,
  longitude: 72.8296,
  confidence: 'high',
  streetAddress: 'Flat 12, Sea View Apartments, Lokhandwala Road',
};

const valid: QuoteFormValues = {
  ...QUOTE_DEFAULTS,
  pickup,
  drop: {
    ...pickup,
    pincode: '411001',
    officeId: '411001:Pune City',
    area: 'Pune City',
    district: 'Pune',
    latitude: 18.5196,
    longitude: 73.8553,
    streetAddress: '5 Example Road, near City Mall',
  },
  pickupDate: '2999-01-01',
  moveType: 'LOCAL_HOUSEHOLD',
  vehicleType: 'TATA_ACE',
  customerName: 'Asha Test',
  mobile: '98765 43210',
  consent: true,
};

const resolver = createSchemaResolver<QuoteFormValues>(quoteRequestSchema, {
  toPayload: (values) => buildQuotePayload(values),
  extra: (values) => quoteExtraChecks(values, '2026-06-01'),
  messages: quoteMessage,
});
const context = undefined as never;
const options = { fields: {}, shouldUseNativeValidation: false } as never;

describe('quote validation', () => {
  it('accepts a complete form', async () => {
    const result = await resolver(valid, context, options);
    expect(result.errors).toEqual({});
  });

  it('asks for a valid PIN code first, then the area, then the address', async () => {
    const badPin = await resolver(
      { ...valid, pickup: { ...pickup, pincode: '4000' } },
      context,
      options,
    );
    expect(badPin.errors).toHaveProperty('pickup.message', 'Enter a valid 6-digit PIN code');

    const noArea = await resolver(
      { ...valid, drop: { ...EMPTY_LOCATION, pincode: '411001', streetAddress: 'x' } },
      context,
      options,
    );
    expect(noArea.errors).toHaveProperty('drop.message', 'Choose your area from the list');

    const shortAddress = await resolver(
      { ...valid, pickup: { ...pickup, streetAddress: ' ab ' } },
      context,
      options,
    );
    expect(shortAddress.errors).toHaveProperty(
      'pickup.message',
      'Enter the full address (house/flat, street, landmark)',
    );
  });

  it('requires consent and rejects past pickup dates', async () => {
    const result = await resolver(
      { ...valid, consent: false, pickupDate: '2020-01-01' },
      context,
      options,
    );
    expect(result.errors).toHaveProperty('consent');
    expect(result.errors).toHaveProperty('pickupDate.message', 'Pickup date cannot be in the past');
  });

  it('only sends optional fields that were filled in', () => {
    const payload = buildQuotePayload(valid, { sourcePage: '/' }) as Record<string, unknown>;
    expect(payload).not.toHaveProperty('email');
    expect(payload).not.toHaveProperty('notes');
    expect(payload.website).toBe('');
  });
});
