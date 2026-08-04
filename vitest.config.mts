import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      // plain node_modules/react has no cache() export; next build resolves
      // 'react' to this bundle for that reason, so tests need to match
      react: path.resolve(import.meta.dirname, './node_modules/next/dist/compiled/react'),
    },
  },
});
