import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/check/index.ts',
    'src/fmt/index.ts',
    'src/lint/index.ts',
    'src/imports/index.ts',
    'src/testgen/index.ts',
    'src/ast/index.ts',
    'src/lexer/index.ts',
    'src/parser/index.ts',
    'src/isl-agent/verification/index.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  treeshake: true,
  outDir: 'dist',
  target: 'node18',
  external: [],
});
