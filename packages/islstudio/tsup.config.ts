import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm'],
  clean: true,
  noExternal: [/@isl-lang\/.*/],
  splitting: false,
  treeshake: true,
});
