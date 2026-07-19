import type { Page } from '@playwright/test';

/**
 * Fill expanded foundation readiness fields and save + lock.
 */
export async function fillAndLockFoundation(
  page: Page,
  projectId: string,
  opts?: { premise?: string; genre?: string; tone?: string },
): Promise<void> {
  await page.goto(`/projects/${projectId}/foundation`);
  await page.waitForLoadState('domcontentloaded');

  const premise = page.locator('textarea[name="premise"]');
  if (!(await premise.isVisible())) return;
  if (await premise.isDisabled()) return;

  await premise.fill(
    opts?.premise ??
      'A detective solves a mystery in Jakarta 2045 while hiding from the system.',
  );
  await page.fill('input[name="genre"]', opts?.genre ?? 'Science Fiction');
  await page.fill('input[name="tone"]', opts?.tone ?? 'Suspenseful');

  const audience = page.locator('input[name="targetAudience"]');
  if (await audience.count()) await audience.fill('Young adult');
  const pov = page.locator('input[name="pov"]');
  if (await pov.count()) await pov.fill('Third person limited');
  const emotional = page.locator('input[name="emotionalPromise"]');
  if (await emotional.count()) await emotional.fill('Hope after sacrifice');
  const protagonist = page.locator('input[name="protagonist"]');
  if (await protagonist.count()) await protagonist.fill('Alya');
  const conflict = page.locator('input[name="mainConflict"]');
  if (await conflict.count()) await conflict.fill('Citizen vs surveillance state');
  const canon = page.locator('textarea[name="canonFacts"]');
  if (await canon.count()) {
    await canon.fill('Harbor city exists\nAlya is orphan\nEmpire taxes grain');
  }
  const chapters = page.locator('input[name="targetChapterCount"]');
  if (await chapters.count()) await chapters.fill('30');
  const ending = page.locator('input[name="endingDirection"]');
  if (await ending.count()) await ending.fill('Bittersweet victory');
  const twist = page.locator('input[name="hasTwist"]');
  if (await twist.count()) await twist.check();
  const secret = page.locator('input[name="primarySecret"]');
  if (await secret.count()) await secret.fill('The mayor is the cult leader');
  const revealCh = page.locator('input[name="secretRevealChapter"]');
  if (await revealCh.count()) await revealCh.fill('25');
  const naming = page.locator('input[name="characterNamingRules"]');
  if (await naming.count()) await naming.fill('Titles only for officials');

  const saveBtn = page.getByRole('button', {
    name: /Simpan Fondasi|Save Foundation|Simpan/i,
  });
  if (await saveBtn.count()) {
    await saveBtn.first().click();
    await page.waitForTimeout(1000);
  }

  const lockBtn = page.getByRole('button', {
    name: /Konfirmasi|Lock|Kunci/i,
  });
  if (await lockBtn.count()) {
    await lockBtn.first().click();
    await page.waitForTimeout(1500);
  }
}
