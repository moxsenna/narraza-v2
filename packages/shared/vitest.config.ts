import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@narraza/shared',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
