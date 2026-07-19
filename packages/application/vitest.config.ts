import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    name: '@narraza/application',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 15000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    alias: {
      '@narraza/ai': resolve(__dirname, '../ai/src/index.ts'),
    },
  },
});
