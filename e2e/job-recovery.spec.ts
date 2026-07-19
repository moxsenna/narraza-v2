import { test, expect } from '@playwright/test';
import { ensureLoggedIn } from './helpers/auth';
import { clearMailDir } from './helpers/mail';

const TEST_EMAIL = 'e2e-jobrecovery@narraza.test';
const PROJECT_TITLE = 'E2E Job Recovery Test';

test.describe('job-recovery', () => {
  test.beforeEach(async ({ page }) => {
    clearMailDir();
    await ensureLoggedIn(page, TEST_EMAIL);
  });

  test('page recover active jobs after refresh', async ({ page }) => {
    // Create a project
    await page.goto('/start');
    await page.fill('input[name="title"]', PROJECT_TITLE);
    await page.click('text=Guided');
    await page.click('button:text("Create Project")');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Navigate to the project
    const projectLink = page.locator(`text=${PROJECT_TITLE}`);
    await expect(projectLink).toBeVisible();
    const href = await projectLink.getAttribute('href');
    const match = href?.match(/\/projects\/([^/]+)/);
    expect(match).toBeTruthy();
    const projectId = match![1]!;

    // Go to write page
    await page.goto(`/projects/${projectId}/write`);
    await page.waitForTimeout(2000);

    // Submit a beat write job
    const writeButton = page.locator('button:text("Minta AI Tulis")').first();
    if (await writeButton.isVisible()) {
      await writeButton.click();
      await page.waitForTimeout(3000);

      // The page should show "Sedang Diproses" job labels
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toMatch(/Sedang Diproses|Antrian|Menulis/i);

      // Refresh the page — jobs should still be visible (recovery)
      await page.reload();
      await page.waitForTimeout(3000);

      // Check that jobs or status labels are still present
      const afterRefresh = await page.locator('body').textContent();
      expect(afterRefresh).toMatch(/Sedang Diproses|Antrian|Menulis|Riwayat|Selesai/i);
    }
  });
});
