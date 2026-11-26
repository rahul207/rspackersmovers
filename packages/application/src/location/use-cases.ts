import type { AreaQuery, PincodeLookup, ResolvedArea } from '@rs/shared';
import { ApplicationError } from '../shared-kernel/ports';
import type { AreaGeocoder, PincodeDirectory } from './ports';

/** Step 1 of the location flow: the customer types a PIN code and gets its post offices. */
export class LookupPincode {
  constructor(private readonly directory: PincodeDirectory) {}

  async execute(pincode: string, signal?: AbortSignal): Promise<PincodeLookup> {
    const offices = await this.directory.lookup(pincode, signal);
    return { pincode, offices };
  }
}

/** Step 2: the customer picked a post office; find where it is. */
export class ResolveArea {
  constructor(private readonly geocoder: AreaGeocoder) {}

  async execute(query: AreaQuery, signal?: AbortSignal): Promise<ResolvedArea> {
    const area = await this.geocoder.locate(query, signal);
    if (!area) {
      throw new ApplicationError(
        'UPSTREAM_UNAVAILABLE',
        'We could not find this area on the map right now. Please try again in a moment.',
      );
    }
    return area;
  }
}
