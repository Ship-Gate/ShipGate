import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/actor.ts',
    'src/crdt.ts',
    'src/saga.ts',
    'src/consensus.ts',
    'src/coordination.ts',
    'src/service-mesh.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
});
