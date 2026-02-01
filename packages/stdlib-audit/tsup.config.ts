import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'implementations/typescript/index.ts',
    types: 'implementations/typescript/types.ts',
    logger: 'implementations/typescript/logger.ts',
    'storage/postgres': 'implementations/typescript/storage/postgres.ts',
    'storage/elasticsearch': 'implementations/typescript/storage/elasticsearch.ts',
    'storage/s3': 'implementations/typescript/storage/s3.ts',
    'exporters/csv': 'implementations/typescript/exporters/csv.ts',
    'exporters/json': 'implementations/typescript/exporters/json.ts',
    'utils/pii': 'implementations/typescript/utils/pii.ts',
    'utils/hashing': 'implementations/typescript/utils/hashing.ts',
    'utils/retention': 'implementations/typescript/utils/retention.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  external: [],
  esbuildOptions(options) {
    options.platform = 'node';
  },
});
