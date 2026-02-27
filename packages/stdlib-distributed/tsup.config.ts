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
  dts: false,
  // Declarations emitted via tsc --emitDeclarationOnly in build script (avoids tsup pulling workspace .d.ts as root files)
  clean: true,
  sourcemap: true,
  splitting: false,
});
