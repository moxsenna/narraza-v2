import { z } from 'zod';

const schema = z
  .object({
    DATABASE_URL_WORKER: z.string().min(1),
    ARTIFACT_STORAGE_PATH: z.string().min(1),
    AI_ENABLE_MOCK: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    /** Preferred API key env for OpenAI-compatible providers */
    AI_API_KEY: z.string().min(20).optional(),
    /** Legacy alias — still accepted */
    OPENROUTER_API_KEY: z.string().min(20).optional(),
    GEMINI_API_KEY: z.string().min(20).optional(),
    AI_BASE_URL: z.string().url().optional(),
    AI_MODEL: z.string().min(1).optional(),
    AI_FALLBACK_MODEL: z.string().min(1).optional(),
    AI_PROVIDER_LABEL: z.string().min(1).optional(),
    NODE_ENV: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.NODE_ENV === 'production' && val.AI_ENABLE_MOCK) {
      ctx.addIssue({
        code: 'custom',
        path: ['AI_ENABLE_MOCK'],
        message: 'AI_ENABLE_MOCK=true forbidden in production',
      });
    }
    const hasKey = Boolean(val.AI_API_KEY || val.OPENROUTER_API_KEY);
    if (!val.AI_ENABLE_MOCK && !hasKey) {
      ctx.addIssue({
        code: 'custom',
        path: ['AI_API_KEY'],
        message: 'AI_API_KEY (or OPENROUTER_API_KEY) required when mock off',
      });
    }
  });

export type WorkerGenEnv = z.infer<typeof schema>;

export function parseWorkerGenEnv(raw: NodeJS.ProcessEnv): WorkerGenEnv {
  return schema.parse({
    DATABASE_URL_WORKER: raw.DATABASE_URL_WORKER,
    ARTIFACT_STORAGE_PATH: raw.ARTIFACT_STORAGE_PATH,
    AI_ENABLE_MOCK: raw.AI_ENABLE_MOCK,
    AI_API_KEY: raw.AI_API_KEY,
    OPENROUTER_API_KEY: raw.OPENROUTER_API_KEY,
    GEMINI_API_KEY: raw.GEMINI_API_KEY,
    AI_BASE_URL: raw.AI_BASE_URL,
    AI_MODEL: raw.AI_MODEL,
    AI_FALLBACK_MODEL: raw.AI_FALLBACK_MODEL,
    AI_PROVIDER_LABEL: raw.AI_PROVIDER_LABEL,
    NODE_ENV: raw.NODE_ENV,
  });
}
