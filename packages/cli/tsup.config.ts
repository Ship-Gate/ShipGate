import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  minify: false,
  // Keep spec-assist and intent-translator external - they use Node fs and optional deps
  external: ['@isl-lang/spec-assist', '@isl-lang/intent-translator'],
  // Source file already has shebang, don't add again
});
