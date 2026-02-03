import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/evaluator.ts', 'src/environment.ts'],
  format: ['esm', 'cjs'],
  dts: false,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  minify: false,
});
