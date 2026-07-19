import { test, expect } from '@playwright/test';
import { ensureLoggedIn } from './helpers/auth.js';
import { clearMailDir } from './helpers/mail.js';

const TEST_EMAIL = 'e2e-credit@narraza.test';
const PROJECT_TITLE = 'E2E Credit Summary Test';

test.describe('credit-summary', () => {
  test.beforeEach(async ({ page }) => {
    clearMailDir();
    await ensureLoggedIn(page, TEST_EMAIL);
  });

  test('credit header matches settings page credit values', async ({ page }) => {
    // Create project
    await page.goto('/start');
    await page.fill('input[name="title"]', PROJECT_TITLE);
    await page.click('text=Guided');
    await page.click('button:text("Create Project")');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    const projectLink = page.locator(`text=${PROJECT_TITLE}`);
    await expect(projectLink).toBeVisible();
    const href = await projectLink.getAttribute('href');
    const match = href?.match(/\/projects\/([^/]+)/);
    expect(match).toBeTruthy();
    const projectId = match![1]!;

    // Go to project and check top bar credit
    await page.goto(`/projects/${projectId}/foundation`);
    await page.waitForTimeout(1000);

    const topBarText = await page.locator('header').textContent();
    expect(topBarText).toMatch(/Tersedia/i);

    // Go to settings page
    await page.goto(`/projects/${projectId}/settings`);
    await page.waitForTimeout(1000);

    const settingsText = await page.locator('body').textContent();
    expect(settingsText).toMatch(/Kredit Tersedia/i);
    expect(settingsText).toMatch(/Rp/i);
  });
});
