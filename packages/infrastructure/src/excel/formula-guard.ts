const DANGEROUS_PREFIX = /^[=+\-@\t\r]/;
const MAX_CELL_LENGTH = 32_000;

/**
 * Neutralises spreadsheet formula injection: a text value starting with = + - @ (or a
 * tab/carriage return) gets a leading apostrophe so Excel/LibreOffice treat it as text.
 */
export function escapeSpreadsheetValue(value: string): string {
  const v = value.length > MAX_CELL_LENGTH ? value.slice(0, MAX_CELL_LENGTH) : value;
  return DANGEROUS_PREFIX.test(v) ? `'${v}` : v;
}

/** Reverses {@link escapeSpreadsheetValue} when reading values back. */
export function unescapeSpreadsheetValue(value: string): string {
  return value.startsWith("'") && DANGEROUS_PREFIX.test(value.slice(1)) ? value.slice(1) : value;
}
