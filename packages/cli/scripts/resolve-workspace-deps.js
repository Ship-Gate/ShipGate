#!/usr/bin/env node
/**
 * Pre-build script: Resolve workspace dependencies to actual file paths
 * This creates a temporary mapping that esbuild can use
 */

import { writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '../../..');
const CLI_DIR = resolve(__dirname, '..');

const PKG_MAP = {
  '@isl-lang/core': 'core',
  '@isl-lang/gate': 'isl-gate',
  '@isl-lang/parser': 'parser',
  '@isl-lang/observability': 'observability',
  '@isl-lang/import-resolver': 'import-resolver',
  '@isl-lang/semantic-analysis': 'isl-semantic-analysis',
  '@isl-lang/isl-core': 'isl-core',
  '@isl-lang/isl-verify': 'isl-verify',
  '@isl-lang/pipeline': 'isl-pipeline',
  '@isl-lang/policy-packs': 'isl-policy-packs',
  '@isl-lang/isl-policy-engine': 'isl-policy-engine',
  '@isl-lang/proof': 'isl-proof',
  '@isl-lang/truthpack-v2': 'truthpack-v2',
  '@isl-lang/firewall': 'isl-firewall',
  '@isl-lang/isl-firewall': 'isl-firewall',
  '@isl-lang/shipgate-compliance': 'shipgate-compliance',
  '@isl-lang/isl-cache': 'isl-cache',
  '@isl-lang/isl-discovery': 'isl-discovery',
  '@isl-lang/isl-coverage': 'isl-coverage',
  '@isl-lang/codegen-openapi': 'codegen-openapi',
  '@isl-lang/typechecker': 'typechecker',
  '@isl-lang/isl-certificate': 'isl-certificate',
  '@isl-lang/secrets-hygiene': 'secrets-hygiene',
  '@isl-lang/codegen-rust': 'codegen-rust',
  '@isl-lang/codegen-go': 'codegen-go',
  '@isl-lang/evaluator': 'evaluator',
  '@isl-lang/verify-pipeline': 'verify-pipeline',
  '@isl-lang/mutation-testing': 'mutation-testing',
  '@isl-lang/isl-ship': 'isl-ship',
  '@isl-lang/repl': 'repl',
  '@isl-lang/reality-probe': 'reality-probe',
  '@isl-lang/build-runner': 'build-runner',
  '@isl-lang/ai-copilot': 'ai-copilot',
  '@isl-lang/verifier-chaos': 'verifier-chaos',
  '@isl-lang/verifier-runtime': 'verifier-runtime',
  '@isl-lang/codegen-tests': 'codegen-tests',
  '@isl-lang/verifier-sandbox': 'verifier-sandbox',
  '@isl-lang/translator': 'isl-translator',
  '@isl-lang/generator': 'isl-generator',
  '@isl-lang/autofix': 'autofix',
  '@isl-lang/security-scanner': 'security-scanner',
};

const aliases = {};

for (const [pkgName, pkgDir] of Object.entries(PKG_MAP)) {
  const pkgPath = resolve(ROOT_DIR, 'packages', pkgDir);
  
  let resolved = null;
  
  // For observability, use source to avoid ESM/CJS interop issues in dist
  if (pkgName === '@isl-lang/observability') {
    const srcPath = resolve(pkgPath, 'src', 'index.ts');
    if (existsSync(srcPath)) {
      resolved = srcPath;
    }
  } else {
    // Try dist first for other packages
    const distPaths = [
      resolve(pkgPath, 'dist', 'index.js'),
      resolve(pkgPath, 'dist', 'index.cjs'),
    ];
    
    for (const distPath of distPaths) {
      if (existsSync(distPath)) {
        resolved = distPath;
        break;
      }
    }
    
    // Fall back to source
    if (!resolved) {
      const srcPath = resolve(pkgPath, 'src', 'index.ts');
      if (existsSync(srcPath)) {
        resolved = srcPath;
      }
    }
  }
  
  if (resolved) {
    aliases[pkgName] = resolved;
    console.log(`✓ Resolved ${pkgName} -> ${resolved}`);
  } else {
    console.warn(`⚠ Could not resolve ${pkgName}`);
  }
}

// Write aliases to a file that can be imported by tsup config
const aliasesFile = resolve(CLI_DIR, 'tsup.aliases.json');
writeFileSync(aliasesFile, JSON.stringify(aliases, null, 2));
console.log(`\n✓ Wrote aliases to ${aliasesFile}`);
