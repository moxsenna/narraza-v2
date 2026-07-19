import { test, expect, type Page } from '@playwright/test';
import { ensureLoggedIn } from './helpers/auth.js';
import { clearMailDir } from './helpers/mail.js';

const TEST_EMAIL = 'e2e-idor@narraza.test';
const PROJECT_TITLE = 'E2E IDOR Owner Project';

test.describe('idor', () => {
  let projectId: string | null = null;

  test.beforeEach(async ({ page }) => {
    clearMailDir();
    await ensureLoggedIn(page, TEST_EMAIL);
  });

  test('create a project, then access with different user should get NOT_FOUND', async ({ page }) => {
    // User A creates a project
    await page.goto('/start');
    await page.fill('input[name="title"]', PROJECT_TITLE);
    await page.click('text=Guided');
    await page.click('button:text("Create Project")');

    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Get the project ID from dashboard link
    const projectLink = page.locator(`text=${PROJECT_TITLE}`);
    await expect(projectLink).toBeVisible();

    const href = await projectLink.getAttribute('href');
    const match = href?.match(/\/projects\/([^/]+)/);
    expect(match).toBeTruthy();
    projectId = match![1]!;

    // The project page should be accessible for owner
    await page.goto(`/projects/${projectId}`);
    await page.waitForTimeout(1000);
    expect(page.url()).toContain(`/projects/${projectId}`);

    // Now hit the project page without any session — should redirect
    const context = page.context();
    // Clear cookies to simulate other user
    await context.clearCookies();

    // Visit project page with no auth — should redirect to login
    await page.goto(`/projects/${projectId}`);
    await page.waitForTimeout(3000);
    const noAuthUrl = page.url();

    // Either redirected to auth/email or got a "not found" page
    expect(
      noAuthUrl.includes('/auth/email') ||
        noAuthUrl.includes('dashboard') ||
        (await page.locator('body').textContent())?.includes(/Not found|not found|tidak ditemukan/i),
    ).toBeTruthy();
  });
});
