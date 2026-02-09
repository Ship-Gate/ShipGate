import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  external: [
    // Optional AI dependencies - only used if available
    'openai',
    '@anthropic-ai/sdk',
    '@isl-lang/ai-generator',
    // Node built-ins used by CLI integration
    'readline',
    'fs/promises',
    'path',
  ],
});
