import type { QuoteRepository } from '@rs/application';
import { DuplicateReferenceError, type QuoteRequest } from '@rs/domain';
import { WorkbookStore, type ColumnDef, type WorkbookStoreOptions } from '../excel/workbook-store';

export const QUOTE_COLUMNS: readonly ColumnDef[] = [
  { key: 'referenceNumber', header: 'Reference number', width: 22 },
  { key: 'createdAt', header: 'Created timestamp', width: 26 },
  { key: 'customerName', header: 'Customer name', width: 24 },
  { key: 'mobile', header: 'Mobile number', width: 16 },
  { key: 'email', header: 'Email', width: 28 },
  { key: 'pickupAddress', header: 'Pickup address', width: 56 },
  { key: 'pickupPincode', header: 'Pickup PIN code', width: 14 },
  { key: 'pickupLatitude', header: 'Pickup latitude', width: 14 },
  { key: 'pickupLongitude', header: 'Pickup longitude', width: 14 },
  { key: 'dropAddress', header: 'Drop address', width: 56 },
  { key: 'dropPincode', header: 'Drop PIN code', width: 14 },
  { key: 'dropLatitude', header: 'Drop latitude', width: 14 },
  { key: 'dropLongitude', header: 'Drop longitude', width: 14 },
  { key: 'distanceKm', header: 'Distance (km)', width: 14 },
  { key: 'moveType', header: 'Move type', width: 24 },
  { key: 'vehicleType', header: 'Vehicle type', width: 20 },
  { key: 'pickupDate', header: 'Pickup date', width: 14 },
  { key: 'notes', header: 'Notes', width: 40 },
  { key: 'consentReference', header: 'Consent reference', width: 38 },
  { key: 'status', header: 'Status', width: 12 },
  { key: 'sourcePage', header: 'Source page', width: 16 },
];

export class ExcelQuoteRepository implements QuoteRepository {
  private readonly store: WorkbookStore;

  constructor(options: Omit<WorkbookStoreOptions, 'columns' | 'sheetName'>) {
    this.store = new WorkbookStore({
      ...options,
      sheetName: 'Quote requests',
      columns: QUOTE_COLUMNS,
    });
  }

  save(q: QuoteRequest): Promise<void> {
    return this.store.transact((tx) => {
      if (tx.rows().some((r) => r['referenceNumber'] === q.referenceNumber)) {
        throw new DuplicateReferenceError(q.referenceNumber);
      }
      tx.append({
        referenceNumber: q.referenceNumber,
        createdAt: q.createdAt.toISOString(),
        customerName: q.customerName,
        mobile: q.mobile,
        email: q.email ?? null,
        pickupAddress: q.pickup.address,
        pickupPincode: q.pickup.pincode ?? null,
        pickupLatitude: q.pickup.latitude,
        pickupLongitude: q.pickup.longitude,
        dropAddress: q.drop.address,
        dropPincode: q.drop.pincode ?? null,
        dropLatitude: q.drop.latitude,
        dropLongitude: q.drop.longitude,
        distanceKm: q.distanceKm,
        moveType: q.moveType,
        vehicleType: q.vehicleType,
        pickupDate: q.pickupDate,
        notes: q.notes ?? null,
        consentReference: q.consentReference,
        status: q.status,
        sourcePage: q.sourcePage,
      });
    });
  }

  existsByReference(referenceNumber: string): Promise<boolean> {
    return this.store.transact((tx) =>
      tx.rows().some((r) => r['referenceNumber'] === referenceNumber),
    );
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
