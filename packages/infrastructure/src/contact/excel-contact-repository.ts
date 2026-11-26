import type { ContactRequestRepository } from '@rs/application';
import { DuplicateReferenceError, type ContactRequest } from '@rs/domain';
import { WorkbookStore, type ColumnDef, type WorkbookStoreOptions } from '../excel/workbook-store';

export const CONTACT_COLUMNS: readonly ColumnDef[] = [
  { key: 'requestId', header: 'Request ID', width: 24 },
  { key: 'createdAt', header: 'Created timestamp', width: 26 },
  { key: 'name', header: 'Name', width: 24 },
  { key: 'mobile', header: 'Mobile number', width: 16 },
  { key: 'email', header: 'Email', width: 28 },
  { key: 'subject', header: 'Subject', width: 32 },
  { key: 'message', header: 'Message', width: 60 },
  { key: 'preferredContactMethod', header: 'Preferred contact method', width: 22 },
  { key: 'consentReference', header: 'Consent reference', width: 38 },
  { key: 'status', header: 'Status', width: 12 },
  { key: 'sourcePage', header: 'Source page', width: 16 },
];

export class ExcelContactRequestRepository implements ContactRequestRepository {
  private readonly store: WorkbookStore;

  constructor(options: Omit<WorkbookStoreOptions, 'columns' | 'sheetName'>) {
    this.store = new WorkbookStore({
      ...options,
      sheetName: 'Contact requests',
      columns: CONTACT_COLUMNS,
    });
  }

  save(r: ContactRequest): Promise<void> {
    return this.store.transact((tx) => {
      if (tx.rows().some((row) => row['requestId'] === r.requestId)) {
        throw new DuplicateReferenceError(r.requestId);
      }
      tx.append({
        requestId: r.requestId,
        createdAt: r.createdAt.toISOString(),
        name: r.name,
        mobile: r.mobile,
        email: r.email ?? null,
        subject: r.subject,
        message: r.message,
        preferredContactMethod: r.preferredContactMethod,
        consentReference: r.consentReference,
        status: r.status,
        sourcePage: r.sourcePage,
      });
    });
  }

  existsById(requestId: string): Promise<boolean> {
    return this.store.transact((tx) => tx.rows().some((r) => r['requestId'] === requestId));
  }

  deleteOlderThan(cutoff: Date): Promise<number> {
    return this.store.transact((tx) =>
      tx.deleteWhere((r) => Date.parse(String(r['createdAt'])) < cutoff.getTime()),
    );
  }

  ping(): Promise<void> {
    return this.store.ensureExists();
  }
}
