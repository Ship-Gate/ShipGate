import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    // New src/ tree
    'src/index': 'src/index.ts',
    'src/types': 'src/types.ts',
    'src/errors': 'src/errors.ts',
    'src/trail/entry': 'src/trail/entry.ts',
    'src/trail/tracker': 'src/trail/tracker.ts',
    'src/trail/store': 'src/trail/store.ts',
    'src/trail/query': 'src/trail/query.ts',
    'src/compliance/checker': 'src/compliance/checker.ts',
    'src/compliance/rules': 'src/compliance/rules.ts',
    'src/compliance/report': 'src/compliance/report.ts',
    'src/aggregation/pipeline': 'src/aggregation/pipeline.ts',
    'src/aggregation/aggregator': 'src/aggregation/aggregator.ts',
    'src/retention/policy': 'src/retention/policy.ts',
    'src/retention/enforcer': 'src/retention/enforcer.ts',
    // Legacy implementations
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
