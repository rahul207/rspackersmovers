import type { ContactRequest } from '@rs/domain';
import type { Purgeable } from '../shared-kernel/ports';

export interface ContactRequestRepository extends Purgeable {
  save(request: ContactRequest): Promise<void>;
  existsById(requestId: string): Promise<boolean>;
  ping(): Promise<void>;
}
