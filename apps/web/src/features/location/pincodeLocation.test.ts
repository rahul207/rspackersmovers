import { describe, expect, it } from 'vitest';
import {
  EMPTY_LOCATION,
  areaLookupPath,
  locationErrors,
  officeOptionLabel,
  officesFoundMessage,
  sanitizePincode,
  toLocationPayload,
  toRouteLocation,
  type LocationDraft,
} from './pincodeLocation';

const office = {
  id: '751002:Old Town (Khorda)',
  name: 'Old Town (Khorda)',
  pincode: '751002',
  branchType: 'Sub Post Office',
  district: 'Khorda',
  state: 'Odisha',
};

const resolved: LocationDraft = {
  ...EMPTY_LOCATION,
  pincode: '400053',
  officeId: '400053:Andheri West',
  area: 'Andheri West',
  district: 'Mumbai',
  state: 'Maharashtra',
  areaLabel: 'Andheri West, Mumbai, Maharashtra - 400053',
  latitude: 19.1364,
  longitude: 72.8296,
  confidence: 'approximate',
  streetAddress: 'Flat 12, Sea View Apartments',
};

describe('sanitizePincode', () => {
  it('strips non-digits and caps at six digits', () => {
    expect(sanitizePincode('40 00-53a')).toBe('400053');
    expect(sanitizePincode('12345678')).toBe('123456');
    expect(sanitizePincode('abc')).toBe('');
  });
});

describe('office helpers', () => {
  it('starts the option label with the post office name', () => {
    expect(officeOptionLabel(office)).toBe('Old Town (Khorda) - Sub Post Office');
    const plain = {
      id: office.id,
      name: office.name,
      pincode: '751002',
      district: 'Khorda',
      state: 'Odisha',
    };
    expect(officeOptionLabel(plain)).toBe('Old Town (Khorda)');
  });

  it('url-encodes every value of the area lookup', () => {
    expect(areaLookupPath(office)).toBe(
      '/locations/area?pincode=751002&name=Old%20Town%20(Khorda)&district=Khorda&state=Odisha',
    );
  });

  it('words the result count', () => {
    expect(officesFoundMessage(2)).toBe('2 post offices found. Choose your area.');
    expect(officesFoundMessage(1)).toBe('1 post office found. Choose your area.');
  });
});

describe('location payloads', () => {
  it('sends the structured location without a combined address', () => {
    expect(toLocationPayload(resolved)).toEqual({
      pincode: '400053',
      area: 'Andheri West',
      district: 'Mumbai',
      state: 'Maharashtra',
      streetAddress: 'Flat 12, Sea View Apartments',
      latitude: 19.1364,
      longitude: 72.8296,
      confidence: 'approximate',
    });
  });

  it('gives the animation the area, never the typed street address', () => {
    expect(toRouteLocation(resolved)).toEqual({
      latitude: 19.1364,
      longitude: 72.8296,
      address: 'Andheri West, Mumbai',
    });
    expect(toRouteLocation({ ...resolved, latitude: null })).toBeNull();
  });

  it('reports the missing step', () => {
    expect(locationErrors(EMPTY_LOCATION)).toEqual({
      pincode: 'Enter a valid 6-digit PIN code',
      streetAddress: 'Enter the full address (house/flat, street, landmark)',
    });
    expect(locationErrors({ ...resolved, latitude: null }).area).toBe(
      'Choose your area from the list',
    );
    expect(locationErrors(resolved)).toEqual({});
  });
});
