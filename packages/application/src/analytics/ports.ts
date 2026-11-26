import type { VisitorProfile } from '@rs/domain';
import type { Purgeable } from '../shared-kernel/ports';

export interface VisitorAnalyticsRepository extends Purgeable {
  /**
   * Inserts the visitor, or updates `lastVisit` (and only that) when the visitor ID exists.
   * First visit and landing page are never overwritten.
   */
  recordVisit(profile: VisitorProfile): Promise<void>;
  ping(): Promise<void>;
}
