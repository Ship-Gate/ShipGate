import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  external: ['@isl-lang/isl-core'],
  banner: {
    js: '"use strict";'
  }
});
