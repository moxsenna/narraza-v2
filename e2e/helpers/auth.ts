import type { Page } from '@playwright/test';
import { getLatestMagicLinkToken } from './mail.js';

/**
 * Complete a full magic-link login flow.
 *
 * 1. Navigate to /auth/email
 * 2. Enter email and submit
 * 3. Wait for magic link in .data/mail/
 * 4. Visit the confirm URL with token
 * 5. POST confirm (this happens automatically via the redirect flow)
 * 6. Return when redirected to /dashboard
 *
 * NO login bypass — uses real mail capture.
 */
export async function loginViaMagicLink(
  page: Page,
  email: string,
  options?: Partial<{ timeoutMs: number }>,
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 30000;

  // Step 1: Go to auth/email page
  await page.goto('/auth/email');

  // Step 2: Fill email and submit
  await page.fill('input[name="email"]', email);
  await page.click('button[type="submit"]');

  // Step 3: Wait for mail to arrive
  const token = await getLatestMagicLinkToken({ timeoutMs });
  if (!token) {
    throw new Error(`No magic link token received for ${email} within ${timeoutMs}ms`);
  }

  // Step 4: Visit confirm URL (GET does prepare, sets pending_login cookie, 303 to /auth/email/confirm)
  await page.goto(`/auth/email/confirm?token=${token}`);

  // Step 5: The confirm page POSTs to the route handler, which then redirects to /dashboard
  // Wait for the page to settle on /dashboard
  await page.waitForURL('**/dashboard', { timeout: 15000 });
}

/**
 * Ensure a user is logged in for the given page.
 * If already on dashboard, return. Otherwise, perform login.
 */
export async function ensureLoggedIn(page: Page, email: string): Promise<void> {
  // Check if already logged in by visiting dashboard
  await page.goto('/dashboard');

  // If we're on dashboard, we're logged in
  if (page.url().includes('/dashboard')) {
    return;
  }

  // Otherwise, perform full login
  await loginViaMagicLink(page, email);
}
