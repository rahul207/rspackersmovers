import type { VisitorAnalyticsRepository } from '@rs/application';
import type { VisitorProfile } from '@rs/domain';
import { WorkbookStore, type ColumnDef, type WorkbookStoreOptions } from '../excel/workbook-store';

export const VISITOR_COLUMNS: readonly ColumnDef[] = [
  { key: 'visitorId', header: 'Anonymous visitor ID', width: 38 },
  { key: 'firstVisit', header: 'First visit', width: 26 },
  { key: 'lastVisit', header: 'Last visit', width: 26 },
  { key: 'landingPage', header: 'Landing page', width: 24 },
  { key: 'referralCategory', header: 'Referral category', width: 18 },
  { key: 'campaignSource', header: 'Campaign source', width: 18 },
  { key: 'campaignMedium', header: 'Campaign medium', width: 18 },
  { key: 'campaignName', header: 'Campaign name', width: 22 },
  { key: 'deviceCategory', header: 'Device category', width: 16 },
  { key: 'browserFamily', header: 'Browser family', width: 18 },
  { key: 'osFamily', header: 'Operating system family', width: 22 },
  { key: 'language', header: 'Preferred language', width: 18 },
  { key: 'region', header: 'Approximate country/region', width: 24 },
  { key: 'consentStatus', header: 'Consent status', width: 20 },
];

export class ExcelVisitorAnalyticsRepository implements VisitorAnalyticsRepository {
  private readonly store: WorkbookStore;

  constructor(options: Omit<WorkbookStoreOptions, 'columns' | 'sheetName'>) {
    this.store = new WorkbookStore({ ...options, sheetName: 'Visitors', columns: VISITOR_COLUMNS });
  }

  recordVisit(p: VisitorProfile): Promise<void> {
    return this.store.transact((tx) => {
      const updated = tx.update((r) => r['visitorId'] === p.visitorId, {
        lastVisit: p.lastVisit.toISOString(),
      });
      if (updated > 0) return;
      tx.append({
        visitorId: p.visitorId,
        firstVisit: p.firstVisit.toISOString(),
        lastVisit: p.lastVisit.toISOString(),
        landingPage: p.landingPage,
        referralCategory: p.referralCategory,
        campaignSource: p.campaignSource ?? null,
        campaignMedium: p.campaignMedium ?? null,
        campaignName: p.campaignName ?? null,
        deviceCategory: p.deviceCategory,
        browserFamily: p.browserFamily,
        osFamily: p.osFamily,
        language: p.language ?? null,
        region: p.region ?? null,
        consentStatus: p.consentStatus,
      });
    });
  }

  deleteOlderThan(cutoff: Date): Promise<number> {
    return this.store.transact((tx) =>
      tx.deleteWhere((r) => Date.parse(String(r['lastVisit'])) < cutoff.getTime()),
    );
  }

  ping(): Promise<void> {
    return this.store.ensureExists();
  }
}
