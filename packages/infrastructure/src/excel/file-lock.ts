import { resolve } from 'node:path';

const tails = new Map<string, Promise<unknown>>();

/**
 * Process-level, per-file mutex. Callers for the same path run strictly one after another,
 * in call order. A failure in one task never blocks later tasks.
 *
 * This protects a single Node.js process only. Running several API instances against the
 * same workbook is NOT supported (see docs/architecture.md).
 */
export function withFileLock<T>(filePath: string, task: () => Promise<T>): Promise<T> {
  const key = resolve(filePath).toLowerCase();
  const previous = tails.get(key) ?? Promise.resolve();
  const run = previous.then(task, task);
  const tail = run.catch(() => undefined);
  tails.set(key, tail);
  void tail.then(() => {
    if (tails.get(key) === tail) tails.delete(key);
  });
  return run;
}
