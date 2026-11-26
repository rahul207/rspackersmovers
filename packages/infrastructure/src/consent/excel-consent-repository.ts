import type { ConsentRepository } from '@rs/application';
import type { ConsentRecord } from '@rs/domain';
import { WorkbookStore, type ColumnDef, type WorkbookStoreOptions } from '../excel/workbook-store';

export const CONSENT_COLUMNS: readonly ColumnDef[] = [
  { key: 'consentId', header: 'Consent ID', width: 38 },
  { key: 'timestamp', header: 'Timestamp', width: 26 },
  { key: 'visitorId', header: 'Anonymous visitor ID', width: 38 },
  { key: 'purpose', header: 'Purpose', width: 20 },
  { key: 'consentVersion', header: 'Consent version', width: 16 },
  { key: 'necessary', header: 'Necessary cookies', width: 18 },
  { key: 'analytics', header: 'Analytics cookies', width: 18 },
  { key: 'marketing', header: 'Marketing cookies', width: 18 },
  { key: 'location', header: 'Location processing', width: 20 },
  { key: 'privacyNoticeVersion', header: 'Privacy notice version', width: 22 },
];

const status = (granted: boolean) => (granted ? 'GRANTED' : 'DENIED');

export class ExcelConsentRepository implements ConsentRepository {
  private readonly store: WorkbookStore;

  constructor(options: Omit<WorkbookStoreOptions, 'columns' | 'sheetName'>) {
    this.store = new WorkbookStore({
      ...options,
      sheetName: 'Consent records',
      columns: CONSENT_COLUMNS,
    });
  }

  save(r: ConsentRecord): Promise<void> {
    return this.store.transact((tx) => {
      tx.append({
        consentId: r.consentId,
        timestamp: r.timestamp.toISOString(),
        visitorId: r.visitorId || null,
        purpose: r.purpose,
        consentVersion: r.consentVersion,
        necessary: 'GRANTED',
        analytics: status(r.analytics),
        marketing: status(r.marketing),
        location: status(r.location),
        privacyNoticeVersion: r.privacyNoticeVersion,
      });
    });
  }

  deleteOlderThan(cutoff: Date): Promise<number> {
    return this.store.transact((tx) =>
      tx.deleteWhere((r) => Date.parse(String(r['timestamp'])) < cutoff.getTime()),
    );
  }

  ping(): Promise<void> {
    return this.store.ensureExists();
  }
}
