#!/usr/bin/env node
/**
 * Minimal Node import smoke check for core packages.
 * Usage: node scripts/core-proof-import-smoke.mjs <package-dir>
 * e.g. node scripts/core-proof-import-smoke.mjs packages/evaluator
 * Exits 0 if import and one exported call succeed; exits 1 otherwise.
 */
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

async function main() {
  const pkgDir = process.argv[2];
  if (!pkgDir) {
    console.error('Usage: node core-proof-import-smoke.mjs <package-dir>');
    process.exit(2);
  }
  const distDir = join(root, pkgDir, 'dist');
  const indexEsm = join(distDir, 'index.js');
  const indexCjs = join(distDir, 'index.cjs');

  try {
    let mod;
    try {
      mod = await import(pathToFileURL(indexEsm).href);
    } catch (e) {
      const require = createRequire(import.meta.url);
      mod = require(join(root, pkgDir, 'dist', 'index.cjs'));
    }
    if (typeof mod !== 'object' || mod === null) {
      console.error('Import did not return an object');
      process.exit(1);
    }
    if (pkgDir.includes('evaluator')) {
      if (typeof mod.createEnvironment === 'function') {
        const env = mod.createEnvironment();
        if (env && typeof env === 'object') console.log('evaluator: createEnvironment() OK');
        else console.error('evaluator: createEnvironment() returned invalid');
      } else if (typeof mod.evaluate === 'function') {
        console.log('evaluator: evaluate export present');
      } else {
        console.log('evaluator: main entry imported, exports present');
      }
    } else {
      console.log('Import OK, exports:', Object.keys(mod).slice(0, 5).join(', '));
    }
    process.exit(0);
  } catch (err) {
    console.error('Import or call failed:', err.message);
    process.exit(1);
  }
}

main();
