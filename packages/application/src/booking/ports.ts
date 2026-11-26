import type { QuoteRequest } from '@rs/domain';
import type { Purgeable } from '../shared-kernel/ports';

export interface QuoteRepository extends Purgeable {
  /** Must throw DuplicateReferenceError when the reference already exists. */
  save(quote: QuoteRequest): Promise<void>;
  existsByReference(referenceNumber: string): Promise<boolean>;
  /** Cheap health probe used by the readiness endpoint. */
  ping(): Promise<void>;
}
