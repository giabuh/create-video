import path from 'node:path';
import {defineConfig} from 'vitest/config';
export default defineConfig({
  resolve: {alias: {'@studio': path.resolve(import.meta.dirname, '../studio/src')}},
  test: {include: ['server/**/*.test.ts', 'src/**/*.test.{ts,tsx}'], environment: 'node'},
});
