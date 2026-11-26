const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Builds `PREFIX-YYYYMMDD-XXXX`. `randomInt(n)` must return an integer in [0, n).
 * The alphabet omits look-alike characters (0/O, 1/I/L).
 */
export function buildReference(
  prefix: string,
  istDate: string,
  randomInt: (maxExclusive: number) => number,
): string {
  const compactDate = istDate.replace(/-/g, '');
  let suffix = '';
  for (let i = 0; i < 4; i++) suffix += ALPHABET[randomInt(ALPHABET.length)];
  return `${prefix}-${compactDate}-${suffix}`;
}

export const QUOTE_REFERENCE_PATTERN = /^RSPM-\d{8}-[A-Z0-9]{4}$/;
export const CONTACT_REFERENCE_PATTERN = /^RSPM-C-\d{8}-[A-Z0-9]{4}$/;
