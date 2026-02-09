import { defineConfig } from 'tsup';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

// Load workspace package aliases created by prebuild script
let aliases: Record<string, string> = {};
try {
  const aliasesFile = resolve(__dirname, 'tsup.aliases.json');
  if (existsSync(aliasesFile)) {
    aliases = JSON.parse(readFileSync(aliasesFile, 'utf-8'));
  }
} catch (e) {
  // Aliases file doesn't exist yet, will be created by prebuild
}

// Create esbuild plugin for alias resolution
function createAliasPlugin(aliases: Record<string, string>) {
  return {
    name: 'alias-resolver',
    setup(build: any) {
      // Resolve aliased packages BEFORE esbuild's default resolution
      build.onResolve({ filter: /^@isl-lang\// }, (args: any) => {
        if (aliases[args.path]) {
          const resolvedPath = aliases[args.path];
          console.log(`[alias-resolver] Resolving ${args.path} -> ${resolvedPath}`);
          return {
            path: resolvedPath,
            namespace: 'file',
          };
        }
        // Let esbuild handle it normally if not aliased
        return null;
      });
    },
  };
}

export default defineConfig({
  // Output as dist/cli.cjs — matches the "bin" field in package.json
  // Using .cjs extension because package.json has "type": "module"
  entry: { cli: 'src/index.ts' },

  // CJS format so that bundled CJS deps (commander, etc.) can use
  // native require() for Node builtins like 'events', 'fs', etc.
  // ESM-only deps (chalk v5, ora v8) are converted to CJS by esbuild.
  format: ['cjs'],
  target: 'node18',

  // Source file (src/index.ts) has #!/usr/bin/env node shebang.
  // esbuild preserves it automatically.

  // Bundle ALL dependencies including workspace packages for standalone CLI
  // This ensures npx shipgate works without installing workspace dependencies
  noExternal: [/.*/],

  // Only exclude truly optional/heavyweight deps that are behind dynamic imports
  external: [
    // Optional AI/ML deps (behind dynamic import)
    '@isl-lang/inference',
    '@isl-lang/intent-translator',
    '@isl-lang/spec-assist',
    // Optional verification deps
    '@isl-lang/isl-smt',
    '@isl-lang/pbt',
    '@isl-lang/verifier-temporal',
    '@isl-lang/autofix', // Dynamic import - optional
    '@isl-lang/interpreter', // Dynamic import - optional
    '@isl-lang/api-versioning', // Dynamic import - optional
    '@isl-lang/schema-evolution', // Dynamic import - optional
    // Browser automation (optional, heavy)
    'chromium-bidi',
    'playwright-core',
  ],

  // Configure esbuild with alias plugin
  esbuildOptions(options) {
    options.platform = 'node';
    options.mainFields = ['module', 'main'];
    
    // Add plugins if aliases exist
    if (Object.keys(aliases).length > 0) {
      const aliasPlugin = createAliasPlugin(aliases);
      if (options.plugins) {
        options.plugins.push(aliasPlugin);
      } else {
        options.plugins = [aliasPlugin];
      }
    }
  },

  clean: true,
  sourcemap: false,
  splitting: false,
  treeshake: true,
  minify: false,
  dts: false,
});
