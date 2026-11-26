import { z } from 'zod';

/* eslint-disable no-control-regex -- stripping control characters is the purpose of this pattern */
const CONTROL_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
/* eslint-enable no-control-regex */
const HTML_TAGS = /<\/?[a-zA-Z!][^>]*>/g;

/** Normalises, strips control/bidi characters and HTML-like tags, collapses whitespace. */
export function sanitizeSingleLine(value: string): string {
  return value
    .normalize('NFKC')
    .replace(CONTROL_CHARS, '')
    .replace(HTML_TAGS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Like sanitizeSingleLine but keeps line breaks (max two in a row). */
export function sanitizeMultiline(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARS, '')
    .replace(HTML_TAGS, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const singleLine = (max: number, min = 1) =>
  z
    .string({ error: 'This field is required' })
    .transform(sanitizeSingleLine)
    .pipe(
      z
        .string()
        .min(min, min <= 1 ? 'This field is required' : `Enter at least ${min} characters`)
        .max(max, `Use at most ${max} characters`),
    );

export const multiline = (max: number, min = 0) =>
  z
    .string({ error: 'This field is required' })
    .transform(sanitizeMultiline)
    .pipe(
      z
        .string()
        .min(min, min <= 1 ? 'This field is required' : `Enter at least ${min} characters`)
        .max(max, `Use at most ${max} characters`),
    );

/** Treats blank strings as "not provided". */
export const optionalText = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    schema.optional(),
  );
