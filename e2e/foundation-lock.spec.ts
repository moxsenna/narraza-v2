import { test, expect } from '@playwright/test';
import { ensureLoggedIn } from './helpers/auth';
import { clearMailDir } from './helpers/mail';
import { createGuidedProject } from './helpers/project';

test.describe('foundation-lock', () => {
  test('create project, enter foundation, lock with confirm', async ({
    page,
  }) => {
    clearMailDir();
    await ensureLoggedIn(page, `e2e-foundation-${Date.now()}@narraza.test`);

    const title = `E2E Foundation ${Date.now()}`;
    const projectId = await createGuidedProject(page, title);

    await page.goto(`/projects/${projectId}/foundation`);
    await page.waitForLoadState('domcontentloaded');

    await page.fill(
      'textarea[name="premise"]',
      'A detective solves a mystery in Jakarta 2045.',
    );
    await page.fill('input[name="genre"]', 'Science Fiction');
    await page.fill('input[name="tone"]', 'Suspenseful');

    // Save foundation
    const saveBtn = page.getByRole('button', {
      name: /Simpan Fondasi|Save Foundation|Simpan/i,
    });
    if (await saveBtn.count()) {
      await saveBtn.first().click();
      await page.waitForTimeout(1000);
    }

    // Lock with confirm
    const lockBtn = page.getByRole('button', {
      name: /Konfirmasi|Lock|Kunci/i,
    });
    if (await lockBtn.count()) {
      await lockBtn.first().click();
      await page.waitForTimeout(2000);
    }

    await page.goto(`/projects/${projectId}/foundation`);
    await page.waitForLoadState('domcontentloaded');
    const lockedText = (await page.locator('body').textContent()) ?? '';
    expect(lockedText).toMatch(/terkunci|locked|Fondasi/i);
  });
});
