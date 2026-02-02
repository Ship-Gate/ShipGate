import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'vm/index': 'src/vm/index.ts',
    'scheduler/index': 'src/scheduler/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['isolated-vm', 'quickjs-emscripten'],
});
