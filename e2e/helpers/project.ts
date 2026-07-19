import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Create a guided project via /start and return projectId from dashboard link.
 */
export async function createGuidedProject(
  page: Page,
  title: string,
): Promise<string> {
  await page.goto('/start');
  await page.fill('input[name="title"]', title);

  // startMode radio — prefer label text, fall back to value
  const guided = page.locator('input[name="startMode"][value="guided"]');
  if (await guided.count()) {
    await guided.check();
  } else {
    await page.getByText(/Guided|Terpandu/i).first().click();
  }

  const submit = page
    .locator('button[type="submit"]')
    .or(page.getByRole('button', { name: /Create Project|Buat Proyek|Mulai/i }));
  await submit.first().click();

  await page.waitForURL(/\/dashboard/, { timeout: 20000 });

  // Prefer exact link containing title
  const projectLink = page.locator(`a[href*="/projects/"]`, {
    hasText: title,
  });
  await expect(projectLink.first()).toBeVisible({ timeout: 15000 });
  const href = await projectLink.first().getAttribute('href');
  const match = href?.match(/\/projects\/([^/?#]+)/);
  if (!match?.[1]) {
    // Fallback: any project link on dashboard
    const any = page.locator('a[href*="/projects/"]').first();
    const anyHref = await any.getAttribute('href');
    const anyMatch = anyHref?.match(/\/projects\/([^/?#]+)/);
    if (!anyMatch?.[1]) {
      throw new Error(
        `Could not resolve projectId after create. title=${title} href=${href} anyHref=${anyHref}`,
      );
    }
    return anyMatch[1];
  }
  return match[1];
}
