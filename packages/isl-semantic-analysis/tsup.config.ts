import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  tsconfig: './tsconfig.build.json',
  sourcemap: true,
  clean: true,
  splitting: false,
});
