import { test, expect } from '@playwright/test';
import { ensureLoggedIn } from './helpers/auth';
import { clearMailDir } from './helpers/mail';
import { createGuidedProject } from './helpers/project';

const FORBIDDEN = [
  'service_restricted',
  'internalRationale',
  'CanonicalChangeOperation',
  'restrictedGuardSet',
];

test.describe('no-internal-strings', () => {
  test('no restricted internal strings in DOM', async ({ page }) => {
    clearMailDir();
    await ensureLoggedIn(page, `e2e-noleak-${Date.now()}@narraza.test`);

    const routes = ['/dashboard', '/start', '/auth/email'];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');
      const html = await page.content();
      for (const s of FORBIDDEN) {
        expect(html, `route ${route} leaked ${s}`).not.toContain(s);
      }
    }

    const title = `No Leak ${Date.now()}`;
    const projectId = await createGuidedProject(page, title);

    const pagesToCheck = [
      `/projects/${projectId}/intake`,
      `/projects/${projectId}/concepts`,
      `/projects/${projectId}/foundation`,
      `/projects/${projectId}/characters`,
      `/projects/${projectId}/settings`,
      `/projects/${projectId}/proposals`,
    ];

    for (const route of pagesToCheck) {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');
      const html = await page.content();
      for (const s of FORBIDDEN) {
        expect(html, `route ${route} leaked ${s}`).not.toContain(s);
      }
      // raw token should never appear in HTML
      expect(html).not.toContain('rawToken');
    }
  });
});
