import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { fillQuoteForm, gotoHome, quoteForm } from './helpers';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function audit(page: Page) {
  // Let lazily mounted sections render before scanning.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(500);
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes[0]?.target.join(' ')}`,
  );
}

test.describe('accessibility (axe, WCAG 2.2 AA rules)', () => {
  test('home page with the consent banner', async ({ page }) => {
    await gotoHome(page, 'none');
    expect(await audit(page)).toEqual([]);
  });

  test('home page after the banner is dismissed', async ({ page }) => {
    await gotoHome(page, 'reject');
    expect(await audit(page)).toEqual([]);
  });

  test('quote form with chosen areas and validation errors', async ({ page }) => {
    await gotoHome(page, 'reject');
    await fillQuoteForm(page);
    await quoteForm(page).getByRole('button', { name: 'Get quote on WhatsApp' }).click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    expect(await audit(page)).toEqual([]);
  });

  test('cookie settings dialog', async ({ page }) => {
    await gotoHome(page, 'reject');
    await page.getByRole('button', { name: 'Cookie settings' }).click();
    await expect(page.getByRole('dialog', { name: 'Cookie settings' })).toBeVisible();
    expect(await audit(page)).toEqual([]);
  });

  for (const path of [
    '/privacy',
    '/cookie-policy',
    '/terms',
    '/cancellation-policy',
    '/does-not-exist',
  ]) {
    test(`page ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await audit(page)).toEqual([]);
    });
  }

  test('has landmarks, one h1, a skip link and visible focus on first tab stop', async ({
    page,
  }) => {
    await gotoHome(page, 'none');
    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('contentinfo')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: /skip to/i });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
  });

  test('is usable at 200% zoom / 320px width without horizontal scrolling @mobile', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await gotoHome(page, 'reject');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
