import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/cli.ts',
    'src/pipeline.ts',
  ],
  format: ['esm'],
  dts: false, // Generate declarations separately with tsc
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  outDir: 'dist',
  target: 'es2022',
  external: ['@isl-lang/isl-core'],
});
