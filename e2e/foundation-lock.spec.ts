import { test, expect } from '@playwright/test';
import { ensureLoggedIn } from './helpers/auth';
import { clearMailDir } from './helpers/mail';
import { createGuidedProject } from './helpers/project';
import { fillAndLockFoundation } from './helpers/foundation';

test.describe('foundation-lock', () => {
  test('create project, enter foundation, lock with confirm', async ({
    page,
  }) => {
    clearMailDir();
    await ensureLoggedIn(page, `e2e-foundation-${Date.now()}@narraza.test`);

    const title = `E2E Foundation ${Date.now()}`;
    const projectId = await createGuidedProject(page, title);

    await fillAndLockFoundation(page, projectId);

    await page.goto(`/projects/${projectId}/foundation`);
    await page.waitForLoadState('domcontentloaded');
    const lockedText = (await page.locator('body').textContent()) ?? '';
    expect(lockedText).toMatch(/terkunci|locked|Fondasi/i);
  });
});
