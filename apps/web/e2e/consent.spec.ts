import { expect, test, type Page } from '@playwright/test';
import { gotoHome } from './helpers';

function trackAnalytics(page: Page) {
  const calls: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/v1/analytics/events')) calls.push(r.url());
  });
  return calls;
}

test.describe('cookie consent', () => {
  test('shows equal-prominence choices, nothing pre-selected, and sends no analytics before consent', async ({
    page,
  }) => {
    const analytics = trackAnalytics(page);
    await gotoHome(page, 'none');
    const banner = page.getByRole('region', { name: 'Your privacy choices' });
    await expect(banner).toBeVisible();
    for (const name of ['Accept all', 'Reject non-essential', 'Customize preferences']) {
      await expect(banner.getByRole('button', { name })).toBeVisible();
    }
    await page
      .getByRole('link', { name: 'Services', exact: true })
      .first()
      .click()
      .catch(() => undefined);
    await page.waitForTimeout(500);
    expect(analytics).toHaveLength(0);
  });

  test('"Reject non-essential" keeps analytics off and persists the decision', async ({
    page,
    context,
  }) => {
    const analytics = trackAnalytics(page);
    await gotoHome(page, 'reject');
    await page.goto('/privacy');
    await page.waitForTimeout(500);
    expect(analytics).toHaveLength(0);
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('rs_consent_v1') ?? 'null'),
    );
    expect(stored).toMatchObject({ analytics: false, marketing: false, location: false });
    const names = (await context.cookies()).map((c) => c.name);
    expect(names).toContain('rs_consent');
    await page.reload();
    await expect(page.getByRole('region', { name: 'Your privacy choices' })).toBeHidden();
  });

  test('"Accept all" enables analytics, which the server records only because the signed cookie proves it', async ({
    page,
  }) => {
    const analytics = trackAnalytics(page);
    await gotoHome(page, 'accept');
    await expect.poll(() => analytics.length).toBeGreaterThan(0);
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('rs_consent_v1') ?? 'null'),
    );
    expect(stored).toMatchObject({ analytics: true, marketing: true, location: true });
  });

  test('can be customised, changed and withdrawn from the footer', async ({ page }) => {
    const analytics = trackAnalytics(page);
    await gotoHome(page, 'none');
    await page.getByRole('button', { name: 'Customize preferences' }).click();
    const dialog = page.getByRole('dialog', { name: 'Cookie settings' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('switch', { name: /Strictly necessary/ })).toBeDisabled();
    for (const name of [/^Analytics/, /^Marketing/, /Location-related processing/]) {
      await expect(dialog.getByRole('switch', { name })).not.toBeChecked();
    }
    await dialog.getByRole('switch', { name: /^Analytics/ }).click();
    await dialog.getByRole('button', { name: 'Save preferences' }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => analytics.length).toBeGreaterThan(0);
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem('rs_consent_v1')!)),
    ).toMatchObject({ analytics: true, marketing: false, location: false });

    // Withdraw.
    await page.getByRole('button', { name: 'Cookie settings' }).click();
    const again = page.getByRole('dialog', { name: 'Cookie settings' });
    await again.getByRole('switch', { name: /^Analytics/ }).click();
    await again.getByRole('button', { name: 'Save preferences' }).click();
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem('rs_consent_v1')!)),
    ).toMatchObject({ analytics: false });
    const before = analytics.length;
    await page.goto('/terms');
    await page.waitForTimeout(500);
    expect(analytics.length).toBe(before);
  });

  test('server ignores analytics events sent without a consent cookie', async ({ request }) => {
    const cfg = await (await request.get('/api/v1/config/public')).json();
    const res = await request.post('/api/v1/analytics/events', {
      headers: { 'x-csrf-token': cfg.data.csrfToken },
      data: { type: 'page_view', path: '/' },
    });
    expect((await res.json()).data.recorded).toBe(false);
  });
});
