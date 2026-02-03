import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'implementations/typescript/index.ts',
    types: 'implementations/typescript/types.ts',
    'storage/memory': 'implementations/typescript/storage/memory.ts',
    'storage/redis': 'implementations/typescript/storage/redis.ts',
    'adapters/express': 'implementations/typescript/adapters/express.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  external: ['ioredis'],
});
