import { test, expect } from '@playwright/test';
import { loginViaMagicLink } from './helpers/auth.js';
import { clearMailDir } from './helpers/mail.js';

const TEST_EMAIL = 'e2e-auth@narraza.test';

test.describe('auth-magic-link', () => {
  test.beforeEach(async () => {
    clearMailDir();
  });

  test('complete magic link login flow', async ({ page }) => {
    await loginViaMagicLink(page, TEST_EMAIL);

    // We should arrive at dashboard
    await expect(page.url()).toContain('/dashboard');

    // Dashboard shows link to start a new project
    await expect(page.locator('body')).toContainText(/Start a new|Mulai|Create/i);
  });

  test('logged out user redirected to auth', async ({ page }) => {
    await page.goto('/dashboard');
    // Should redirect to auth/email
    await page.waitForURL(/\/auth\/email/, { timeout: 10000 });
    await expect(page.url()).toContain('/auth/email');
  });
});
