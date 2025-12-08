/**
 * Vitest Configuration
 * @see https://vitest.dev/config/
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'test/**',
        'docs/**',
        'examples/**',
        '**/*.config.js'
      ]
    },
    include: ['test/**/*.test.js'],
    exclude: ['node_modules/**', 'dist/**']
  }
});
