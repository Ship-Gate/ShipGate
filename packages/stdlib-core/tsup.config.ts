import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    primitives: 'src/primitives.ts',
    validation: 'src/validation.ts',
    time: 'src/time.ts',
    geo: 'src/geo.ts',
    ids: 'src/ids.ts',
  },
  format: ['esm', 'cjs'],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  target: 'es2022',
  outDir: 'dist',
});
