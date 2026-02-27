import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    client: 'src/client.ts',
    http: 'implementations/typescript/http.ts',
    endpoint: 'implementations/typescript/endpoint.ts',
    crud: 'implementations/typescript/crud.ts',
    'graphql-schema': 'implementations/typescript/graphql.ts',
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
