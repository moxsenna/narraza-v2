import { z } from 'zod';

const schema = z.object({
  DATABASE_URL_WEB: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url(),
  EMAIL_FROM: z.string().min(1),
  EMAIL_CHALLENGE_PEPPER: z.string().min(32),
  RATE_LIMIT_PEPPER: z.string().min(32),
  SIGNUP_GRANT_MICRO_IDR: z.coerce.number().int().positive(),
  MAIL_TRANSPORT: z.enum(['file', 'smtp']).default('file'),
  MAIL_FILE_DIR: z.string().min(1).default('.data/mail'),
  NODE_ENV: z.string().optional(),
});

export type WebEnv = z.infer<typeof schema>;

export function parseWebEnv(raw: NodeJS.ProcessEnv): WebEnv {
  return schema.parse({
    DATABASE_URL_WEB: raw.DATABASE_URL_WEB,
    AUTH_SECRET: raw.AUTH_SECRET,
    AUTH_URL: raw.AUTH_URL,
    EMAIL_FROM: raw.EMAIL_FROM,
    EMAIL_CHALLENGE_PEPPER: raw.EMAIL_CHALLENGE_PEPPER,
    RATE_LIMIT_PEPPER: raw.RATE_LIMIT_PEPPER,
    SIGNUP_GRANT_MICRO_IDR: raw.SIGNUP_GRANT_MICRO_IDR,
    MAIL_TRANSPORT: raw.MAIL_TRANSPORT,
    MAIL_FILE_DIR: raw.MAIL_FILE_DIR,
    NODE_ENV: raw.NODE_ENV,
  });
}
