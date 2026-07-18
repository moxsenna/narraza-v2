import { z } from 'zod';

const schema = z
  .object({
    DATABASE_URL_WORKER: z.string().min(1),
    ARTIFACT_STORAGE_PATH: z.string().min(1),
    AI_ENABLE_MOCK: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    OPENROUTER_API_KEY: z.string().min(20).optional(),
    GEMINI_API_KEY: z.string().min(20).optional(),
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
    if (!val.AI_ENABLE_MOCK && !val.OPENROUTER_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['OPENROUTER_API_KEY'],
        message: 'required when mock off',
      });
    }
  });

export type WorkerGenEnv = z.infer<typeof schema>;

export function parseWorkerGenEnv(raw: NodeJS.ProcessEnv): WorkerGenEnv {
  return schema.parse({
    DATABASE_URL_WORKER: raw.DATABASE_URL_WORKER,
    ARTIFACT_STORAGE_PATH: raw.ARTIFACT_STORAGE_PATH,
    AI_ENABLE_MOCK: raw.AI_ENABLE_MOCK,
    OPENROUTER_API_KEY: raw.OPENROUTER_API_KEY,
    GEMINI_API_KEY: raw.GEMINI_API_KEY,
    NODE_ENV: raw.NODE_ENV,
  });
}
