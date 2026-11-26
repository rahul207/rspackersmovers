import type { ConsentRecord } from '@rs/domain';
import type { Purgeable } from '../shared-kernel/ports';

export interface ConsentRepository extends Purgeable {
  save(record: ConsentRecord): Promise<void>;
  ping(): Promise<void>;
}
