#!/usr/bin/env npx tsx
/**
 * Completeness Checker
 * 
 * Validates that packages claiming "complete" status actually have all required deliverables.
 * Fails CI if any package claims "complete" but lacks deliverables.
 * 
 * Usage:
 *   npx tsx scripts/completeness-checker.ts          # check all packages
 *   npx tsx scripts/completeness-checker.ts --ci    # fail on mismatches (for CI)
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import type {
  CapabilityManifest,
  PackageCompleteness,
  CompletenessReport,
  CompletionStatus,
  DeliverableCheck,
} from './completeness-schema.js';
import { REQUIRED_FOR_COMPLETE } from './completeness-schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const packagesDir = join(rootDir, 'packages');
const reportsDir = join(rootDir, 'reports');
const manifestDir = join(rootDir, '.capability-manifests');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const ciMode = args.includes('--ci');
const quiet = args.includes('--quiet');

// ---------------------------------------------------------------------------
// Load capability manifests
// ---------------------------------------------------------------------------

function loadManifest(pkgDir: string, pkgName: string): CapabilityManifest | null {
  // Try package-specific manifest first
  const pkgManifestPath = join(pkgDir, 'capability-manifest.json');
  if (existsSync(pkgManifestPath)) {
    try {
      return JSON.parse(readFileSync(pkgManifestPath, 'utf-8')) as CapabilityManifest;
    } catch {
      // Invalid JSON, will be caught later
    }
  }

  // Try central manifest directory
  let manifestName = pkgName.replace('@isl-lang/', '');
  // Handle special cases
  if (pkgName === 'shipgate') {
    manifestName = 'cli';
  } else if (pkgName.startsWith('@')) {
    // Scoped packages: @shipgate/sdk -> shipgate-sdk
    manifestName = pkgName.replace('@', '').replace('/', '-');
  }
  const centralManifestPath = join(manifestDir, `${manifestName}.json`);
  if (existsSync(centralManifestPath)) {
    try {
      return JSON.parse(readFileSync(centralManifestPath, 'utf-8')) as CapabilityManifest;
    } catch {
      // Invalid JSON
    }
  }

  // Default: assume shell if no manifest exists
  return {
    name: pkgName,
    status: 'shell',
    updatedAt: new Date().toISOString(),
    notes: 'No capability manifest found - defaulting to shell',
  };
}

// ---------------------------------------------------------------------------
// Deliverable checks
// ---------------------------------------------------------------------------

function checkExports(pkgJson: Record<string, unknown>): DeliverableCheck {
  const exports = pkgJson.exports as Record<string, unknown> | undefined;
  const main = pkgJson.main as string | undefined;
  const types = pkgJson.types as string | undefined;

  if (!exports && !main) {
    return { present: false, detail: 'No exports or main field in package.json' };
  }
  if (exports && typeof exports === 'object' && Object.keys(exports).length > 0) {
    if (!types && !(exports['.'] as Record<string, unknown>)?.types) {
      return { present: false, detail: 'Exports defined but no types entry' };
    }
    return {
      present: true,
      detail: `Exports configured (${Object.keys(exports).length} entries)`,
      evidence: 'package.json',
    };
  }
  if (main) {
    return { present: true, detail: `main field: ${main}`, evidence: 'package.json' };
  }
  return { present: false, detail: 'Exports misconfigured' };
}

function checkTests(dir: string, pkgJson: Record<string, unknown>): DeliverableCheck {
  const scripts = (pkgJson.scripts ?? {}) as Record<string, string>;
  const testScript = scripts.test ?? '';
  
  if (!testScript || /^echo\b/i.test(testScript) || testScript.includes('Skipping')) {
    return { present: false, detail: 'Test script is missing or stubbed' };
  }

  // Look for test files
  const testDirs = ['tests', 'test', '__tests__', 'src'];
  let hasTestFiles = false;
  let testFile: string | undefined;
  
  for (const td of testDirs) {
    const testDir = join(dir, td);
    if (existsSync(testDir)) {
      try {
        const files = readdirSync(testDir, { recursive: true }) as string[];
        const found = files.find(
          (f) =>
            typeof f === 'string' &&
            (f.endsWith('.test.ts') || f.endsWith('.spec.ts') || f.endsWith('.test.js')),
        );
        if (found) {
          hasTestFiles = true;
          testFile = join(td, found);
          break;
        }
      } catch {
        // ignore
      }
    }
  }

  if (!hasTestFiles) {
    return { present: false, detail: 'No test files found (*.test.ts / *.spec.ts)' };
  }

  return {
    present: true,
    detail: `Test files exist and test script is real`,
    evidence: testFile,
  };
}

function checkDocs(dir: string): DeliverableCheck {
  const readme = join(dir, 'README.md');
  if (!existsSync(readme)) {
    return { present: false, detail: 'No README.md' };
  }
  const content = readFileSync(readme, 'utf-8').trim();
  if (content.length < 100) {
    return {
      present: false,
      detail: `README.md too short (${content.length} chars)`,
      evidence: readme,
    };
  }
  
  // Check for docs directory
  const docsDir = join(dir, 'docs');
  const hasDocsDir = existsSync(docsDir) && statSync(docsDir).isDirectory();
  
  return {
    present: true,
    detail: `README.md present (${content.length} chars)${hasDocsDir ? ' + docs/' : ''}`,
    evidence: readme,
  };
}

function checkSampleUsage(dir: string, pkgName: string): DeliverableCheck {
  // Check for examples directory
  const examplesDir = join(dir, 'examples');
  if (existsSync(examplesDir)) {
    try {
      const files = readdirSync(examplesDir);
      if (files.length > 0) {
        return {
          present: true,
          detail: `examples/ directory with ${files.length} file(s)`,
          evidence: examplesDir,
        };
      }
    } catch {
      // ignore
    }
  }

  // Check for demo directory
  const demoDir = join(dir, 'demo');
  if (existsSync(demoDir)) {
    try {
      const files = readdirSync(demoDir);
      if (files.length > 0) {
        return {
          present: true,
          detail: `demo/ directory with ${files.length} file(s)`,
          evidence: demoDir,
        };
      }
    } catch {
      // ignore
    }
  }

  // Check README for usage examples
  const readme = join(dir, 'README.md');
  if (existsSync(readme)) {
    const content = readFileSync(readme, 'utf-8');
    // Look for code blocks or usage sections
    if (
      content.includes('```') ||
      content.match(/usage|example|demo|getting started/i) ||
      content.includes('import') ||
      content.includes('require(')
    ) {
      return {
        present: true,
        detail: 'Usage examples found in README.md',
        evidence: readme,
      };
    }
  }

  return {
    present: false,
    detail: 'No examples/, demo/, or usage examples in README.md',
  };
}

// ---------------------------------------------------------------------------
// Assess package completeness
// ---------------------------------------------------------------------------

function assessPackage(dirName: string): PackageCompleteness | null {
  const dir = join(packagesDir, dirName);
  const pkgJsonPath = join(dir, 'package.json');
  if (!existsSync(pkgJsonPath)) return null;

  let pkgJson: Record<string, unknown>;
  try {
    pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
  } catch {
    return null;
  }

  const name = (pkgJson.name as string) ?? `@isl-lang/${dirName}`;
  const manifest = loadManifest(dir, name);
  const declaredStatus = manifest.status;

  const deliverables = {
    exports: checkExports(pkgJson),
    tests: checkTests(dir, pkgJson),
    docs: checkDocs(dir),
    sampleUsage: checkSampleUsage(dir, name),
  };

  // Determine assessed status based on deliverables
  const allPresent = REQUIRED_FOR_COMPLETE.every((key) => deliverables[key].present);
  const somePresent = REQUIRED_FOR_COMPLETE.some((key) => deliverables[key].present);
  
  let assessedStatus: CompletionStatus;
  if (allPresent) {
    assessedStatus = 'complete';
  } else if (somePresent) {
    assessedStatus = 'partial';
  } else {
    assessedStatus = 'shell';
  }

  const missingForComplete = REQUIRED_FOR_COMPLETE.filter(
    (key) => !deliverables[key].present,
  );

  const statusMatches = declaredStatus === assessedStatus;

  return {
    name,
    dir: dirName,
    declaredStatus,
    assessedStatus,
    assessedAt: new Date().toISOString(),
    deliverables,
    missingForComplete,
    statusMatches,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  if (!quiet) {
    console.log('\n📋 Completeness Checker');
    console.log(`   CI Mode: ${ciMode ? 'ON (will fail on mismatches)' : 'OFF'}`);
    console.log('');
  }

  // Ensure manifest directory exists
  if (!existsSync(manifestDir)) {
    mkdirSync(manifestDir, { recursive: true });
  }

  const dirs = readdirSync(packagesDir).filter((d) => {
    const full = join(packagesDir, d);
    return statSync(full).isDirectory();
  });

  const packages: PackageCompleteness[] = [];
  for (const d of dirs) {
    const result = assessPackage(d);
    if (result) packages.push(result);
  }

  const completeCount = packages.filter((p) => p.declaredStatus === 'complete').length;
  const partialCount = packages.filter((p) => p.declaredStatus === 'partial').length;
  const shellCount = packages.filter((p) => p.declaredStatus === 'shell').length;
  const mismatchedCount = packages.filter((p) => !p.statusMatches).length;

  const report: CompletenessReport = {
    generatedAt: new Date().toISOString(),
    totalPackages: packages.length,
    completeCount,
    partialCount,
    shellCount,
    mismatchedCount,
    packages,
  };

  // Write report
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }
  const jsonPath = join(reportsDir, 'completeness.json');
  writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');

  if (!quiet) {
    console.log(`📊 Results: ${packages.length} packages scanned`);
    console.log(`   Complete: ${completeCount} | Partial: ${partialCount} | Shell: ${shellCount}`);
    console.log(`   Mismatches: ${mismatchedCount}`);
    console.log(`📄 reports/completeness.json`);
    console.log('');

    // Show mismatches
    const mismatches = packages.filter((p) => !p.statusMatches);
    if (mismatches.length > 0) {
      console.log('⚠️  Status Mismatches:');
      for (const pkg of mismatches) {
        console.log(`   ${pkg.name}`);
        console.log(`      Declared: ${pkg.declaredStatus}`);
        console.log(`      Assessed: ${pkg.assessedStatus}`);
        if (pkg.declaredStatus === 'complete' && pkg.missingForComplete.length > 0) {
          console.log(`      Missing: ${pkg.missingForComplete.join(', ')}`);
        }
      }
      console.log('');
    }
  }

  // In CI mode, fail if any package claims "complete" but isn't actually complete
  if (ciMode) {
    const falseCompletes = packages.filter(
      (p) => p.declaredStatus === 'complete' && p.assessedStatus !== 'complete',
    );
    if (falseCompletes.length > 0) {
      console.error(`\n❌ ${falseCompletes.length} package(s) claim "complete" but lack required deliverables:`);
      for (const pkg of falseCompletes) {
        console.error(`   ${pkg.name}: missing ${pkg.missingForComplete.join(', ')}`);
      }
      process.exit(1);
    }
  }
}

main();
