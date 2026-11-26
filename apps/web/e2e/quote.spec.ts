import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { expect, test } from '@playwright/test';
import {
  DROP_ADDRESS,
  PICKUP_ADDRESS,
  WHATSAPP_DIGITS,
  captureWindowOpen,
  chooseArea,
  fillQuoteForm,
  gotoHome,
  openedUrls,
  quoteForm,
  scrollWholePage,
} from './helpers';

async function quoteRows() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('./storage/e2e/quote-requests.xlsx');
  const sheet = wb.worksheets[0]!;
  const headers = (sheet.getRow(1).values as unknown[]).slice(1).map(String);
  const rows: Record<string, unknown>[] = [];
  sheet.eachRow((row, n) => {
    if (n > 1)
      rows.push(Object.fromEntries(headers.map((h, i) => [h, (row.values as unknown[])[i + 1]])));
  });
  return rows;
}

test.describe('quote flow', () => {
  test('chooses areas by PIN code, stores the quote and opens WhatsApp with an encoded message', async ({
    page,
  }) => {
    await captureWindowOpen(page);
    await gotoHome(page);
    const form = await fillQuoteForm(page);

    await expect(page.getByText('Indicative estimate')).toHaveCount(0);
    await form.getByRole('checkbox', { name: /prepare my quotation/ }).check();
    await form.getByRole('button', { name: 'Get quote on WhatsApp' }).click();

    const confirmation = page
      .getByRole('status')
      .filter({ hasText: /RSPM-\d{8}-[A-Z0-9]{4}/ })
      .first();
    await expect(confirmation).toBeVisible();
    const reference = /RSPM-\d{8}-[A-Z0-9]{4}/.exec((await confirmation.textContent()) ?? '')![0];

    const [url] = await openedUrls(page);
    expect(url).toBeTruthy();
    expect(url!.startsWith(`https://wa.me/${WHATSAPP_DIGITS}?text=`)).toBe(true);
    const message = decodeURIComponent(url!.split('?text=')[1]!);
    for (const part of [reference, 'Asha Verma', '+91 98765 43210', PICKUP_ADDRESS, DROP_ADDRESS]) {
      expect(message).toContain(part);
    }
    expect(message).not.toContain('₹');

    // Fallback confirmation: the message is always visible and copyable, and the link works without window.open.
    await expect(page.getByRole('textbox', { name: /message/i }).first()).toHaveValue(/RSPM-/);
    await expect(page.getByRole('link', { name: 'Open WhatsApp' })).toHaveAttribute(
      'href',
      new RegExp(`^https://wa\\.me/${WHATSAPP_DIGITS}\\?text=`),
    );
    await page.getByRole('button', { name: 'Copy message' }).click();

    await expect
      .poll(async () => (await quoteRows()).some((r) => r['Reference number'] === reference))
      .toBe(true);
    const stored = (await quoteRows()).find((r) => r['Reference number'] === reference)!;
    expect(stored['Customer name']).toBe('Asha Verma');
    expect(stored['Status']).toBe('NEW');
    expect(Number(stored['Pickup latitude'])).toBeCloseTo(19.1364, 2);
  });

  test('never shows a rupee amount, before or after submitting', async ({ page }) => {
    await captureWindowOpen(page);
    await gotoHome(page);
    await scrollWholePage(page);
    const body = page.locator('body');
    await expect(body).not.toContainText('₹');
    await expect(page.locator('#pricing, #price-calculator')).toHaveCount(0);

    const form = await fillQuoteForm(page, { name: 'No Price', mobile: '90000 44444' });
    await expect(body).not.toContainText('₹');
    await form.getByRole('checkbox', { name: /prepare my quotation/ }).check();
    await form.getByRole('button', { name: 'Get quote on WhatsApp' }).click();
    await expect(page.getByRole('status').filter({ hasText: /RSPM-/ }).first()).toBeVisible();
    await expect(body).not.toContainText('₹');
    await expect(body).not.toContainText(/indicative (estimate|price)/i);
    const message = await page
      .getByRole('textbox', { name: /message/i })
      .first()
      .inputValue();
    expect(message).not.toContain('₹');
  });

  test('shows the post offices of a PIN code, resolves the chosen area and clears it when the PIN changes', async ({
    page,
  }) => {
    await gotoHome(page);
    const group = page.getByRole('group', { name: 'Pickup location' });
    const pin = group.getByLabel('Pickup PIN code', { exact: true });
    await pin.fill('40a0-05 3 99');
    await expect(pin).toHaveValue('400053');
    await expect(group.getByText('2 post offices found. Choose your area.')).toBeVisible();
    const select = group.getByLabel('Pickup area (post office)', { exact: true });
    await expect(select.locator('option').nth(0)).toHaveText('Select your area');
    await expect(select.locator('option')).toHaveCount(3);
    await expect(select.locator('option').nth(1)).toHaveText(/^Andheri West/);

    await group.getByLabel('Pickup full address', { exact: true }).fill(PICKUP_ADDRESS);
    await chooseArea(page, 'Pickup', '400053', 'Andheri West');
    await expect(group).toContainText('Andheri West');

    await pin.fill('41100');
    await expect(select).toHaveValue('');
    await expect(group.getByText('Area:')).toHaveCount(0);
    await expect(group.getByLabel('Pickup full address', { exact: true })).toHaveValue(
      PICKUP_ADDRESS,
    );
  });

  test('tells the customer when a PIN code has no post office', async ({ page }) => {
    await gotoHome(page);
    const group = page.getByRole('group', { name: 'Drop location' });
    await group.getByLabel('Drop PIN code', { exact: true }).fill('999999');
    await expect(
      group.getByText('No post office found for this PIN code. Please check the number.'),
    ).toBeVisible();
    await expect(
      group.getByLabel('Drop area (post office)', { exact: true }).locator('option'),
    ).toHaveCount(1);
  });

  test('blocks an invalid submission with accessible errors', async ({ page }) => {
    await gotoHome(page);
    const form = quoteForm(page);
    await page.getByLabel('Pickup PIN code', { exact: true }).fill('400053');
    await page.getByLabel('Drop PIN code', { exact: true }).fill('12');
    await form.getByLabel('Mobile number', { exact: true }).fill('12345');
    await form.getByRole('button', { name: 'Get quote on WhatsApp' }).click();

    await expect(page.getByRole('alert').first()).toBeVisible();
    await expect(page.getByText('Enter a valid 6-digit PIN code').first()).toBeVisible();
    await expect(page.getByText('Choose your area from the list').first()).toBeVisible();
    await expect(
      page.getByText('Enter the full address (house/flat, street, landmark)').first(),
    ).toBeVisible();
    await expect(page.getByLabel('Drop PIN code', { exact: true })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await expect(page.getByLabel('Pickup area (post office)', { exact: true })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await expect(form.getByLabel('Mobile number', { exact: true })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await expect(form.getByRole('checkbox', { name: /prepare my quotation/ })).not.toBeChecked();
  });

  test('prevents double submission: two rapid clicks create a single quote', async ({ page }) => {
    await captureWindowOpen(page);
    await gotoHome(page);
    const form = await fillQuoteForm(page, { name: 'Double Click', mobile: '90000 22222' });
    await form.getByRole('checkbox', { name: /prepare my quotation/ }).check();
    const submit = form.getByRole('button', { name: 'Get quote on WhatsApp' });
    await submit.dblclick();
    await expect(page.getByRole('status').filter({ hasText: /RSPM-/ }).first()).toBeVisible();
    await expect
      .poll(
        async () => (await quoteRows()).filter((r) => r['Customer name'] === 'Double Click').length,
      )
      .toBe(1);
  });

  test('neutralises formula injection typed into the form', async ({ page }) => {
    await captureWindowOpen(page);
    await gotoHome(page);
    const form = await fillQuoteForm(page, {
      name: '=HYPERLINK("http://evil.example","x")',
      mobile: '90000 33333',
    });
    await form.getByRole('checkbox', { name: /prepare my quotation/ }).check();
    await form.getByRole('button', { name: 'Get quote on WhatsApp' }).click();
    await expect(page.getByRole('status').filter({ hasText: /RSPM-/ }).first()).toBeVisible();
    await expect
      .poll(async () =>
        (await quoteRows()).some((r) => String(r['Customer name']).startsWith("'=HYPERLINK")),
      )
      .toBe(true);
    const raw = readFileSync('./storage/e2e/quote-requests.xlsx');
    expect(raw.length).toBeGreaterThan(0);
  });
});
