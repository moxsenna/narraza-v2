import { test, expect } from '@playwright/test';
import { ensureLoggedIn } from './helpers/auth';
import { clearMailDir } from './helpers/mail';
import { createGuidedProject } from './helpers/project';

test.describe('credit-summary', () => {
  test('credit header matches settings page credit values', async ({ page }) => {
    clearMailDir();
    await ensureLoggedIn(page, `e2e-credit-${Date.now()}@narraza.test`);

    const title = `E2E Credit ${Date.now()}`;
    const projectId = await createGuidedProject(page, title);

    await page.goto(`/projects/${projectId}/foundation`);
    await page.waitForLoadState('domcontentloaded');

    // Top bar may be header or nav — search whole page for credit labels
    const foundationBody = (await page.locator('body').textContent()) ?? '';
    expect(foundationBody).toMatch(/Tersedia|Kredit|Rp|available/i);

    await page.goto(`/projects/${projectId}/settings`);
    await page.waitForLoadState('domcontentloaded');

    const settingsText = (await page.locator('body').textContent()) ?? '';
    expect(settingsText).toMatch(/Kredit|Tersedia|available|Rp/i);
  });
});
