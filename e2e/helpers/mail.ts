import fs from 'node:fs';
import path from 'node:path';

function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (
      fs.existsSync(path.join(dir, 'package.json')) &&
      fs.existsSync(path.join(dir, 'apps'))
    ) {
      return dir;
    }
    dir = path.resolve(dir, '..');
  }
  return process.cwd();
}

const REPO_ROOT = findRepoRoot();
// Relative MAIL_FILE_DIR must resolve against repo root (Playwright cwd may be e2e/).
const MAIL_DIR = process.env.MAIL_FILE_DIR
  ? path.isAbsolute(process.env.MAIL_FILE_DIR)
    ? process.env.MAIL_FILE_DIR
    : path.join(REPO_ROOT, process.env.MAIL_FILE_DIR)
  : path.join(REPO_ROOT, '.data', 'mail');

function listMailFiles(): string[] {
  if (!fs.existsSync(MAIL_DIR)) return [];
  return fs.readdirSync(MAIL_DIR).filter((f) => f.endsWith('.txt'));
}

function newestMailContent(): string | null {
  const files = listMailFiles();
  if (files.length === 0) return null;
  const newest = files
    .map((f) => ({
      name: f,
      time: fs.statSync(path.join(MAIL_DIR, f)).mtimeMs,
    }))
    .sort((a, b) => b.time - a.time)[0];
  if (!newest) return null;
  return fs.readFileSync(path.join(MAIL_DIR, newest.name), 'utf-8');
}

function extractTokenFromEmail(content: string): string | null {
  const match = content.match(/token=([^\s&"<>]+)/);
  if (!match || !match[1]) return null;
  return match[1];
}

/**
 * Wait for a magic-link token.
 * Handles race where mail is written before the waiter starts
 * (common after form submit -> check page -> then poll).
 */
export async function getLatestMagicLinkToken(
  options?: Partial<{ timeoutMs: number; sinceMs: number }>,
): Promise<string | null> {
  const timeoutMs = options?.timeoutMs ?? 15000;
  const sinceMs = options?.sinceMs ?? Date.now() - 5000;
  const startAt = Date.now();

  if (!fs.existsSync(MAIL_DIR)) {
    fs.mkdirSync(MAIL_DIR, { recursive: true });
  }

  while (Date.now() - startAt < timeoutMs) {
    const files = listMailFiles();
    if (files.length > 0) {
      // Prefer files modified after sinceMs; else newest overall
      const candidates = files
        .map((f) => ({
          name: f,
          time: fs.statSync(path.join(MAIL_DIR, f)).mtimeMs,
        }))
        .filter((f) => f.time >= sinceMs)
        .sort((a, b) => b.time - a.time);

      const pick = candidates[0] ??
        files
          .map((f) => ({
            name: f,
            time: fs.statSync(path.join(MAIL_DIR, f)).mtimeMs,
          }))
          .sort((a, b) => b.time - a.time)[0];

      if (pick) {
        const content = fs.readFileSync(
          path.join(MAIL_DIR, pick.name),
          'utf-8',
        );
        const token = extractTokenFromEmail(content);
        if (token) return token;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  // Last chance: newest file regardless of age
  const content = newestMailContent();
  return content ? extractTokenFromEmail(content) : null;
}

export function getAllTokens(): string[] {
  return listMailFiles()
    .map((f) =>
      extractTokenFromEmail(
        fs.readFileSync(path.join(MAIL_DIR, f), 'utf-8'),
      ),
    )
    .filter((t): t is string => t !== null);
}

export function clearMailDir(): void {
  if (!fs.existsSync(MAIL_DIR)) {
    fs.mkdirSync(MAIL_DIR, { recursive: true });
    return;
  }
  for (const f of listMailFiles()) {
    fs.unlinkSync(path.join(MAIL_DIR, f));
  }
}

export function getMailDir(): string {
  return MAIL_DIR;
}
