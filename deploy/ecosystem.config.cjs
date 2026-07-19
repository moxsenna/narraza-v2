/**
 * deploy/ecosystem.config.cjs
 *
 * PM2 ecosystem configuration for Narraza v2.
 *
 * Each process gets only the secrets it needs (least-privilege):
 *  - web:     AUTH + DB_WEB + email
 *  - gen:     DB_WORKER + AI keys
 *  - outbox:  DB_OUTBOX only
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
