import { test, expect } from '@playwright/test';
import { ensureLoggedIn } from './helpers/auth.js';
import { clearMailDir } from './helpers/mail.js';

const TEST_EMAIL = 'e2e-noleak@narraza.test';

test.describe('no-internal-strings', () => {
  test.beforeEach(async ({ page }) => {
    clearMailDir();
    await ensureLoggedIn(page, TEST_EMAIL);
  });

  test('no service_restricted or internalRationale in DOM on any project page', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);

    const dashHtml = await page.content();
    expect(dashHtml).not.toContain('service_restricted');
    expect(dashHtml).not.toContain('internalRationale');
    expect(dashHtml).not.toContain('CanonicalChangeOperation');
    expect(dashHtml).not.toContain('restrictedGuardSet');

    // Navigate to start page
    await page.goto('/start');
    await page.waitForTimeout(500);

    const startHtml = await page.content();
    expect(startHtml).not.toContain('service_restricted');
    expect(startHtml).not.toContain('internalRationale');

    // Visit auth page
    await page.goto('/auth/email');
    await page.waitForTimeout(500);

    const authHtml = await page.content();
    expect(authHtml).not.toContain('service_restricted');
    expect(authHtml).not.toContain('internalRationale');
    expect(authHtml).not.toContain('rawToken'); // raw token should never be in HTML

    // Create a project and check project pages
    await page.goto('/start');
    await page.fill('input[name="title"]', 'No Leak Test');
    await page.click('text=Guided');
    await page.click('button:text("Create Project")');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    const projectLink = page.locator('text=No Leak Test');
    await expect(projectLink).toBeVisible();
    const href = await projectLink.getAttribute('href');
    const match = href?.match(/\/projects\/([^/]+)/);
    expect(match).toBeTruthy();
    const projectId = match![1]!;

    // Check project pages
    const pagesToCheck = [
      `/projects/${projectId}/intake`,
      `/projects/${projectId}/concepts`,
      `/projects/${projectId}/foundation`,
      `/projects/${projectId}/characters`,
      `/projects/${projectId}/settings`,
    ];

    for (const route of pagesToCheck) {
      await page.goto(route);
      await page.waitForTimeout(1000);

      const html = await page.content();
      expect(html, `Route ${route} should not contain service_restricted`).not.toContain('service_restricted');
      expect(html, `Route ${route} should not contain internalRationale`).not.toContain('internalRationale');
      expect(html, `Route ${route} should not contain CanonicalChangeOperation`).not.toContain('CanonicalChangeOperation');
      expect(html, `Route ${route} should not contain restrictedGuardSet`).not.toContain('restrictedGuardSet');
    }

    // Check proposals page
    await page.goto(`/projects/${projectId}/proposals`);
    await page.waitForTimeout(1000);
    const proposalHtml = await page.content();
    expect(proposalHtml).not.toContain('service_restricted');
    expect(proposalHtml).not.toContain('internalRationale');
    expect(proposalHtml).not.toContain('CanonicalChangeOperation');
  });
});
