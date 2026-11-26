import { randomBytes } from 'node:crypto';
import { copyFile, mkdir, readdir, rename, stat, unlink } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import ExcelJS from 'exceljs';
import type { Logger } from '@rs/application';
import { escapeSpreadsheetValue, unescapeSpreadsheetValue } from './formula-guard';
import { withFileLock } from './file-lock';

export type CellValue = string | number | boolean | null;
export type Row = Record<string, CellValue>;

export interface ColumnDef {
  key: string;
  header: string;
  width?: number;
}

export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StorageError';
  }
}

export interface WorkbookStoreOptions {
  filePath: string;
  sheetName: string;
  columns: readonly ColumnDef[];
  backupDir?: string;
  backupsToKeep?: number;
  backupMinIntervalMs?: number;
  logger?: Logger;
}

export interface Transaction {
  rows(): Row[];
  append(row: Row): void;
  /** Applies `patch` to every matching row; returns the number updated. */
  update(predicate: (row: Row) => boolean, patch: Row): number;
  /** Removes every matching row; returns the number removed. */
  deleteWhere(predicate: (row: Row) => boolean): number;
}

const RENAME_RETRIES = 6;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Generic XLSX-backed table.
 *
 * - Every operation is serialised per file by a process-level mutex.
 * - Writes go to a temporary file in the same directory and are renamed over the target.
 * - Text is protected against formula injection.
 * - A timestamped backup is rotated in at most once per `backupMinIntervalMs`.
 * - A file that cannot be parsed is never overwritten; a StorageError is raised instead.
 */
export class WorkbookStore {
  private lastBackupAt: number | undefined;

  constructor(private readonly opts: WorkbookStoreOptions) {}

  get filePath(): string {
    return this.opts.filePath;
  }

  /** Creates the workbook and worksheet if they do not exist yet. */
  ensureExists(): Promise<void> {
    return this.transact(() => undefined, { forceWrite: true, onlyIfMissing: true });
  }

  readAll(): Promise<Row[]> {
    return this.transact((tx) => tx.rows());
  }

  /** Runs `work` while holding the file lock. The file is rewritten only if `work` changed it. */
  transact<T>(
    work: (tx: Transaction) => T,
    flags: { forceWrite?: boolean; onlyIfMissing?: boolean } = {},
  ): Promise<T> {
    return withFileLock(this.opts.filePath, async () => {
      const { workbook, sheet, columnIndex, existed } = await this.load();
      let dirty = false;
      const headerKeys = this.opts.columns.map((c) => c.key);

      const readRow = (rowNumber: number): Row => {
        const row: Row = {};
        const xlRow = sheet.getRow(rowNumber);
        for (const key of headerKeys) {
          row[key] = normaliseCell(xlRow.getCell(columnIndex.get(key)!).value);
        }
        return row;
      };
      const writeRow = (rowNumber: number, row: Row) => {
        const xlRow = sheet.getRow(rowNumber);
        for (const [key, value] of Object.entries(row)) {
          const idx = columnIndex.get(key);
          if (!idx) continue;
          const cell = xlRow.getCell(idx);
          cell.value = typeof value === 'string' ? escapeSpreadsheetValue(value) : value;
          if (typeof value === 'string') cell.numFmt = '@';
        }
        xlRow.commit();
      };

      const tx: Transaction = {
        rows() {
          const out: Row[] = [];
          for (let r = 2; r <= sheet.rowCount; r++) {
            if (sheet.getRow(r).hasValues) out.push(readRow(r));
          }
          return out;
        },
        append(row) {
          const next = Math.max(2, sheet.rowCount + 1);
          writeRow(next, row);
          dirty = true;
        },
        update(predicate, patch) {
          let n = 0;
          for (let r = 2; r <= sheet.rowCount; r++) {
            if (sheet.getRow(r).hasValues && predicate(readRow(r))) {
              writeRow(r, patch);
              n++;
            }
          }
          if (n) dirty = true;
          return n;
        },
        deleteWhere(predicate) {
          let n = 0;
          for (let r = sheet.rowCount; r >= 2; r--) {
            if (sheet.getRow(r).hasValues && predicate(readRow(r))) {
              sheet.spliceRows(r, 1);
              n++;
            }
          }
          if (n) dirty = true;
          return n;
        },
      };

      const result = work(tx);
      if (flags.onlyIfMissing && existed) return result;
      if (dirty || !existed || flags.forceWrite) await this.persist(workbook, existed);
      return result;
    });
  }

