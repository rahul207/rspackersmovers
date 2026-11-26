import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DuplicateReferenceError, type QuoteRequest } from '@rs/domain';
import {
  ExcelQuoteRepository,
  ExcelVisitorAnalyticsRepository,
  InMemoryIdempotencyStore,
  StorageError,
  WorkbookStore,
  escapeSpreadsheetValue,
  unescapeSpreadsheetValue,
  withFileLock,
} from '../src';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'rspm-infra-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('formula injection guard', () => {
  it.each(['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\t=x', '\r=x'])('prefixes %j', (v) => {
    expect(escapeSpreadsheetValue(v)).toBe(`'${v}`);
    expect(unescapeSpreadsheetValue(escapeSpreadsheetValue(v))).toBe(v);
  });
  it('leaves normal text alone and caps very long values', () => {
    expect(escapeSpreadsheetValue('Hello = world')).toBe('Hello = world');
    expect(escapeSpreadsheetValue("'quoted")).toBe("'quoted");
    expect(escapeSpreadsheetValue('x'.repeat(40_000))).toHaveLength(32_000);
  });
});

describe('withFileLock', () => {
  it('serialises tasks per file in call order, even when one fails', async () => {
    const order: number[] = [];
    const run = (n: number, ms: number, fail = false) =>
      withFileLock(join(dir, 'a.xlsx'), async () => {
        await new Promise((r) => setTimeout(r, ms));
        order.push(n);
        if (fail) throw new Error('boom');
      });
    const results = await Promise.allSettled([run(1, 30), run(2, 5, true), run(3, 1)]);
    expect(order).toEqual([1, 2, 3]);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
  });
});

const columns = [
  { key: 'id', header: 'ID' },
  { key: 'text', header: 'Text' },
  { key: 'amount', header: 'Amount' },
];

describe('WorkbookStore', () => {
  it('creates the workbook and worksheet automatically', async () => {
    const file = join(dir, 'nested', 'new.xlsx');
    const store = new WorkbookStore({ filePath: file, sheetName: 'Things', columns });
    await store.ensureExists();
    expect(existsSync(file)).toBe(true);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    expect(wb.getWorksheet('Things')!.getRow(1).getCell(2).value).toBe('Text');
  });

  it('handles 60 concurrent appends without loss or corruption and leaves no temp files', async () => {
    const file = join(dir, 'c.xlsx');
    const store = new WorkbookStore({ filePath: file, sheetName: 'T', columns });
    await Promise.all(
      Array.from({ length: 60 }, (_, i) =>
        store.transact((tx) => tx.append({ id: `r${i}`, text: `t${i}`, amount: i })),
      ),
    );
    const rows = await store.readAll();
    expect(rows).toHaveLength(60);
    expect(new Set(rows.map((r) => r['id'])).size).toBe(60);
    expect(readdirSync(dir).filter((f) => f.startsWith('.tmp-'))).toEqual([]);
  });

  it('stores dangerous text as text and reads the original back', async () => {
    const file = join(dir, 'f.xlsx');
    const store = new WorkbookStore({ filePath: file, sheetName: 'T', columns });
    await store.transact((tx) => tx.append({ id: '1', text: "=cmd|' /C calc'!A0", amount: -5 }));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    const cell = wb.getWorksheet('T')!.getRow(2).getCell(2);
    expect(cell.type).toBe(ExcelJS.ValueType.String);
    expect(String(cell.value).startsWith("'=")).toBe(true);
    expect((await store.readAll())[0]).toMatchObject({ text: "=cmd|' /C calc'!A0", amount: -5 });
  });

  it('updates and deletes rows', async () => {
    const store = new WorkbookStore({ filePath: join(dir, 'u.xlsx'), sheetName: 'T', columns });
    await store.transact((tx) =>
      ['a', 'b', 'c'].forEach((id, i) => tx.append({ id, text: id, amount: i })),
    );
    expect(await store.transact((tx) => tx.update((r) => r['id'] === 'b', { text: 'B!' }))).toBe(1);
    expect(await store.transact((tx) => tx.deleteWhere((r) => r['id'] !== 'b'))).toBe(2);
    expect(await store.readAll()).toEqual([{ id: 'b', text: 'B!', amount: 1 }]);
  });

  it('rotates backups at most once per interval and keeps only the newest N', async () => {
    const file = join(dir, 'b.xlsx');
    const backupDir = join(dir, 'backups');
    const store = new WorkbookStore({
      filePath: file,
      sheetName: 'T',
      columns,
      backupDir,
      backupsToKeep: 2,
      backupMinIntervalMs: 0,
    });
    for (let i = 0; i < 5; i++) {
      await store.transact((tx) => tx.append({ id: String(i), text: 'x', amount: i }));
      await new Promise((r) => setTimeout(r, 1100));
    }
    expect(readdirSync(backupDir).length).toBe(2);

    const throttled = new WorkbookStore({
      filePath: join(dir, 'th.xlsx'),
      sheetName: 'T',
      columns,
      backupDir: join(dir, 'tb'),
      backupMinIntervalMs: 3_600_000,
    });
    for (let i = 0; i < 4; i++)
      await throttled.transact((tx) => tx.append({ id: String(i), text: 'x', amount: i }));
    expect(readdirSync(join(dir, 'tb')).length).toBe(1);
  }, 30_000);

  it('never overwrites a corrupt workbook; raises a StorageError instead', async () => {
    const file = join(dir, 'bad.xlsx');
    writeFileSync(file, 'this is not a zip file');
    const store = new WorkbookStore({ filePath: file, sheetName: 'T', columns });
    await expect(
      store.transact((tx) => tx.append({ id: '1', text: 'x', amount: 1 })),
    ).rejects.toBeInstanceOf(StorageError);
    expect(readFileSync(file, 'utf8')).toBe('this is not a zip file');
  });

  it('adds missing columns to an existing workbook without losing data', async () => {
    const file = join(dir, 'm.xlsx');
    await new WorkbookStore({
      filePath: file,
      sheetName: 'T',
      columns: columns.slice(0, 2),
    }).transact((tx) => tx.append({ id: '1', text: 'old' }));
    const upgraded = new WorkbookStore({ filePath: file, sheetName: 'T', columns });
    await upgraded.transact((tx) => tx.append({ id: '2', text: 'new', amount: 9 }));
    expect(await upgraded.readAll()).toEqual([
      { id: '1', text: 'old', amount: null },
      { id: '2', text: 'new', amount: 9 },
    ]);
  });
});

