import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  test: {
    environmentMatchGlobs: [
      ['src/ui/**', 'jsdom'],
      ['**/*.tsx', 'jsdom'],
    ],
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    globals: true,
    exclude: ['node_modules', 'dist', 'test/e2e/**'],
  },
});
