import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'implementations/typescript/index.ts',
    types: 'implementations/typescript/types.ts',
    completion: 'implementations/typescript/completion.ts',
    embeddings: 'implementations/typescript/embeddings.ts',
    agents: 'implementations/typescript/agents.ts',
    rag: 'implementations/typescript/rag.ts',
    extraction: 'implementations/typescript/extraction.ts',
    moderation: 'implementations/typescript/moderation.ts',
  },
  format: ['esm', 'cjs'],
  dts: {
    resolve: true,
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  target: 'es2022',
  outDir: 'dist',
});
