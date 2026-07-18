import { describe, expect, it } from 'vitest';
import { parseWorkerGenEnv } from './worker-gen-env.js';
import { parseWebEnv } from './web-env.js';
import { parseWorkerOutboxEnv } from './worker-outbox-env.js';

describe('env parsers', () => {
  it('worker-gen rejects missing keys when mock off', () => {
    expect(() =>
      parseWorkerGenEnv({
        DATABASE_URL_WORKER: 'postgresql://x',
        ARTIFACT_STORAGE_PATH: '.data/artifacts',
        AI_ENABLE_MOCK: 'false',
      } as NodeJS.ProcessEnv),
    ).toThrow();
  });

  it('worker-gen allows mock without provider keys', () => {
    const env = parseWorkerGenEnv({
      DATABASE_URL_WORKER: 'postgresql://x',
      ARTIFACT_STORAGE_PATH: '.data/artifacts',
      AI_ENABLE_MOCK: 'true',
    } as NodeJS.ProcessEnv);
    expect(env.AI_ENABLE_MOCK).toBe(true);
    expect(env.OPENROUTER_API_KEY).toBeUndefined();
  });

  it('web env schema does not expose provider keys', () => {
    const env = parseWebEnv({
      DATABASE_URL_WEB: 'postgresql://x',
      AUTH_SECRET: 'a'.repeat(32),
      AUTH_URL: 'http://localhost:3000',
      EMAIL_FROM: 'Narraza <n@localhost>',
      EMAIL_CHALLENGE_PEPPER: 'b'.repeat(32),
      RATE_LIMIT_PEPPER: 'c'.repeat(32),
      SIGNUP_GRANT_MICRO_IDR: '5000000000',
    } as NodeJS.ProcessEnv);
    expect(env).not.toHaveProperty('OPENROUTER_API_KEY');
    expect(env).not.toHaveProperty('GEMINI_API_KEY');
  });

  it('worker-outbox only requires DATABASE_URL_OUTBOX', () => {
    const env = parseWorkerOutboxEnv({
      DATABASE_URL_OUTBOX: 'postgresql://x',
    } as NodeJS.ProcessEnv);
    expect(env.DATABASE_URL_OUTBOX).toBe('postgresql://x');
    expect(env).not.toHaveProperty('AUTH_SECRET');
    expect(env).not.toHaveProperty('OPENROUTER_API_KEY');
  });

  it('worker-gen production rejects AI_ENABLE_MOCK=true when NODE_ENV=production', () => {
    expect(() =>
      parseWorkerGenEnv({
        DATABASE_URL_WORKER: 'postgresql://x',
        ARTIFACT_STORAGE_PATH: '.data/artifacts',
        AI_ENABLE_MOCK: 'true',
        NODE_ENV: 'production',
      } as NodeJS.ProcessEnv),
    ).toThrow(/mock/i);
  });
});
