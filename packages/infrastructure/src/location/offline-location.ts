import type { AreaGeocoder, PincodeDirectory } from '@rs/application';
import type { AreaQuery, PostOfficeEntry, ResolvedArea } from '@rs/shared';

/**
 * OFFLINE FIXTURES - for local development and automated tests only (`LOCATION_LOOKUP=offline`).
 * These are a handful of illustrative entries, not real directory data, and they never touch
 * the network so tests are fast and deterministic.
 */
interface FixtureOffice {
  name: string;
  branchType: string;
  deliveryStatus: string;
  block?: string;
  district: string;
  state: string;
  latitude: number;
  longitude: number;
}

const FIXTURES: Record<string, FixtureOffice[]> = {
  '400053': [
    {
      name: 'Andheri West',
      branchType: 'Sub Post Office',
      deliveryStatus: 'Delivery',
      district: 'Mumbai',
      state: 'Maharashtra',
      latitude: 19.1364,
      longitude: 72.8296,
    },
    {
      name: 'Versova',
      branchType: 'Sub Post Office',
      deliveryStatus: 'Delivery',
      district: 'Mumbai',
      state: 'Maharashtra',
      latitude: 19.1317,
      longitude: 72.8112,
    },
  ],
  '411001': [
    {
      name: 'Pune City',
      branchType: 'Sub Post Office',
      deliveryStatus: 'Delivery',
      district: 'Pune',
      state: 'Maharashtra',
      latitude: 18.5196,
      longitude: 73.8553,
    },
    {
      name: 'Pune GPO',
      branchType: 'Head Post Office',
      deliveryStatus: 'Delivery',
      district: 'Pune',
      state: 'Maharashtra',
      latitude: 18.5204,
      longitude: 73.8567,
    },
  ],
  '751002': [
    {
      name: 'Old Town (Khorda)',
      branchType: 'Sub Post Office',
      deliveryStatus: 'Delivery',
      block: 'Bhubaneswar',
      district: 'Khorda',
      state: 'Odisha',
      latitude: 20.2396,
      longitude: 85.8381,
    },
    {
      name: 'Sundarpada',
      branchType: 'Branch Post Office',
      deliveryStatus: 'Delivery',
      block: 'Bhubaneswar',
      district: 'Khorda',
      state: 'Odisha',
      latitude: 20.2146,
      longitude: 85.8043,
    },
  ],
  '560034': [
    {
      name: 'Koramangala',
      branchType: 'Sub Post Office',
      deliveryStatus: 'Delivery',
      district: 'Bengaluru',
      state: 'Karnataka',
      latitude: 12.9352,
      longitude: 77.6245,
    },
    {
      name: 'Ejipura',
      branchType: 'Branch Post Office',
      deliveryStatus: 'Delivery',
      district: 'Bengaluru',
      state: 'Karnataka',
      latitude: 12.9442,
      longitude: 77.6321,
    },
  ],
  '110001': [
    {
      name: 'Connaught Place',
      branchType: 'Sub Post Office',
      deliveryStatus: 'Delivery',
      district: 'New Delhi',
      state: 'Delhi',
      latitude: 28.6315,
      longitude: 77.2167,
    },
    {
      name: 'Parliament Street',
      branchType: 'Sub Post Office',
      deliveryStatus: 'Delivery',
      district: 'New Delhi',
      state: 'Delhi',
      latitude: 28.6228,
      longitude: 77.2108,
    },
  ],
};

export class OfflinePincodeDirectory implements PincodeDirectory {
  lookup(pincode: string): Promise<PostOfficeEntry[]> {
    const offices = (FIXTURES[pincode] ?? []).map((o): PostOfficeEntry => ({
      id: `${pincode}:${o.name}`,
      name: o.name,
      pincode,
      branchType: o.branchType,
      deliveryStatus: o.deliveryStatus,
      ...(o.block ? { block: o.block } : {}),
      district: o.district,
      state: o.state,
    }));
    return Promise.resolve(offices);
  }
}

export class OfflineAreaGeocoder implements AreaGeocoder {
  locate(query: AreaQuery): Promise<ResolvedArea | null> {
    const office = (FIXTURES[query.pincode] ?? []).find((o) => o.name === query.name);
    if (!office) return Promise.resolve(null);
    return Promise.resolve({
      pincode: query.pincode,
      name: office.name,
      district: office.district,
      state: office.state,
      areaLabel: `${office.name}, ${office.district}, ${office.state} - ${query.pincode}`,
      latitude: office.latitude,
      longitude: office.longitude,
      confidence: 'high',
      source: 'offline',
    });
  }
}
