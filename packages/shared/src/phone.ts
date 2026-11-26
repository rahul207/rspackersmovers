/** Digits-only normalisation helpers shared by validation and WhatsApp URL building. */

/** Removes spaces, brackets, hyphens, dots and the plus symbol. */
export function digitsOnly(value: string): string {
  return value.replace(/[\s()\-.+]/g, '');
}

/**
 * Normalises an Indian mobile number to `91XXXXXXXXXX`.
 * Accepts `98765 43210`, `+91 98765 43210`, `098765 43210`, `91-9876543210`.
 * Returns null when the value is not a plausible Indian mobile number.
 */
export function normalizeIndianMobile(value: string): string | null {
  let digits = digitsOnly(value);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return `91${digits}`;
}

/** `919876543210` -> `+91 98765 43210` */
export function formatIndianMobile(normalized: string): string {
  const m = /^91([6-9]\d{4})(\d{5})$/.exec(normalized);
  return m ? `+91 ${m[1]} ${m[2]}` : normalized;
}

/**
 * Validates a complete international number (no national format) and returns digits only.
 * A bare 10-digit Indian mobile (missing the 91 country code) is rejected, because it would
 * produce a wrong wa.me link.
 */
export function normalizeInternationalNumber(value: string): string | null {
  const digits = digitsOnly(value);
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  if (/^[6-9]\d{9}$/.test(digits)) return null;
  return digits;
}
