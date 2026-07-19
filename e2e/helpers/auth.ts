import type { Page } from '@playwright/test';
import { clearMailDir, getLatestMagicLinkToken } from './mail';

/**
 * Complete a full magic-link login flow.
 * NO login bypass — uses real mail capture + real prepare/consume endpoints.
 */
export async function loginViaMagicLink(
  page: Page,
  email: string,
  options?: Partial<{ timeoutMs: number }>,
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 30000;

  clearMailDir();
  const sinceMs = Date.now() - 1000;

  await page.goto('/auth/email');
  await page.fill('input[name="email"]', email);
  await Promise.all([
    page.waitForURL(/\/auth\/email\/check/, { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ]);

  const token = await getLatestMagicLinkToken({ timeoutMs, sinceMs });
  if (!token) {
    throw new Error(
      `No magic link token received for ${email} within ${timeoutMs}ms`,
    );
  }

  // prepare: set pending cookie, land on confirm page (GET only — no route conflict)
  await page.goto(`/auth/email/prepare?token=${encodeURIComponent(token)}`);
  await page.waitForURL(/\/auth\/email\/confirm/, { timeout: 15000 });

  const cookies = await page.context().cookies();
  const pending = cookies.find((c) => c.name === 'pending_login');
  if (!pending) {
    throw new Error(
      `pending_login cookie missing after prepare. cookies=${cookies
        .map((c) => `${c.name}@${c.path}`)
        .join(',')}`,
    );
  }

  // POST consume via shared cookie jar (real endpoint)
  const confirmRes = await page.request.post('/auth/email/consume', {
    maxRedirects: 0,
  });
  const status = confirmRes.status();
  const location = confirmRes.headers()['location'] ?? '';
  if (status !== 303 && status !== 302 && status !== 307) {
    const body = await confirmRes.text();
    throw new Error(
      `consume POST failed status=${status} body=${body.slice(0, 300)}`,
    );
  }

  const dest = location.startsWith('http')
    ? location
    : new URL(location || '/dashboard', page.url()).toString();
  await page.goto(dest);
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

export async function ensureLoggedIn(page: Page, email: string): Promise<void> {
  await page.goto('/dashboard');
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  if (page.url().includes('/dashboard') && !page.url().includes('/auth')) {
    return;
  }
  await loginViaMagicLink(page, email);
}
