import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'implementations/typescript/index.ts',
    http: 'implementations/typescript/http.ts',
    endpoint: 'implementations/typescript/endpoint.ts',
    crud: 'implementations/typescript/crud.ts',
    graphql: 'implementations/typescript/graphql.ts',
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
