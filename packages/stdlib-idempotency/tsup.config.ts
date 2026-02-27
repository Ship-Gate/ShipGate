import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'implementations/typescript/index.ts',
    types: 'implementations/typescript/types.ts',
    utils: 'implementations/typescript/utils.ts',
    manager: 'implementations/typescript/manager.ts',
    'store/memory': 'implementations/typescript/store/memory.ts',
    'store/redis': 'implementations/typescript/store/redis.ts',
    'store/postgres': 'implementations/typescript/store/postgres.ts',
    'middleware/express': 'implementations/typescript/middleware/express.ts',
    'middleware/fastify': 'implementations/typescript/middleware/fastify.ts',
  },
  format: ['cjs', 'esm'],
  tsconfig: 'tsconfig.json',
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  external: [
    'express',
    'fastify',
    'ioredis',
    'redis',
    'pg',
    '@isl-lang/isl-core',
  ],
});