  private async load() {
    const { filePath, sheetName, columns } = this.opts;
    await mkdir(dirname(filePath), { recursive: true });
    const workbook = new ExcelJS.Workbook();
    let existed = true;
    try {
      await stat(filePath);
    } catch {
      existed = false;
    }
    if (existed) {
      try {
        await workbook.xlsx.readFile(filePath);
      } catch (cause) {
        throw new StorageError(`Workbook ${basename(filePath)} cannot be read`, { cause });
      }
    }

    let sheet = workbook.getWorksheet(sheetName);
    if (!sheet) sheet = workbook.addWorksheet(sheetName);

    const columnIndex = new Map<string, number>();
    const headerRow = sheet.getRow(1);
    const byHeader = new Map<string, number>();
    headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
      byHeader.set(String(cell.value), col);
    });
    let nextCol = Math.max(0, ...byHeader.values()) + 1;
    for (const col of columns) {
      let idx = byHeader.get(col.header);
      if (!idx) {
        idx = nextCol++;
        headerRow.getCell(idx).value = col.header;
        byHeader.set(col.header, idx);
      }
      columnIndex.set(col.key, idx);
      sheet.getColumn(idx).width = col.width ?? 22;
    }
    headerRow.font = { bold: true };
    headerRow.commit();
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    return { workbook, sheet, columnIndex, existed };
  }

  private async persist(workbook: ExcelJS.Workbook, existed: boolean) {
    const { filePath } = this.opts;
    const tmp = join(
      dirname(filePath),
      `.tmp-${randomBytes(6).toString('hex')}${extname(filePath)}`,
    );
    try {
      await workbook.xlsx.writeFile(tmp);
      if (existed) await this.rotateBackup();
      await renameWithRetry(tmp, filePath);
    } catch (cause) {
      await unlink(tmp).catch(() => undefined);
      throw new StorageError(`Workbook ${basename(filePath)} could not be written`, { cause });
    }
  }

  private async rotateBackup() {
    const { backupDir, filePath } = this.opts;
    if (!backupDir) return;
    const minInterval = this.opts.backupMinIntervalMs ?? 3_600_000;
    const keep = this.opts.backupsToKeep ?? 10;
    const base = basename(filePath, extname(filePath));
    await mkdir(backupDir, { recursive: true });
    const names = (await readdir(backupDir)).filter((n) => n.startsWith(`${base}.`)).sort();

    if (this.lastBackupAt === undefined) {
      const newest = names.at(-1);
      this.lastBackupAt = newest ? (await stat(join(backupDir, newest))).mtimeMs : 0;
    }
    if (Date.now() - this.lastBackupAt < minInterval) return;

    const stamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d+Z$/, 'Z');
    await copyFile(filePath, join(backupDir, `${base}.${stamp}${extname(filePath)}`));
    this.lastBackupAt = Date.now();
    const all = (await readdir(backupDir)).filter((n) => n.startsWith(`${base}.`)).sort();
    for (const old of all.slice(0, Math.max(0, all.length - keep))) {
      await unlink(join(backupDir, old)).catch(() => undefined);
    }
    this.opts.logger?.info('storage.backup', { file: basename(filePath) });
  }
}

async function renameWithRetry(from: string, to: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < RENAME_RETRIES; attempt++) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      lastError = error;
      const code = (error as NodeJS.ErrnoException).code;
      // Windows can briefly lock the target (antivirus, OneDrive sync, Excel preview).
      if (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES') break;
      await sleep(40 * (attempt + 1));
    }
  }
  throw lastError;
}

function normaliseCell(value: ExcelJS.CellValue): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return unescapeSpreadsheetValue(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('richText' in value)
      return unescapeSpreadsheetValue(value.richText.map((t) => t.text).join(''));
    if ('result' in value && value.result !== undefined)
      return normaliseCell(value.result as ExcelJS.CellValue);
    if ('text' in value) return String(value.text);
  }
  return String(value);
}
