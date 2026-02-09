#!/usr/bin/env npx tsx
/**
 * Promote a package from experimental/partial to production.
 *
 * Verifies all readiness gates, then:
 *   1. Removes the package from its current tier in experimental.json
 *   2. Adds it to the appropriate production sub-category
 *   3. Removes the `private` and `experimental` flags from package.json
 *   4. Updates reports/readiness.md with the promotion event
 *
 * Usage:
 *   npx tsx scripts/promote-package.ts @isl-lang/codegen-go
 *   npx tsx scripts/promote-package.ts codegen-go          # shorthand
 *   npx tsx scripts/promote-package.ts --dry-run @isl-lang/codegen-go
 *   npx tsx scripts/promote-package.ts --force @isl-lang/codegen-go
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import type { PackageReadiness, ReadinessReport } from './readiness-schema.js';
import { REQUIRED_GATES, PROMOTION_THRESHOLD } from './readiness-schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));
const dryRun = flags.has('--dry-run');
const force = flags.has('--force');

if (args.length === 0) {
  console.error('Usage: npx tsx scripts/promote-package.ts [--dry-run] [--force] <package-name>');
  console.error('');
  console.error('Examples:');
  console.error('  npx tsx scripts/promote-package.ts @isl-lang/codegen-go');
  console.error('  npx tsx scripts/promote-package.ts codegen-go');
  process.exit(1);
}

let targetPkg = args[0];
if (!targetPkg.startsWith('@')) {
  targetPkg = `@isl-lang/${targetPkg}`;
}
const dirName = targetPkg.replace('@isl-lang/', '');

// ---------------------------------------------------------------------------
// Step 1: Verify the package exists
// ---------------------------------------------------------------------------

const pkgDir = join(rootDir, 'packages', dirName);
const pkgJsonPath = join(pkgDir, 'package.json');

if (!existsSync(pkgJsonPath)) {
  console.error(`\u274c Package directory not found: packages/${dirName}`);
  process.exit(1);
}

const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
const actualName = pkgJson.name ?? targetPkg;

console.log(`\n\ud83d\ude80 Promoting ${actualName}`);
console.log(`   Directory: packages/${dirName}`);
if (dryRun) console.log('   \u26a0\ufe0f  DRY RUN — no files will be modified');
console.log('');

// ---------------------------------------------------------------------------
// Step 2: Run readiness check on this package
// ---------------------------------------------------------------------------

console.log('\ud83d\udd0d Running readiness assessment...');
try {
  execSync(`npx tsx scripts/readiness.ts --filter ${dirName} --quiet`, {
    cwd: rootDir,
    stdio: 'pipe',
  });
} catch {
  // Non-fatal — we'll check the report
}

const reportPath = join(rootDir, 'reports', 'readiness.json');
if (!existsSync(reportPath)) {
  console.error('\u274c Could not generate readiness report. Run: npx tsx scripts/readiness.ts');
  process.exit(1);
}

const report: ReadinessReport = JSON.parse(readFileSync(reportPath, 'utf-8'));
const assessment = report.packages.find((p) => p.name === actualName);

if (!assessment) {
  console.error(`\u274c Package ${actualName} not found in readiness report`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 3: Check gates
// ---------------------------------------------------------------------------

console.log(`\n\ud83d\udccb Gate Results (${assessment.score}/${assessment.total} — ${assessment.percent}%):\n`);

const gateEntries = Object.entries(assessment.gates) as [string, { pass: boolean; detail: string }][];
for (const [name, gate] of gateEntries) {
  const isRequired = REQUIRED_GATES.includes(name as keyof PackageReadiness['gates']);
  const icon = gate.pass ? '\u2705' : '\u274c';
  const tag = isRequired ? '[REQUIRED]' : '[advisory]';
  console.log(`   ${icon} ${name.padEnd(12)} ${tag.padEnd(12)} ${gate.detail}`);
}

const failedRequired = REQUIRED_GATES.filter((k) => !assessment.gates[k].pass);

if (failedRequired.length > 0 && !force) {
  console.error(`\n\u274c Promotion blocked — ${failedRequired.length} required gate(s) failed:`);
  for (const k of failedRequired) {
    console.error(`   - ${k}: ${assessment.gates[k].detail}`);
  }
  console.error('\nFix these gates or use --force to override.');
  process.exit(1);
}

if (assessment.percent < PROMOTION_THRESHOLD && !force) {
  console.error(
    `\n\u274c Promotion blocked — score ${assessment.percent}% is below threshold ${PROMOTION_THRESHOLD}%`,
  );
  console.error('Fix failing gates or use --force to override.');
  process.exit(1);
}

if (force && (!assessment.ready)) {
  console.log('\n\u26a0\ufe0f  --force used: overriding gate failures');
}

if (assessment.tier === 'production') {
  console.log(`\n\u2139\ufe0f  ${actualName} is already in the production tier.`);
  process.exit(0);
}

console.log(`\n\u2705 All required gates satisfied. Promoting ${actualName} (${assessment.tier} \u2192 production)...\n`);

// ---------------------------------------------------------------------------
// Step 4: Update experimental.json
// ---------------------------------------------------------------------------

const expPath = join(rootDir, 'experimental.json');
const expRaw = readFileSync(expPath, 'utf-8');
const expCfg = JSON.parse(expRaw);

// Remove from current tier
let removedFrom: string | null = null;
for (const tier of ['experimental', 'partial']) {
  const tierObj = expCfg[tier];
  if (!tierObj) continue;
  for (const category of Object.keys(tierObj)) {
    if (Array.isArray(tierObj[category])) {
      const idx = tierObj[category].indexOf(actualName);
      if (idx !== -1) {
        if (!dryRun) {
          tierObj[category].splice(idx, 1);
        }
        removedFrom = `${tier}.${category}`;
        console.log(`   Removed from ${removedFrom}`);
      }
    }
  }
}

if (!removedFrom) {
  console.log(`   \u26a0\ufe0f  Package not found in experimental or partial tiers`);
}

// Determine production sub-category based on package name patterns
function inferProductionCategory(name: string): string {
  const short = name.replace('@isl-lang/', '');
  if (short.startsWith('codegen-')) return 'codegen';
  if (short.startsWith('stdlib-')) return 'stdlib_production';
  if (short.startsWith('sdk-')) return 'codegen'; // SDKs go under codegen
  if (short.startsWith('verifier-') || short.startsWith('isl-verify') || short.startsWith('isl-proof') || short.startsWith('isl-pbt') || short.startsWith('isl-smt') || short.startsWith('prover')) return 'verification';
  if (short.startsWith('lsp-') || short === 'language-server') return 'lsp';
  if (short.startsWith('cli') || short === 'repl') return 'cli';
  if (short.includes('pipeline') || short.includes('import-') || short.includes('static-') || short.includes('semantic')) return 'pipeline';
  if (short.includes('build') || short.includes('verified-')) return 'build';
  return 'core';
}

const targetCategory = inferProductionCategory(actualName);
if (!expCfg.production[targetCategory]) {
  expCfg.production[targetCategory] = [];
}
if (!expCfg.production[targetCategory].includes(actualName)) {
  if (!dryRun) {
    expCfg.production[targetCategory].push(actualName);
  }
  console.log(`   Added to production.${targetCategory}`);
}

// Remove any notes entry
const shortName = actualName.replace('@isl-lang/', '');
if (expCfg.notes && expCfg.notes[shortName]) {
  if (!dryRun) {
    delete expCfg.notes[shortName];
  }
  console.log(`   Removed note for ${shortName}`);
}

if (!dryRun) {
  writeFileSync(expPath, JSON.stringify(expCfg, null, 2) + '\n');
  console.log('   \u2705 experimental.json updated');
}

// ---------------------------------------------------------------------------
// Step 5: Update package.json (remove private + experimental flags)
// ---------------------------------------------------------------------------

if (pkgJson.private === true || pkgJson.experimental === true) {
  if (!dryRun) {
    delete pkgJson.private;
    delete pkgJson.experimental;
    writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n');
  }
  console.log('   \u2705 package.json: removed private/experimental flags');
}

// ---------------------------------------------------------------------------
// Step 6: Regenerate readiness report
// ---------------------------------------------------------------------------

if (!dryRun) {
  try {
    execSync('npx tsx scripts/readiness.ts --quiet', { cwd: rootDir, stdio: 'pipe' });
    console.log('   \u2705 Readiness report regenerated');
  } catch {
    console.log('   \u26a0\ufe0f  Could not regenerate readiness report');
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`
\ud83c\udf89 Promotion complete!
   Package:  ${actualName}
   From:     ${assessment.tier}
   To:       production.${targetCategory}
   Score:    ${assessment.percent}%
${dryRun ? '\n\u26a0\ufe0f  DRY RUN — no files were modified. Run without --dry-run to apply.' : ''}
`);
