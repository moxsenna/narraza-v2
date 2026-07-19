import { test, expect } from '@playwright/test';
import { loginViaMagicLink } from './helpers/auth';
import { clearMailDir } from './helpers/mail';
import { createGuidedProject } from './helpers/project';
import { fillAndLockFoundation } from './helpers/foundation';

/**
 * Guided vertical slice as far as UI + mock AI wiring allow.
 * Job-backed stages (intake/outline/beat) are best-effort when worker-gen is running.
 */
test.describe('vertical-slice', () => {
  test('magic link -> project -> foundation lock -> characters -> public pages clean', async ({
    page,
  }) => {
    clearMailDir();
    const email = `e2e-vertical-${Date.now()}@narraza.test`;
    await loginViaMagicLink(page, email);
    await expect(page.url()).toContain('/dashboard');

    const title = `E2E Vertical ${Date.now()}`;
    const projectId = await createGuidedProject(page, title);

    // Intake page loads (job optional)
    await page.goto(`/projects/${projectId}/intake`);
    await page.waitForLoadState('domcontentloaded');
    const intakeBody = (await page.locator('body').textContent()) ?? '';
    expect(intakeBody).toMatch(/Intake|Ekstraksi|ide|cerita/i);

    // Foundation edit + lock (expanded readiness checklist)
    await fillAndLockFoundation(page, projectId, {
      premise:
        'A hacker discovers the truth about an AI system controlling Jakarta in 2045.',
      genre: 'Cyberpunk',
      tone: 'Dark and Suspenseful',
    });

    // Characters
    await page.goto(`/projects/${projectId}/characters`);
    await page.waitForLoadState('domcontentloaded');
    const charInput = page.locator('input[name="name"]');
    if (await charInput.isVisible()) {
      await charInput.fill('Rina');
      const add = page.getByRole('button', { name: /Tambah|Add/i });
      if (await add.count()) await add.first().click();
      await page.waitForTimeout(800);
    }

    // Outline / write / proposals / settings — load without restricted leaks
    for (const route of [
      `/projects/${projectId}/outline`,
      `/projects/${projectId}/write`,
      `/projects/${projectId}/proposals`,
      `/projects/${projectId}/settings`,
    ]) {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');
      const html = await page.content();
      expect(html).not.toContain('service_restricted');
      expect(html).not.toContain('internalRationale');
      expect(html).not.toContain('CanonicalChangeOperation');
      expect(html).not.toContain('restrictedGuardSet');
    }

    const settings = (await page.locator('body').textContent()) ?? '';
    expect(settings).toMatch(/Kredit|Ringkasan|Tersedia|Rp/i);
  });
});
