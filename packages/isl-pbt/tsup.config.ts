import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  sourcemap: true,
  banner: {
    // Add shebang to CLI entry only
    js: '',
  },
  esbuildOptions(options, context) {
    if (context.format === 'esm') {
      options.banner = {
        js: '// @isl-lang/pbt',
      };
    }
  },
});
