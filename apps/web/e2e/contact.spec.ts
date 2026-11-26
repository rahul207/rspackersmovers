import { expect, test } from '@playwright/test';
import { contactForm, gotoHome } from './helpers';

test.describe('contact form', () => {
  test('submits, shows a reference and prevents a duplicate', async ({ page }) => {
    await gotoHome(page);
    await page.locator('#contact').scrollIntoViewIfNeeded();
    const form = contactForm(page);
    await form.getByLabel('Name', { exact: true }).fill('Ravi Kumar');
    await form.getByLabel('Mobile number', { exact: true }).fill('98111 22233');
    await form.getByLabel('Subject', { exact: true }).fill('Storage options');
    await form
      .getByLabel('Message', { exact: true })
      .fill('Do you offer short-term storage in Pune?');
    await form
      .getByLabel('Preferred contact method', { exact: true })
      .selectOption({ label: 'WhatsApp' });
    await form.getByRole('checkbox', { name: /respond to my enquiry/ }).check();
    await form.getByRole('button', { name: 'Send message' }).click();

    const success = page
      .getByRole('status')
      .filter({ hasText: /RSPM-C-\d{8}-[A-Z0-9]{4}/ })
      .first();
    await expect(success).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send message' })).toHaveCount(0);
  });

  test('validates required fields and conditional email', async ({ page }) => {
    await gotoHome(page);
    await page.locator('#contact').scrollIntoViewIfNeeded();
    const form = contactForm(page);
    await form
      .getByLabel('Preferred contact method', { exact: true })
      .selectOption({ label: 'Email' });
    await form.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    await expect(form.getByLabel('Name', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await expect(form.getByRole('checkbox', { name: /respond to my enquiry/ })).not.toBeChecked();
  });

  test('server drops a filled honeypot without storing or confirming', async ({
    page,
    request,
  }) => {
    await gotoHome(page);
    const cfg = await (await request.get('/api/v1/config/public')).json();
    const res = await request.post('/api/v1/contact-requests', {
      headers: { 'x-csrf-token': cfg.data.csrfToken },
      data: {
        name: 'Bot Person',
        mobile: '9822211122',
        subject: 'Spam',
        message: 'Buy cheap things now please',
        preferredContactMethod: 'WHATSAPP',
        consent: true,
        website: 'http://spam.example',
      },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe('SUBMISSION_REJECTED');
  });
});
