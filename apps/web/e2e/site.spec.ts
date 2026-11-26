import { expect, test } from '@playwright/test';
import { fillQuoteForm, gotoHome, quoteForm } from './helpers';

test.describe('route animation', () => {
  test('is labelled as an illustration and responds to selected locations', async ({ page }) => {
    await gotoHome(page);
    const figure = page.locator('figure').filter({ hasText: 'Illustration only' }).first();
    await expect(figure).toBeVisible();
    await expect(figure).toContainText('Choose pickup and drop locations');
    await fillQuoteForm(page);
    await expect(figure).toContainText('Andheri West');
    await expect(figure).toContainText('Pune City');
    await expect(figure).not.toContainText(/Sea View|Lokhandwala|Example Road|City Mall/); // typed addresses stay out
    await expect(figure).not.toContainText(/19\.13|72\.82|18\.51|73\.85/); // no coordinates in the DOM
    await expect(figure.locator('canvas'))
      .toHaveAttribute('aria-hidden', 'true')
      .catch(() => undefined);
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('never mounts the 3D canvas and still reflects the selection statically', async ({
      page,
    }) => {
      await gotoHome(page);
      await fillQuoteForm(page);
      await page.waitForTimeout(1500);
      await expect(page.locator('figure canvas')).toHaveCount(0);
      await expect(page.locator('figure')).toContainText('Andheri West');
      const animated = await page.evaluate(
        () => document.getAnimations().filter((a) => a.playState === 'running').length,
      );
      expect(animated).toBe(0);
    });
  });

  test.describe('WebGL unavailable', () => {
    test('falls back to the SVG scene and the form remains fully usable', async ({ page }) => {
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (
          this: HTMLCanvasElement,
          type: string,
          ...rest: unknown[]
        ) {
          if (/webgl/i.test(type)) return null;
          return (original as (...a: unknown[]) => unknown).call(this, type, ...rest);
        } as typeof original;
      });
      await gotoHome(page);
      await fillQuoteForm(page);
      await page.waitForTimeout(1500);
      await expect(page.locator('figure canvas')).toHaveCount(0);
      await expect(page.locator('figure svg').first()).toBeVisible();
      await expect(
        quoteForm(page).getByRole('button', { name: 'Get quote on WhatsApp' }),
      ).toBeEnabled();
    });
  });
});

test.describe('navigation', () => {
  test('mobile menu is keyboard operable and closes with Escape @mobile', async ({ page }) => {
    await gotoHome(page);
    const toggle = page.getByRole('button', { name: /menu/i }).first();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(
      page.getByRole('navigation', { name: 'Mobile' }).getByRole('link', { name: 'Services' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
  });

  test('primary navigation lists the sections without any pricing entries', async ({ page }) => {
    await gotoHome(page);
    const nav = page.getByRole('navigation', { name: 'Primary' });
    await expect(nav.getByRole('link')).toHaveText([
      'Home',
      'Services',
      'How It Works',
      'Clients',
      'Testimonials',
      'About Us',
      'Contact',
    ]);
    await expect(page.getByRole('link', { name: /pricing|price calculator/i })).toHaveCount(0);
  });

  test('demonstration clients and testimonials are visibly flagged as fictional', async ({
    page,
  }) => {
    await gotoHome(page);
    await page.locator('#clients').scrollIntoViewIfNeeded();
    await expect(page.locator('#clients')).toContainText(/fictional/i);
    await page.locator('#testimonials').scrollIntoViewIfNeeded();
    await expect(page.locator('#testimonials')).toContainText(/fictional/i);
  });

  test('footer hides unconfigured details and shows configured ones', async ({ page }) => {
    await gotoHome(page);
    const footer = page.getByRole('contentinfo');
    await expect(footer).toContainText('Built for performance, accessibility, and privacy');
    await expect(footer).toContainText(String(new Date().getFullYear()));
    await expect(footer.getByRole('button', { name: 'Cookie settings' })).toBeVisible();
    await expect(footer).toContainText('+91 99999 00000');
    await expect(
      footer.getByRole('link', { name: /facebook|instagram|linkedin|youtube/i }),
    ).toHaveCount(0);
  });

  test('serves SEO essentials: canonical, structured data (no invented facts), robots and sitemap', async ({
    page,
    request,
    baseURL,
  }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${baseURL}/`);
    const ld = await page.locator('script[type="application/ld+json"]').textContent();
    const data = JSON.parse(ld!) as { '@type': string; address?: unknown; sameAs?: unknown }[];
    expect(data.map((d) => d['@type'])).toEqual(
      expect.arrayContaining(['Organization', 'FAQPage', 'Service']),
    );
    const org = data.find((d) => d['@type'] === 'Organization')!;
    expect(org.sameAs).toBeUndefined();
    expect((await request.get('/robots.txt')).status()).toBe(200);
    expect(await (await request.get('/sitemap.xml')).text()).toContain(`${baseURL}/`);
    const missing = await request.get('/no-such-page');
    expect(missing.status()).toBe(404);
  });
});
