import fs from 'node:fs';
import path from 'node:path';

const MAIL_DIR = path.resolve(process.cwd(), '.data', 'mail');

/**
 * Read the latest magic link token from the .data/mail/ directory.
 * Waits up to `timeoutMs` for a new email to arrive.
 */
export async function getLatestMagicLinkToken(
  options?: Partial<{ timeoutMs: number; waitForNewCount: number }>,
): Promise<string | null> {
  const timeoutMs = options?.timeoutMs ?? 15000;
  const startAt = Date.now();

  // Ensure directory exists
  if (!fs.existsSync(MAIL_DIR)) {
    throw new Error(`Mail directory not found: ${MAIL_DIR}. Is MAIL_TRANSPORT=file configured?`);
  }

  let initialFiles = fs.readdirSync(MAIL_DIR).filter((f) => f.endsWith('.txt'));
  const startCount = initialFiles.length;

  while (Date.now() - startAt < timeoutMs) {
    const files = fs.readdirSync(MAIL_DIR).filter((f) => f.endsWith('.txt'));

    // Check if new file appeared
    if (files.length > startCount) {
      const newestFile = files
        .map((f) => ({ name: f, time: fs.statSync(path.join(MAIL_DIR, f)).mtimeMs }))
        .sort((a, b) => b.time - a.time)[0];
      if (!newestFile) return null;

      const content = fs.readFileSync(path.join(MAIL_DIR, newestFile.name), 'utf-8');
      return extractTokenFromEmail(content);
    }

    // If waitForNewCount specified, wait for that count
    if (options?.waitForNewCount && files.length >= options.waitForNewCount) {
      const newestFile = files
        .map((f) => ({ name: f, time: fs.statSync(path.join(MAIL_DIR, f)).mtimeMs }))
        .sort((a, b) => b.time - a.time)[0];
      if (!newestFile) return null;

      const content = fs.readFileSync(path.join(MAIL_DIR, newestFile.name), 'utf-8');
      const token = extractTokenFromEmail(content);
      if (token) return token;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return null;
}

/**
 * Read all magic link tokens from the mail directory.
 */
export function getAllTokens(): string[] {
  if (!fs.existsSync(MAIL_DIR)) return [];

  const files = fs.readdirSync(MAIL_DIR).filter((f) => f.endsWith('.txt'));
  return files
    .map((f) => {
      const content = fs.readFileSync(path.join(MAIL_DIR, f), 'utf-8');
      return extractTokenFromEmail(content);
    })
    .filter((t): t is string => t !== null);
}

function extractTokenFromEmail(content: string): string | null {
  // Token URL format: /auth/email/confirm?token=<RAW_TOKEN>
  const match = content.match(/token=([^\s&"<>]+)/);
  if (!match || !match[1]) return null;
  return match[1];
}

/**
 * Clear all mail files.
 */
export function clearMailDir(): void {
  if (!fs.existsSync(MAIL_DIR)) return;
  const files = fs.readdirSync(MAIL_DIR).filter((f) => f.endsWith('.txt'));
  for (const f of files) {
    fs.unlinkSync(path.join(MAIL_DIR, f));
  }
}
