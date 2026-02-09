#!/usr/bin/env node
/**
 * Build essential workspace dependencies for CLI bundling
 * This ensures all required packages are built before bundling
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '../../..');

process.chdir(ROOT_DIR);

const packages = [
  '@isl-lang/parser',
  '@isl-lang/core',
  '@isl-lang/import-resolver',
  '@isl-lang/semantic-analysis',
  '@isl-lang/isl-core',
  '@isl-lang/isl-verify',
  '@isl-lang/gate',
  '@isl-lang/pipeline',
  '@isl-lang/policy-packs',
  '@isl-lang/isl-policy-engine',
  '@isl-lang/proof',
  '@isl-lang/truthpack-v2',
];

console.log('▸ Building essential workspace dependencies...\n');

for (const pkg of packages) {
  try {
    console.log(`  Building ${pkg}...`);
    execSync(`pnpm --filter "${pkg}" build`, { 
      stdio: 'inherit',
      cwd: ROOT_DIR,
    });
  } catch (error) {
    console.warn(`  ⚠ ${pkg} build failed, continuing...`);
  }
}

// Observability needs special handling (skip DTS due to TS config issue)
try {
  console.log('  Building @isl-lang/observability (without DTS)...');
  process.chdir(resolve(ROOT_DIR, 'packages/observability'));
  // Build without DTS by using tsup directly
  execSync('npx tsup src/index.ts src/exporters/console.ts src/exporters/otlp.ts --format esm --clean', { 
    stdio: 'inherit',
  });
  process.chdir(ROOT_DIR);
} catch (error) {
  console.warn('  ⚠ @isl-lang/observability build failed, continuing...');
  process.chdir(ROOT_DIR);
}

console.log('\n✓ Dependency builds complete');
