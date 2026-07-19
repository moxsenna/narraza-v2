import { test, expect } from '@playwright/test';
import { ensureLoggedIn } from './helpers/auth';
import { clearMailDir } from './helpers/mail';
import { createGuidedProject } from './helpers/project';

test.describe('idor', () => {
  test('create a project, then access without session redirects/not found', async ({
    page,
  }) => {
    clearMailDir();
    await ensureLoggedIn(page, `e2e-idor-${Date.now()}@narraza.test`);

    const title = `E2E IDOR Owner ${Date.now()}`;
    const projectId = await createGuidedProject(page, title);

    // Owner can open project
    await page.goto(`/projects/${projectId}`);
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain(`/projects/${projectId}`);

    // Clear session — unauthenticated access
    await page.context().clearCookies();
    await page.goto(`/projects/${projectId}`);
    await page.waitForLoadState('domcontentloaded');

    const noAuthUrl = page.url();
    const body = (await page.locator('body').textContent()) ?? '';
    const denied =
      noAuthUrl.includes('/auth/email') ||
      noAuthUrl.includes('/dashboard') ||
      /not found|tidak ditemukan|login/i.test(body);

    expect(denied).toBeTruthy();
  });
});