const quote = (ref: string, createdAt = new Date()): QuoteRequest => ({
  referenceNumber: ref,
  createdAt,
  customerName: 'Asha',
  mobile: '919876543210',
  pickup: {
    address: 'A',
    latitude: 19.1,
    longitude: 72.8,
    pincode: '400053',
    streetAddress: 'Flat 1',
  },
  drop: {
    address: 'B',
    latitude: 18.5,
    longitude: 73.8,
    pincode: '411001',
    streetAddress: 'House 2',
  },
  distanceKm: 100,
  moveType: 'LOCAL_HOUSEHOLD',
  vehicleType: 'TATA_ACE',
  pickupDate: '2030-01-01',
  consentReference: 'c',
  status: 'NEW',
  sourcePage: '/',
});

describe('Excel repositories', () => {
  it('quote repository rejects duplicate references and purges by retention', async () => {
    const repo = new ExcelQuoteRepository({ filePath: join(dir, 'q.xlsx') });
    await repo.save(quote('RSPM-1', new Date('2020-01-01')));
    await repo.save(quote('RSPM-2'));
    await expect(repo.save(quote('RSPM-2'))).rejects.toBeInstanceOf(DuplicateReferenceError);
    expect(await repo.existsByReference('RSPM-2')).toBe(true);
    expect(await repo.deleteOlderThan(new Date('2021-01-01'))).toBe(1);
    expect(await repo.existsByReference('RSPM-1')).toBe(false);
  });

  it('visitor repository upserts: updates last visit only, keeps first visit and landing page', async () => {
    const repo = new ExcelVisitorAnalyticsRepository({ filePath: join(dir, 'v.xlsx') });
    const profile = (when: string, landing: string) => ({
      visitorId: 'v1',
      firstVisit: new Date(when),
      lastVisit: new Date(when),
      landingPage: landing,
      referralCategory: 'DIRECT' as const,
      deviceCategory: 'DESKTOP' as const,
      browserFamily: 'Chrome',
      osFamily: 'Windows',
      consentStatus: 'ANALYTICS_GRANTED' as const,
    });
    await repo.recordVisit(profile('2026-01-01T00:00:00Z', '/'));
    await repo.recordVisit(profile('2026-02-01T00:00:00Z', '/pricing'));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(join(dir, 'v.xlsx'));
    const sheet = wb.getWorksheet('Visitors')!;
    expect(sheet.rowCount).toBe(2);
    const row = sheet.getRow(2);
    expect(row.getCell(2).value).toBe('2026-01-01T00:00:00.000Z');
    expect(row.getCell(3).value).toBe('2026-02-01T00:00:00.000Z');
    expect(row.getCell(4).value).toBe('/');
  });

  it('creates parent directories for new files', async () => {
    mkdirSync(join(dir, 'x'));
    await new ExcelQuoteRepository({ filePath: join(dir, 'x', 'y', 'q.xlsx') }).ping();
    expect(existsSync(join(dir, 'x', 'y', 'q.xlsx'))).toBe(true);
  });
});

describe('InMemoryIdempotencyStore', () => {
  it('shares in-flight work, remembers results within the TTL and forgets failures', async () => {
    let t = 0;
    const store = new InMemoryIdempotencyStore(1000, () => t);
    let calls = 0;
    const work = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return calls;
    };
    const [a, b] = await Promise.all([store.run('k', work), store.run('k', work)]);
    expect([a, b, calls]).toEqual([1, 1, 1]);
    expect(await store.run('k', work)).toBe(1);
    t = 2000;
    expect(await store.run('k', work)).toBe(2);

    let failures = 0;
    await expect(
      store.run('f', () => (failures++, Promise.reject(new Error('x')))),
    ).rejects.toThrow();
    await expect(
      store.run('f', () => (failures++, Promise.reject(new Error('x')))),
    ).rejects.toThrow();
    expect(failures).toBe(2);
  });
});
