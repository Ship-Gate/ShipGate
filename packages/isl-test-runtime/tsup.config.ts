import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/trace-emitter.ts',
    'src/test-generator.ts',
    'src/login-harness.ts',
    'src/fixture-adapter.ts',
  ],
  format: ['esm'],
  dts: false, // Temporarily disabled due to workspace linking issues
  clean: true,
  splitting: false,
  sourcemap: true,
  bundle: true,
  treeshake: false,
  external: ['@isl-lang/trace-format', '@isl-lang/trace-viewer'],
});
