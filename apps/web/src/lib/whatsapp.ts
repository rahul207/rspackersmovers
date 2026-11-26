import { digitsOnly } from '@rs/shared';

export const DEFAULT_WHATSAPP_GREETING =
  'Hello RS Packers & Movers, I would like to ask about a moving or courier quotation.';

/** Builds a `wa.me` chat link from a configured number; returns undefined when unusable. */
export function buildWhatsappUrl(number: string | undefined, text: string): string | undefined {
  if (!number) return undefined;
  const digits = digitsOnly(number);
  if (!/^[1-9]\d{7,14}$/.test(digits)) return undefined;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** Only ever open links that point at WhatsApp click-to-chat. */
export function isSafeWhatsappUrl(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'wa.me' || parsed.hostname === 'api.whatsapp.com')
    );
  } catch {
    return false;
  }
}
