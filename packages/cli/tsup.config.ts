import { defineConfig } from 'tsup';

export default defineConfig({
  // Output as dist/cli.js — matches the "bin" field in package.json
  entry: { cli: 'src/index.ts' },

  // CJS format so that bundled CJS deps (commander, etc.) can use
  // native require() for Node builtins like 'events', 'fs', etc.
  // ESM-only deps (chalk v5, ora v8) are converted to CJS by esbuild.
  format: ['cjs'],
  target: 'node18',

  // Source file (src/index.ts) has #!/usr/bin/env node shebang.
  // esbuild preserves it automatically.

  // Bundle ALL npm + workspace dependencies into the output so
  // `npx shipgate` works without extra installs.
  noExternal: [/.*/],

  // Optional / heavyweight deps that are behind dynamic import + try/catch.
  // These fail gracefully at runtime if not installed.
  external: [
    '@isl-lang/inference',
    '@isl-lang/intent-translator',
    '@isl-lang/isl-smt',
    '@isl-lang/pbt',
    '@isl-lang/spec-assist',
    '@isl-lang/verifier-temporal',
  ],

  clean: true,
  sourcemap: false,
  splitting: false,
  treeshake: true,
  minify: false,
  dts: false,
});
