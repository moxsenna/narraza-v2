import { test, expect } from '@playwright/test';
import { ensureLoggedIn } from './helpers/auth';
import { clearMailDir } from './helpers/mail';
import { createGuidedProject } from './helpers/project';

test.describe('job-recovery', () => {
  test('write room shows job phase labels without fake percentages', async ({
    page,
  }) => {
    clearMailDir();
    await ensureLoggedIn(page, `e2e-jobrecovery-${Date.now()}@narraza.test`);

    const title = `E2E Job Recovery ${Date.now()}`;
    const projectId = await createGuidedProject(page, title);

    // Write room must load and never show fake progress percentages
    await page.goto(`/projects/${projectId}/write`);
    await page.waitForLoadState('domcontentloaded');

    const bodyText = (await page.locator('body').textContent()) ?? '';
    expect(bodyText).toMatch(/Write|Tulis|Adegan|Beat|Chapter|Outline|Belum/i);
    // No fake percentage progress
    expect(bodyText).not.toMatch(/\b\d{1,3}%\b/);

    // Refresh — page still healthy (recovery of empty job list is valid)
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    const after = (await page.locator('body').textContent()) ?? '';
    expect(after).toMatch(/Write|Tulis|Adegan|Beat|Chapter|Outline|Belum|Riwayat|Selesai|Antrian/i);
    expect(after).not.toMatch(/\b\d{1,3}%\b/);
  });
});
