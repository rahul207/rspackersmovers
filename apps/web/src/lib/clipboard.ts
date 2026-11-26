/** Copies text using the async clipboard API, falling back to a selected textarea. */
export async function copyText(
  text: string,
  fallbackSource?: HTMLTextAreaElement | null,
): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the selection fallback
  }
  if (fallbackSource) {
    fallbackSource.focus();
    fallbackSource.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    }
  }
  return false;
}
