import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/python.ts',
    'src/openapi.ts',
    'src/graphql.ts',
    'src/typescript.ts',
    'src/rust.ts',
    'src/go.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  minify: false,
  external: [
    '@isl-lang/codegen-python',
    '@isl-lang/codegen-openapi',
    '@isl-lang/codegen-graphql',
    '@isl-lang/codegen-types',
    '@isl-lang/codegen-rust',
    '@isl-lang/codegen-go',
    '@isl-lang/codegen-validators',
    '@isl-lang/codegen-tests',
    '@isl-lang/codegen-mocks',
    '@isl-lang/codegen-docs',
  ],
});
