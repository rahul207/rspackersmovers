import { expect, type Locator, type Page } from '@playwright/test';

export const WHATSAPP_DIGITS = '919999900000';

export function futureDate(days = 4): string {
  const d = new Date(Date.now() + days * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Records window.open calls instead of navigating away (also exercises the popup-blocked fallback). */
export async function captureWindowOpen(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __opened: string[] }).__opened = [];
    window.open = ((url?: string | URL) => {
      (window as unknown as { __opened: string[] }).__opened.push(String(url));
      return null;
    }) as typeof window.open;
  });
}

export const openedUrls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);

export async function gotoHome(page: Page, decision: 'reject' | 'accept' | 'none' = 'reject') {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const banner = page.getByRole('region', { name: 'Your privacy choices' });
  if (decision === 'none') return;
  await expect(banner).toBeVisible();
  await page
    .getByRole('button', { name: decision === 'accept' ? 'Accept all' : 'Reject non-essential' })
    .click();
  await expect(banner).toBeHidden();
}

export const PICKUP_ADDRESS = 'Flat 12, Sea View Apartments, Lokhandwala Road';
export const DROP_ADDRESS = '5 Example Road, near City Mall';

/** Scrolls through the page so lazily mounted sections render. */
export async function scrollWholePage(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
}

/** Types a PIN code, chooses the post office whose name starts with `area` and waits for it to resolve. */
export async function chooseArea(page: Page, kind: 'Pickup' | 'Drop', pin: string, area: string) {
  const group = page.getByRole('group', { name: `${kind} location` });
  await group.getByLabel(`${kind} PIN code`, { exact: true }).fill(pin);
  const select = group.getByLabel(`${kind} area (post office)`, { exact: true });
  const option = select.locator('option', { hasText: area });
  await expect(option).toHaveCount(1);
  await select.selectOption({ label: (await option.textContent())!.trim() });
  await expect(group.getByText('Area:')).toBeVisible();
  return group;
}

export async function fillLocation(
  page: Page,
  kind: 'Pickup' | 'Drop',
  pin: string,
  area: string,
  address: string,
) {
  const group = await chooseArea(page, kind, pin, area);
  await group.getByLabel(`${kind} full address`, { exact: true }).fill(address);
}

export const quoteForm = (page: Page): Locator =>
  page.locator('form').filter({ has: page.getByRole('button', { name: 'Get quote on WhatsApp' }) });

export const contactForm = (page: Page): Locator =>
  page.locator('form').filter({ has: page.getByRole('button', { name: 'Send message' }) });

export async function fillQuoteForm(
  page: Page,
  overrides: { name?: string; mobile?: string } = {},
) {
  const form = quoteForm(page);
  await fillLocation(page, 'Pickup', '400053', 'Andheri West', PICKUP_ADDRESS);
  await fillLocation(page, 'Drop', '411001', 'Pune City', DROP_ADDRESS);
  await form.getByLabel('Pickup date', { exact: true }).fill(futureDate());
  await form
    .getByLabel('Move type', { exact: true })
    .selectOption({ label: 'Intercity household shifting' });
  await form.getByLabel('Vehicle type', { exact: true }).selectOption({ label: '17-foot truck' });
  await form.getByLabel('Your name', { exact: true }).fill(overrides.name ?? 'Asha Verma');
  await form.getByLabel('Mobile number', { exact: true }).fill(overrides.mobile ?? '98765 43210');
  await form.getByLabel('Notes (optional)', { exact: true }).fill('Third floor, lift available');
  return form;
}
