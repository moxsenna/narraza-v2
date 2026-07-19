import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@narraza/ai',
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
});
