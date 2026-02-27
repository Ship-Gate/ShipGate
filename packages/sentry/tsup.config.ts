import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    client: 'src/client.ts',
    'integrations/index': 'src/integrations/index.ts',
    'middleware/index': 'src/middleware/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  external: [
    '@sentry/node',
    '@sentry/profiling-node',
    '@sentry/types',
  ],
});
