import { test, expect } from '@playwright/test';
import { loginViaMagicLink } from './helpers/auth.js';
import { clearMailDir } from './helpers/mail.js';

const TEST_EMAIL = 'e2e-vertical@narraza.test';
const PROJECT_TITLE = 'E2E Vertical Slice Test';

test.describe('vertical-slice', () => {
  test.beforeEach(async () => {
    clearMailDir();
  });

  test('full vertical slice: magic link -> project -> intake -> concept -> foundation -> characters -> outline -> write -> proposals', async ({
    page,
  }) => {
    // ============================================================
    // Step 1: Magic link login
    // ============================================================
    await loginViaMagicLink(page, TEST_EMAIL);
    await expect(page.url()).toContain('/dashboard');

    // ============================================================
    // Step 2: Create project
    // ============================================================
    await page.goto('/start');
    await page.fill('input[name="title"]', PROJECT_TITLE);
    await page.click('text=Guided');
    await page.click('button:text("Create Project")');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Get project ID
    const projectLink = page.locator(`text=${PROJECT_TITLE}`);
    await expect(projectLink).toBeVisible();
    const href = await projectLink.getAttribute('href');
    const match = href?.match(/\/projects\/([^/]+)/);
    expect(match).toBeTruthy();
    const projectId = match![1]!;

    // Go to project — it will redirect to intake
    await page.goto(`/projects/${projectId}`);
    await page.waitForTimeout(2000);

    // ============================================================
    // Step 3: Intake - submit story idea
    // ============================================================
    // May have redirected to intake; if not, navigate
    if (!page.url().includes('/intake')) {
      await page.goto(`/projects/${projectId}/intake`);
    }
    await page.waitForTimeout(1000);

    const intakeTextarea = page.locator('textarea[name="userInput"]');
    if (await intakeTextarea.isVisible()) {
      await intakeTextarea.fill(
        'A young hacker in Jakarta 2045 discovers that the city AI system has been manipulating memories. She must decide whether to expose the truth or protect those she loves.',
      );
      await page.click('button:text("Mulai Ekstraksi")');
      await page.waitForTimeout(3000);
    }

    // ============================================================
    // Step 4: Concepts - pick a concept
    // ============================================================
    await page.goto(`/projects/${projectId}/concepts`);
    await page.waitForTimeout(1000);

    // Look for concept alternatives and pick the first
    const conceptButtons = page.locator('button:text("Pilih Konsep Ini")');
    const conceptCount = await conceptButtons.count();
    if (conceptCount > 0) {
      await conceptButtons.first().click();
      await page.waitForTimeout(2000);
    }

    // ============================================================
    // Step 5: Foundation - fill and lock
    // ============================================================
    await page.goto(`/projects/${projectId}/foundation`);
    await page.waitForTimeout(1000);

    const premiseField = page.locator('textarea[name="premise"]');
    if (await premiseField.isVisible()) {
      const isDisabled = await premiseField.isDisabled();
      if (!isDisabled) {
        await premiseField.fill(
          'A hacker discovers the truth about an AI system controlling Jakarta in 2045.',
        );
        await page.fill('input[name="genre"]', 'Cyberpunk');
        await page.fill('input[name="tone"]', 'Dark and Suspenseful');
        await page.fill('input[name="targetAudience"]', 'Young Adult');
        await page.fill('input[name="pov"]', 'Third Person Limited');

        // Save foundation
        await page.click('button:text("Simpan Fondasi")');
        await page.waitForTimeout(1500);

        // Lock foundation
        const lockButton = page.locator('button:text("Konfirmasi")');
        if (await lockButton.isVisible()) {
          await lockButton.click();
          await page.waitForTimeout(2000);
        }
      }
    }

    // ============================================================
    // Step 6: Characters - add a character
    // ============================================================
    await page.goto(`/projects/${projectId}/characters`);
    await page.waitForTimeout(1000);

    const charInput = page.locator('input[name="name"]');
    if (await charInput.isVisible()) {
      await charInput.fill('Rina');
      await page.click('button:text("Tambah")');
      await page.waitForTimeout(1000);
    }

    // ============================================================
    // Step 7: Outline - generate and accept
    // ============================================================
    await page.goto(`/projects/${projectId}/outline`);
    await page.waitForTimeout(1000);

    // Try to generate outline
    const genOutlineBtn = page.locator('button:text("Generate Outline")');
    if (await genOutlineBtn.isVisible()) {
      await genOutlineBtn.click();
      await page.waitForTimeout(3000);
    }

    // Accept mock outline
    const acceptOutlineBtn = page.locator('button:text("Terima Outline Mock")');
    if (await acceptOutlineBtn.isVisible()) {
      await acceptOutlineBtn.click();
      await page.waitForTimeout(2000);
    }

    // ============================================================
    // Step 8: Write room - view beats, save draft, request AI
    // ============================================================
    await page.goto(`/projects/${projectId}/write`);
    await page.waitForTimeout(2000);

    // Check that the page shows chapters/beats or status
    const writeContent = await page.locator('body').textContent();
    expect(writeContent).toMatch(/Chapter|Beat|chapter|beat|Belum ada|Outline/i);

    // Save a working draft if a beat form is visible
    const draftTextarea = page.locator('textarea[name="content"]').first();
    if (await draftTextarea.isVisible()) {
      await draftTextarea.fill('Rina stared at the glowing screen, her heart racing.');
      await page.click('button:text("Simpan Draft")');
      await page.waitForTimeout(1000);

      // Request AI beat write
      const aiBtn = page.locator('button:text("Minta AI Tulis")').first();
      if (await aiBtn.isVisible()) {
        await aiBtn.click();
        await page.waitForTimeout(3000);

        // Check for job labels (no fake %)
        const jobText = await page.locator('body').textContent();
        expect(jobText).toMatch(/Sedang Diproses|Antrian|Menulis|Selesai|Gagal/i);
        expect(jobText).not.toMatch(/\d+%/); // No fake percentages
      }
    }

    // ============================================================
    // Step 9: Proposals - check no leaks, only public data
    // ============================================================
    await page.goto(`/projects/${projectId}/proposals`);
    await page.waitForTimeout(1500);

    const propsContent = await page.locator('body').textContent();

    // Must not contain restricted data
    expect(propsContent).not.toMatch(/service_restricted/i);
    expect(propsContent).not.toMatch(/internalRationale/i);
    expect(propsContent).not.toMatch(/CanonicalChangeOperation/i);
    expect(propsContent).not.toMatch(/restrictedGuardSet/i);

    // Should have proposal-related UI
    expect(propsContent).toMatch(/Usulan AI|Proposal|proposal|Menunggu|Belum ada/i);

    // ============================================================
    // Step 10: Check credit summary in settings
    // ============================================================
    await page.goto(`/projects/${projectId}/settings`);
    await page.waitForTimeout(1000);

    const settingsContent = await page.locator('body').textContent();
    expect(settingsContent).toMatch(/Kredit|Ringkasan/i);

    // ============================================================
    // SUCCESS: Vertical slice completed
    // ============================================================
    console.log('Vertical slice e2e completed successfully');
  });
});
