import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@narraza/core',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
