import type { Clock, Logger, Purgeable } from './ports';

export interface PurgeResult {
  quotes: number;
  contacts: number;
  consents: number;
  visitors: number;
}

/** Applies the configured retention period to every personal-data store. */
export class PurgeExpiredData {
  constructor(
    private readonly deps: {
      quotes: Purgeable;
      contacts: Purgeable;
      consents: Purgeable;
      visitors: Purgeable;
      clock: Clock;
      logger: Logger;
      retentionDays: number;
    },
  ) {}

  async execute(): Promise<PurgeResult> {
    const cutoff = new Date(this.deps.clock.now().getTime() - this.deps.retentionDays * 86_400_000);
    const result: PurgeResult = {
      quotes: await this.deps.quotes.deleteOlderThan(cutoff),
      contacts: await this.deps.contacts.deleteOlderThan(cutoff),
      consents: await this.deps.consents.deleteOlderThan(cutoff),
      visitors: await this.deps.visitors.deleteOlderThan(cutoff),
    };
    this.deps.logger.info('retention.purge', { ...result, retentionDays: this.deps.retentionDays });
    return result;
  }
}
