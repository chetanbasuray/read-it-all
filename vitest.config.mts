import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // vite 8 transforms with oxc, which honours tsconfig's "jsx": "preserve" and
  // leaves raw JSX that import analysis can't parse; next needs that tsconfig
  // value, so the override belongs here instead
  oxc: {
    jsx: { runtime: 'automatic' },
  },
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
