import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());

function loadEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const out: Record<string, string> = {};
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(String.fromCharCode(10));
  for (const line of lines) {
    const t = line.replace(String.fromCharCode(13), '').trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    out[t.slice(0, i)] = t.slice(i + 1);
  }
  return out;
}

// When running from e2e/, cwd may be e2e — resolve repo root
const candidateRoots = [
  root,
  path.resolve(root, '..'),
  path.resolve(root, 'e2e', '..'),
];
let repoRoot = root;
for (const c of candidateRoots) {
  if (fs.existsSync(path.join(c, 'package.json')) && fs.existsSync(path.join(c, 'apps'))) {
    repoRoot = c;
    break;
  }
}

const rootEnv = loadEnvFile(path.join(repoRoot, '.env'));

export default defineConfig({
  testDir: path.join(repoRoot, 'e2e'),
  timeout: 90000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: path.join(repoRoot, 'playwright-report') }]],
  outputDir: path.join(repoRoot, 'test-results'),

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev -w @narraza/web',
    cwd: repoRoot,
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 180000,
    env: {
      ...process.env,
      ...rootEnv,
      NODE_ENV: 'development',
    },
  },
});
