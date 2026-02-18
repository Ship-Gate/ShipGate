#!/usr/bin/env node
/**
 * Custom build script using esbuild directly with plugin support
 * This allows us to properly resolve workspace packages
 */

import { build } from 'esbuild';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_DIR = resolve(__dirname, '..');
const ROOT_DIR = resolve(CLI_DIR, '../..');

// Read version from package.json for injection
let cliVersion = '1.0.0';
try {
  const pkgPath = resolve(CLI_DIR, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  if (pkg.version) cliVersion = pkg.version;
} catch (_) {}

// Load aliases
let aliases = {};
try {
  const aliasesFile = resolve(CLI_DIR, 'tsup.aliases.json');
  if (existsSync(aliasesFile)) {
    aliases = JSON.parse(readFileSync(aliasesFile, 'utf-8'));
  }
} catch (e) {
  console.warn('⚠ Could not load aliases file');
}

// Create alias plugin
const aliasPlugin = {
  name: 'alias-resolver',
  setup(build) {
    build.onResolve({ filter: /^@isl-lang\// }, (args) => {
      if (aliases[args.path]) {
        return {
          path: aliases[args.path],
          namespace: 'file',
        };
      }
      return null;
    });
  },
};

// Build configuration
const buildOptions = {
  entryPoints: [resolve(CLI_DIR, 'src/index.ts')],
  bundle: true,
  outfile: resolve(CLI_DIR, 'dist/cli.cjs'),
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  define: {
    __SHIPGATE_CLI_VERSION__: JSON.stringify(cliVersion),
  },
  // Shebang is already in src/index.ts, esbuild will preserve it
  external: [
    '@isl-lang/security-scanner',
    '@isl-lang/coherence-engine',
    '@isl-lang/inference',
    '@isl-lang/intent-translator',
    '@isl-lang/spec-assist',
    '@isl-lang/isl-smt',
    '@isl-lang/pbt',
    '@isl-lang/verifier-temporal',
    '@isl-lang/autofix',
    '@isl-lang/interpreter',
    '@isl-lang/api-versioning',
    '@isl-lang/schema-evolution',
    '@isl-lang/codegen-python',
    '@isl-lang/codegen-graphql',
    'chromium-bidi',
    'playwright-core',
    // OpenTelemetry packages - circular deps prevent bundling, installed as runtime deps
    '@opentelemetry/api',
    '@opentelemetry/resources',
    '@opentelemetry/sdk-trace-base',
    '@opentelemetry/sdk-trace-node',
    '@opentelemetry/semantic-conventions',
  ],
  plugins: Object.keys(aliases).length > 0 ? [aliasPlugin] : [],
  minify: false,
  sourcemap: false,
  treeShaking: true,
};

console.log('▸ Building CLI with esbuild...');
console.log(`  Aliases loaded: ${Object.keys(aliases).length} packages\n`);

try {
  const result = await build(buildOptions);
  console.log('✓ Build successful');
  if (result.warnings && result.warnings.length > 0) {
    console.warn('\n⚠ Warnings:');
    result.warnings.forEach(w => console.warn(`  ${w.text}`));
  }
} catch (error) {
  console.error('✗ Build failed');
  if (error.errors) {
    error.errors.forEach((e) => {
      const loc = e.location;
      if (loc) {
        console.error(`  ${loc.file}:${loc.line}:${loc.column} - ${e.text}`);
      } else {
        console.error(`  ${e.text}`);
      }
    });
  } else {
    console.error('  ', error.message || error);
  }
  process.exit(1);
}
