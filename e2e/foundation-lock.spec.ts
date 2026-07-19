import { test, expect } from '@playwright/test';
import { ensureLoggedIn } from './helpers/auth.js';
import { clearMailDir } from './helpers/mail.js';

const TEST_EMAIL = 'e2e-foundation@narraza.test';
const PROJECT_TITLE = 'E2E Foundation Test';

test.describe('foundation-lock', () => {
  test.beforeEach(async ({ page }) => {
    clearMailDir();
    await ensureLoggedIn(page, TEST_EMAIL);
  });

  test('create project, enter foundation, lock with confirm', async ({ page }) => {
    // Navigate to start page
    await page.goto('/start');

    // Create project
    await page.fill('input[name="title"]', PROJECT_TITLE);
    await page.click('text=Guided');
    await page.click('button:text("Create Project")');

    // Should redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Click on the project to enter it
    await page.click(`text=${PROJECT_TITLE}`);
    await page.waitForTimeout(2000);

    // We should be in the project (may redirect to intake)
    // Navigate to foundation page
    const currentUrl = page.url();
    const projectId = currentUrl.match(/\/projects\/([^/]+)/)?.[1] ?? '';

    if (projectId) {
      await page.goto(`/projects/${projectId}/foundation`);

      // Fill foundation fields
      await page.fill('textarea[name="premise"]', 'A detective solves a mystery in Jakarta 2045.');
      await page.fill('input[name="genre"]', 'Science Fiction');
      await page.fill('input[name="tone"]', 'Suspenseful');
      await page.fill('input[name="targetAudience"]', 'Young Adult');
      await page.fill('input[name="pov"]', 'First Person');

      // Save foundation first
      await page.click('button:text("Simpan Fondasi")');
      await page.waitForTimeout(1000);

      // Lock foundation with confirm=true
      await page.click('button:text("Konfirmasi")');

      // The lock form has confirm=true as hidden input
      // May redirect or show error — check for locked status
      await page.waitForTimeout(3000);

      // Refresh page to check status
      await page.goto(`/projects/${projectId}/foundation`);

      // Check for locked indicator
      const lockedText = await page.locator('body').textContent();
      expect(lockedText).toMatch(/terkunci|locked/i);
    }
  });
});
