import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'implementations/typescript/index.ts',
    primitives: 'implementations/typescript/primitives.ts',
    validation: 'implementations/typescript/validation.ts',
    time: 'implementations/typescript/time.ts',
    geo: 'implementations/typescript/geo.ts',
    ids: 'implementations/typescript/ids.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  target: 'es2022',
  outDir: 'dist',
});
