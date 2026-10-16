import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@shopping-cart/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/app/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts', 'src/app/app.config.ts'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80
      }
    }
  }
});
