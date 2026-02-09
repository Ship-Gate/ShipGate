#!/usr/bin/env tsx
/**
 * test:exports — Validates that all non-private packages have:
 *   1. A `types` field in package.json
 *   2. An `exports` map with a `types` condition
 *   3. Entrypoint files (or build would produce them)
 *   4. `declaration: true` in tsconfig.json (directly or inherited)
 *
 * Exit 0 = all checks pass, Exit 1 = failures found.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const PACKAGES_DIR = join(ROOT, 'packages');

interface PackageJson {
  name?: string;
  private?: boolean;
  main?: string;
  types?: string;
  exports?: Record<string, unknown>;
  type?: string;
  engines?: Record<string, string>;
}

interface TsConfig {
  extends?: string;
  compilerOptions?: {
    declaration?: boolean;
    declarationMap?: boolean;
    noEmit?: boolean;
    outDir?: string;
  };
}

interface CheckResult {
  pkg: string;
  errors: string[];
  warnings: string[];
}

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function resolveDeclaration(tsConfigPath: string, visited = new Set<string>()): boolean | undefined {
  if (visited.has(tsConfigPath)) return undefined;
  visited.add(tsConfigPath);

  const tsConfig = readJson<TsConfig>(tsConfigPath);
  if (!tsConfig) return undefined;

  if (tsConfig.compilerOptions?.declaration !== undefined) {
    return tsConfig.compilerOptions.declaration;
  }

  if (tsConfig.extends) {
    const parentPath = resolve(join(tsConfigPath, '..'), tsConfig.extends);
    const parentTsConfigPath = parentPath.endsWith('.json') ? parentPath : join(parentPath, 'tsconfig.json');
    return resolveDeclaration(parentTsConfigPath, visited);
  }

  return undefined;
}

function hasTypesCondition(entry: Record<string, unknown>): boolean {
  // Direct types field: { types: "...", import: "..." }
  if (entry.types) return true;

  // Nested pattern: { import: { types: "...", default: "..." }, require: { ... } }
  for (const condValue of Object.values(entry)) {
    if (typeof condValue === 'object' && condValue !== null) {
      const nested = condValue as Record<string, unknown>;
      if (nested.types) return true;
    }
  }
  return false;
}

function checkExportsHasTypes(exports: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const [key, value] of Object.entries(exports)) {
    if (key === './package.json') continue;
    if (typeof value === 'object' && value !== null) {
      const entry = value as Record<string, unknown>;
      if (!hasTypesCondition(entry)) {
        errors.push(`exports["${key}"] is missing a "types" condition`);
      }
    }
  }
  return errors;
}

function checkPackage(pkgDir: string): CheckResult | null {
  const pkgJsonPath = join(pkgDir, 'package.json');
  const tsConfigPath = join(pkgDir, 'tsconfig.json');

  const pkgJson = readJson<PackageJson>(pkgJsonPath);
  if (!pkgJson || pkgJson.private) return null;
  // Skip vscode extensions — they don't follow standard package export patterns
  if (pkgJson.engines?.vscode) return null;

  const dirName = pkgDir.split(/[\\/]/).pop()!;
  const result: CheckResult = {
    pkg: pkgJson.name || dirName,
    errors: [],
    warnings: [],
  };

  // Check 1: types field
  if (!pkgJson.types) {
    result.errors.push('Missing "types" field in package.json');
  }

  // Check 2: exports map
  if (!pkgJson.exports) {
    result.errors.push('Missing "exports" map in package.json');
  } else {
    // Check types condition in exports
    const exportErrors = checkExportsHasTypes(pkgJson.exports);
    result.errors.push(...exportErrors);

    // Check ./package.json self-reference
    if (!pkgJson.exports['./package.json']) {
      result.warnings.push('exports missing "./package.json" self-reference');
    }
  }

  // Check 3: declaration in tsconfig
  if (existsSync(tsConfigPath)) {
    const declaration = resolveDeclaration(tsConfigPath);
    if (declaration === false) {
      result.errors.push('tsconfig.json has "declaration": false — no .d.ts files will be generated');
    } else if (declaration === undefined) {
      result.warnings.push('Could not resolve "declaration" setting in tsconfig.json');
    }
  }

  // Check 4: If dist exists, verify entrypoint files
  if (pkgJson.types) {
    const typesPath = join(pkgDir, pkgJson.types);
    if (existsSync(join(pkgDir, 'dist'))) {
      if (!existsSync(typesPath)) {
        result.warnings.push(`Types file "${pkgJson.types}" not found in dist (may need rebuild)`);
      }
    }
  }

  if (pkgJson.main) {
    const mainPath = join(pkgDir, pkgJson.main);
    if (existsSync(join(pkgDir, 'dist'))) {
      if (!existsSync(mainPath)) {
        result.warnings.push(`Main file "${pkgJson.main}" not found in dist (may need rebuild)`);
      }
    }
  }

  return result.errors.length > 0 || result.warnings.length > 0 ? result : null;
}

// --- Main ---
const dirs = readdirSync(PACKAGES_DIR).filter((d) => {
  const full = join(PACKAGES_DIR, d);
  return statSync(full).isDirectory() && existsSync(join(full, 'package.json'));
});

let totalErrors = 0;
let totalWarnings = 0;
const results: CheckResult[] = [];

for (const dir of dirs) {
  const result = checkPackage(join(PACKAGES_DIR, dir));
  if (result) {
    results.push(result);
    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;
  }
}

// Output
if (results.length === 0) {
  console.log('✅ All packages pass exports/types checks.');
  process.exit(0);
}

console.log(`\n📦 Export & Types Audit Results\n${'═'.repeat(50)}`);

for (const r of results) {
  if (r.errors.length > 0) {
    console.log(`\n❌ ${r.pkg}`);
    for (const e of r.errors) console.log(`   ERROR: ${e}`);
    for (const w of r.warnings) console.log(`   WARN:  ${w}`);
  }
}

for (const r of results) {
  if (r.errors.length === 0 && r.warnings.length > 0) {
    console.log(`\n⚠️  ${r.pkg}`);
    for (const w of r.warnings) console.log(`   WARN:  ${w}`);
  }
}

console.log(`\n${'═'.repeat(50)}`);
console.log(`Total: ${totalErrors} errors, ${totalWarnings} warnings across ${results.length} packages`);

if (totalErrors > 0) {
  process.exit(1);
}
