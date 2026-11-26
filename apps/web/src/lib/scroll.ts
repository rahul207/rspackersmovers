/** Scrolls to the hero quote form and moves focus to its first field. */
export function focusQuoteForm(): void {
  const card = document.getElementById('quote-form-card');
  if (!card) return;
  card.scrollIntoView({ block: 'start' });
  const first = document.getElementById('quote-pickup');
  if (first) first.focus({ preventScroll: true });
}

/** Instantly jumps to an element by id (the browser applies scroll-margin for the sticky header). */
export function jumpToId(id: string): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  const top =
    el.getBoundingClientRect().top +
    window.scrollY -
    parseFloat(getComputedStyle(el).scrollMarginTop || '0');
  window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
  return true;
}
