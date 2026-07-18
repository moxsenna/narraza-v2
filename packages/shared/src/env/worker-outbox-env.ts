import { z } from 'zod';

const schema = z.object({
  DATABASE_URL_OUTBOX: z.string().min(1),
  NODE_ENV: z.string().optional(),
});

export type WorkerOutboxEnv = z.infer<typeof schema>;

export function parseWorkerOutboxEnv(raw: NodeJS.ProcessEnv): WorkerOutboxEnv {
  return schema.parse({
    DATABASE_URL_OUTBOX: raw.DATABASE_URL_OUTBOX,
    NODE_ENV: raw.NODE_ENV,
  });
}
