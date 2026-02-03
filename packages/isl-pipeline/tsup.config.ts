import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts', 'src/performance/cli.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  sourcemap: true,
});
