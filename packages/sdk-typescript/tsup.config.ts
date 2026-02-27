import { defineConfig } from 'tsup';

export default defineConfig([
  // Main entry
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    minify: false,
    splitting: false,
  },
  // React integration
  {
    entry: ['src/react/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    outDir: 'dist/react',
    external: ['react'],
  },
]);
