/**
 * deploy/ecosystem.config.cjs
 *
 * PM2 ecosystem configuration for Narraza v2.
 *
 * LEAST-PRIVILEGE SECRETS MODEL (design S6.3, M8.4):
 *
 * Each process gets ONLY the secrets it needs — no process receives
 * the full secret set. If a process is compromised, the blast radius
 * is limited to its own scope.
 *
 *   Process               | Secrets Provided
 *   ----------------------+--------------------------------------------------
 *   narraza-web           | AUTH_SECRET, DATABASE_URL_WEB, EMAIL_FROM,
 *                          | EMAIL_CHALLENGE_PEPPER, RATE_LIMIT_PEPPER,
 *                          | SIGNUP_GRANT_MICRO_IDR, MAIL_TRANSPORT,
 *                          | MAIL_FILE_DIR
 *                          | NO: DATABASE_URL_WORKER, DATABASE_URL_OUTBOX,
 *                          |      OPENROUTER_API_KEY, GEMINI_API_KEY
 *   ----------------------+--------------------------------------------------
 *   narraza-worker-gen    | DATABASE_URL_WORKER, OPENROUTER_API_KEY,
 *                          | GEMINI_API_KEY, ARTIFACT_STORAGE_PATH,
 *                          | AI_ENABLE_MOCK
 *                          | NO: DATABASE_URL_WEB, DATABASE_URL_OUTBOX,
 *                          |      AUTH_SECRET, email secrets, peppers
 *   ----------------------+--------------------------------------------------
 *   narraza-worker-outbox | DATABASE_URL_OUTBOX only
 *                          | NO: DATABASE_URL_WEB, DATABASE_URL_WORKER,
 *                          |      AUTH_SECRET, AI keys, email secrets,
 *                          |      peppers, signup grant
 *
 * VERIFICATION:
 *   - No shared full secrets across processes
 *   - Web cannot read AI keys
 *   - Gen worker cannot read auth secrets
 *   - Outbox worker cannot read anything except its DB URL
 *
 * See deploy/SECRETS.md for the full required-environment-variable listing.
 *
 * Usage:
 *   pm2 start deploy/ecosystem.config.cjs
 *   pm2 save
 */

module.exports = {
  apps: [
    {
      name: 'narraza-web',
      cwd: './apps/web',
      script: 'node_modules/.bin/next',
      args: 'start',
      instances: process.env.NARRAZA_WEB_INSTANCES || 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.NARRAZA_WEB_PORT || 3000,
        // Web-only secrets
        DATABASE_URL_WEB: process.env.DATABASE_URL_WEB,
        AUTH_SECRET: process.env.AUTH_SECRET,
        AUTH_URL: process.env.AUTH_URL,
        EMAIL_FROM: process.env.EMAIL_FROM,
        EMAIL_CHALLENGE_PEPPER: process.env.EMAIL_CHALLENGE_PEPPER,
        RATE_LIMIT_PEPPER: process.env.RATE_LIMIT_PEPPER,
        SIGNUP_GRANT_MICRO_IDR: process.env.SIGNUP_GRANT_MICRO_IDR,
        MAIL_TRANSPORT: process.env.MAIL_TRANSPORT || 'file',
        MAIL_FILE_DIR: process.env.MAIL_FILE_DIR || '.data/mail',
        // No DATABASE_URL_WORKER, DATABASE_URL_OUTBOX, or AI keys
      },
      error_file: './logs/narraza-web-error.log',
      out_file: './logs/narraza-web-out.log',
      merge_logs: true,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 15000,
      listen_timeout: 10000,
    },
    {
      name: 'narraza-worker-gen',
      cwd: './apps/worker-gen',
      script: 'dist/main.js',
      instances: process.env.NARRAZA_WORKER_GEN_INSTANCES || 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        // Worker-gen secrets
        DATABASE_URL_WORKER: process.env.DATABASE_URL_WORKER,
        ARTIFACT_STORAGE_PATH: process.env.ARTIFACT_STORAGE_PATH || '.data/artifacts',
        AI_ENABLE_MOCK: process.env.AI_ENABLE_MOCK || 'false',
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        WORKER_GEN_POLL_MS: process.env.WORKER_GEN_POLL_MS || '1000',
        WORKER_GEN_LEASE_MS: process.env.WORKER_GEN_LEASE_MS || '60000',
        WORKER_GEN_HEARTBEAT_MS: process.env.WORKER_GEN_HEARTBEAT_MS || '15000',
        // No DATABASE_URL_WEB, DATABASE_URL_OUTBOX, or email secrets
      },
      error_file: './logs/narraza-worker-gen-error.log',
      out_file: './logs/narraza-worker-gen-out.log',
      merge_logs: true,
      max_restarts: 5,
      min_uptime: '10s',
      kill_timeout: 30000,
    },
    {
      name: 'narraza-worker-outbox',
      cwd: './apps/worker-outbox',
      script: 'dist/main.js',
      instances: process.env.NARRAZA_WORKER_OUTBOX_INSTANCES || 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        // Outbox-only secrets
        DATABASE_URL_OUTBOX: process.env.DATABASE_URL_OUTBOX,
        WORKER_OUTBOX_POLL_MS: process.env.WORKER_OUTBOX_POLL_MS || '1000',
        WORKER_OUTBOX_HEARTBEAT_MS: process.env.WORKER_OUTBOX_HEARTBEAT_MS || '15000',
        // No DATABASE_URL_WEB, DATABASE_URL_WORKER, email, or AI keys
      },
      error_file: './logs/narraza-worker-outbox-error.log',
      out_file: './logs/narraza-worker-outbox-out.log',
      merge_logs: true,
      max_restarts: 5,
      min_uptime: '10s',
      kill_timeout: 30000,
    },
  ],
};
