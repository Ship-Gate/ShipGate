import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: {
    compilerOptions: {
      skipLibCheck: true,
    },
  },
  clean: true,
  tsconfig: 'tsconfig.json',
  skipNodeModulesBundle: true,
  external: [
    '@isl-lang/translator',
    '@isl-lang/generator',
    '@isl-lang/isl-core',
    '@isl-lang/parser',
    '@isl-lang/evaluator',
    '@isl-lang/isl-coverage',
    '@isl-lang/secrets-hygiene',
  ],
});
