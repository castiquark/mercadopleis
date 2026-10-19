import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  // Server pages under test return JSX; tsconfig keeps it for Next (jsx: preserve).
  oxc: { jsx: { runtime: 'automatic' } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
