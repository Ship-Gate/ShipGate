#!/usr/bin/env npx tsx
/**
 * Package Readiness Scanner
 *
 * Scans all packages/* and runs lightweight checks (no full test run unless --full).
 * Outputs reports/readiness.json and reports/readiness.md
 *
 * Usage:
 *   npx tsx scripts/readiness.ts                  # scan all packages
 *   npx tsx scripts/readiness.ts --filter parser   # scan one package
 *   npx tsx scripts/readiness.ts --tier experimental  # scan a tier
 *   npx tsx scripts/readiness.ts --full            # run build+test (slow)
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import type { PackageReadiness, ReadinessReport, GateResult } from './readiness-schema.js';
import { REQUIRED_GATES, PROMOTION_THRESHOLD } from './readiness-schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const packagesDir = join(rootDir, 'packages');
const reportsDir = join(rootDir, 'reports');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const filterPkg = args.find((_, i, a) => a[i - 1] === '--filter') ?? null;
const filterTier = args.find((_, i, a) => a[i - 1] === '--tier') ?? null;
const fullMode = args.includes('--full');
const quiet = args.includes('--quiet');

// ---------------------------------------------------------------------------
// Load experimental.json to know each package's tier
// ---------------------------------------------------------------------------

interface ExperimentalConfig {
  production: Record<string, string[]>;
  partial: Record<string, string[]>;
  experimental: Record<string, string[]>;
  internal: { packages: string[] };
  [key: string]: unknown;
}

const expCfg: ExperimentalConfig = JSON.parse(
  readFileSync(join(rootDir, 'experimental.json'), 'utf-8'),
);

function flattenCategory(cat: Record<string, string[] | unknown>): string[] {
  const out: string[] = [];
  for (const v of Object.values(cat)) {
    if (Array.isArray(v)) out.push(...v);
  }
  return out;
}

const tierMap = new Map<string, PackageReadiness['tier']>();
for (const pkg of flattenCategory(expCfg.production)) tierMap.set(pkg, 'production');
for (const pkg of flattenCategory(expCfg.partial)) tierMap.set(pkg, 'partial');
for (const pkg of flattenCategory(expCfg.experimental)) tierMap.set(pkg, 'experimental');
for (const pkg of expCfg.internal?.packages ?? []) tierMap.set(pkg, 'internal');

function getTier(pkgName: string): PackageReadiness['tier'] {
  return tierMap.get(pkgName) ?? 'unlisted';
}

// ---------------------------------------------------------------------------
// Gate checks (lightweight — filesystem-only unless --full)
// ---------------------------------------------------------------------------

function checkBuild(dir: string, pkgJson: Record<string, unknown>): GateResult {
  const scripts = (pkgJson.scripts ?? {}) as Record<string, string>;
  const buildScript = scripts.build ?? '';

  // Stub detection
  if (/^echo\b/i.test(buildScript) || buildScript.includes('Skipping')) {
    return { pass: false, detail: 'Build script is a stub/echo' };
  }
  if (!buildScript) {
    return { pass: false, detail: 'No build script defined' };
  }

  // In full mode, actually run it
  if (fullMode) {
    try {
      execSync('pnpm run build', { cwd: dir, stdio: 'pipe', timeout: 60_000 });
      return { pass: true, detail: 'Build succeeded' };
    } catch {
      return { pass: false, detail: 'Build failed' };
    }
  }

  // Lightweight: check if dist/ exists already
  const hasDist = existsSync(join(dir, 'dist'));
  return {
    pass: hasDist,
    detail: hasDist ? 'dist/ exists (build presumed OK)' : 'No dist/ — run build to verify',
  };
}

function checkTypecheck(dir: string, pkgJson: Record<string, unknown>): GateResult {
  const scripts = (pkgJson.scripts ?? {}) as Record<string, string>;
  const tc = scripts.typecheck ?? '';
  if (!tc || /^echo\b/i.test(tc) || tc.includes('Skipping')) {
    return { pass: false, detail: 'Typecheck script is missing or stubbed' };
  }
  const hasTsconfig = existsSync(join(dir, 'tsconfig.json'));
  if (!hasTsconfig) {
    return { pass: false, detail: 'No tsconfig.json' };
  }
  if (fullMode) {
    try {
      execSync('pnpm run typecheck', { cwd: dir, stdio: 'pipe', timeout: 60_000 });
      return { pass: true, detail: 'Typecheck passed' };
    } catch {
      return { pass: false, detail: 'Typecheck failed' };
    }
  }
  return { pass: true, detail: 'Typecheck script and tsconfig.json present' };
}

function checkTests(dir: string, pkgJson: Record<string, unknown>): GateResult {
  const scripts = (pkgJson.scripts ?? {}) as Record<string, string>;
  const testScript = scripts.test ?? '';
  if (!testScript || /^echo\b/i.test(testScript) || testScript.includes('Skipping')) {
    return { pass: false, detail: 'Test script is missing or stubbed' };
  }

  // Look for test files
  const testDirs = ['tests', 'test', '__tests__', 'src'];
  let hasTestFiles = false;
  for (const td of testDirs) {
    const testDir = join(dir, td);
    if (existsSync(testDir)) {
      try {
        const files = readdirSync(testDir, { recursive: true }) as string[];
        hasTestFiles = files.some(
          (f) =>
            typeof f === 'string' &&
            (f.endsWith('.test.ts') || f.endsWith('.spec.ts') || f.endsWith('.test.js')),
        );
        if (hasTestFiles) break;
      } catch {
        // ignore
      }
    }
  }

  if (!hasTestFiles) {
    return { pass: false, detail: 'No test files found (*.test.ts / *.spec.ts)' };
  }

  if (fullMode) {
    try {
      execSync('pnpm run test', { cwd: dir, stdio: 'pipe', timeout: 120_000 });
      return { pass: true, detail: 'Tests passed' };
    } catch {
      return { pass: false, detail: 'Tests failed' };
    }
  }
  return { pass: true, detail: 'Test files exist and test script is real' };
}

function checkDocs(dir: string): GateResult {
  const readme = join(dir, 'README.md');
  if (!existsSync(readme)) {
    return { pass: false, detail: 'No README.md' };
  }
  const content = readFileSync(readme, 'utf-8').trim();
  if (content.length < 100) {
    return { pass: false, detail: `README.md too short (${content.length} chars)`, evidence: readme };
  }
  return { pass: true, detail: `README.md present (${content.length} chars)`, evidence: readme };
}

function checkCoverage(dir: string, pkgJson: Record<string, unknown>): GateResult {
  const scripts = (pkgJson.scripts ?? {}) as Record<string, string>;
  const hasCoverageScript = !!scripts['test:coverage'];
  const hasCoverageDir = existsSync(join(dir, 'coverage'));
  if (hasCoverageScript || hasCoverageDir) {
    return {
      pass: true,
      detail: hasCoverageDir ? 'coverage/ directory exists' : 'test:coverage script defined',
    };
  }
  return { pass: false, detail: 'No coverage script or report' };
}

function checkExports(pkgJson: Record<string, unknown>): GateResult {
  const exports = pkgJson.exports as Record<string, unknown> | undefined;
  const main = pkgJson.main as string | undefined;
  const types = pkgJson.types as string | undefined;

  if (!exports && !main) {
    return { pass: false, detail: 'No exports or main field in package.json' };
  }
  if (exports && typeof exports === 'object' && Object.keys(exports).length > 0) {
    if (!types && !(exports['.'] as Record<string, unknown>)?.types) {
      return { pass: false, detail: 'Exports defined but no types entry' };
    }
    return { pass: true, detail: `Exports configured (${Object.keys(exports).length} entries)` };
  }
  if (main) {
    return { pass: true, detail: `main field: ${main}` };
  }
  return { pass: false, detail: 'Exports misconfigured' };
}

function checkPerf(dir: string, pkgJson: Record<string, unknown>): GateResult {
  const scripts = (pkgJson.scripts ?? {}) as Record<string, string>;
  // Check for perf/benchmark scripts or files
  const hasPerfScript = !!(scripts['test:perf'] || scripts['benchmark']);
  const hasBenchDir = existsSync(join(dir, 'bench')) || existsSync(join(dir, 'benchmarks'));

  if (hasPerfScript || hasBenchDir) {
    return { pass: true, detail: 'Performance script or bench directory present' };
  }
  // Advisory — not blocking. Check if the build script is real (not a stub) as a proxy.
  const buildScript = scripts.build ?? '';
  if (buildScript && !/^echo\b/i.test(buildScript)) {
    return { pass: false, detail: 'No dedicated perf tests (advisory)' };
  }
  return { pass: false, detail: 'No performance validation' };
}

function checkSecurity(dir: string, pkgJson: Record<string, unknown>): GateResult {
  const isPrivate = pkgJson.private === true;
  const tier = getTier(pkgJson.name as string);
  const notes = (expCfg as Record<string, unknown>).notes as Record<string, string> | undefined;
  const shortName = (pkgJson.name as string).replace('@isl-lang/', '');
  const hasSecurityNote = notes?.[shortName]?.toLowerCase().includes('security') ?? false;

  if (hasSecurityNote) {
    return { pass: false, detail: `Security note in experimental.json: ${notes![shortName]}` };
  }

  // Production packages should NOT be private
  if (tier === 'production' && isPrivate) {
    return { pass: false, detail: 'Production package is marked private' };
  }

  // Check for known vulnerability patterns (placeholder)
  const hasLockfile = existsSync(join(dir, 'pnpm-lock.yaml'));
  return { pass: true, detail: isPrivate ? 'Private package (OK for non-production)' : 'No security flags' };
}

// ---------------------------------------------------------------------------
// Main scan
// ---------------------------------------------------------------------------

function assessPackage(dirName: string): PackageReadiness | null {
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
  const tier = getTier(name);

  // Apply filters
  if (filterTier && tier !== filterTier) return null;

  const gates = {
    build: checkBuild(dir, pkgJson),
    typecheck: checkTypecheck(dir, pkgJson),
    test: checkTests(dir, pkgJson),
    docs: checkDocs(dir),
    coverage: checkCoverage(dir, pkgJson),
    exports: checkExports(pkgJson),
    perf: checkPerf(dir, pkgJson),
    security: checkSecurity(dir, pkgJson),
  };

  const total = Object.keys(gates).length;
  const score = Object.values(gates).filter((g) => g.pass).length;
  const percent = Math.round((score / total) * 100);

  // Ready = all REQUIRED gates pass AND percent >= threshold
  const requiredPass = REQUIRED_GATES.every((k) => gates[k].pass);
  const ready = requiredPass && percent >= PROMOTION_THRESHOLD;

  return {
    name,
    dir: dirName,
    tier,
    assessedAt: new Date().toISOString(),
    gates,
    score,
    total,
    percent,
    ready,
  };
}

function generateMarkdown(report: ReadinessReport): string {
  const lines: string[] = [];
  lines.push('# Package Readiness Report');
  lines.push('');
  lines.push(`**Generated:** ${report.generatedAt}`);
  lines.push(`**Threshold:** ${report.threshold}%`);
  lines.push(`**Total:** ${report.totalPackages} | **Ready:** ${report.readyCount} | **Not Ready:** ${report.notReadyCount}`);
  lines.push('');

  // Summary table
  lines.push('## Scoreboard');
  lines.push('');
  lines.push('| Package | Tier | Score | Build | TC | Test | Docs | Cov | Exports | Perf | Sec | Ready |');
  lines.push('|---------|------|-------|-------|----|------|------|-----|---------|------|-----|-------|');

  for (const pkg of report.packages) {
    const g = pkg.gates;
    const icon = (r: GateResult) => (r.pass ? '\u2705' : '\u274c');
    lines.push(
      `| ${pkg.name} | ${pkg.tier} | ${pkg.percent}% | ${icon(g.build)} | ${icon(g.typecheck)} | ${icon(g.test)} | ${icon(g.docs)} | ${icon(g.coverage)} | ${icon(g.exports)} | ${icon(g.perf)} | ${icon(g.security)} | ${pkg.ready ? '**YES**' : 'no'} |`,
    );
  }

  lines.push('');

  // Tier summary
  const tiers = ['production', 'partial', 'experimental', 'internal', 'unlisted'] as const;
  lines.push('## By Tier');
  lines.push('');
  for (const tier of tiers) {
    const pkgs = report.packages.filter((p) => p.tier === tier);
    if (pkgs.length === 0) continue;
    const readyN = pkgs.filter((p) => p.ready).length;
    lines.push(`### ${tier} (${readyN}/${pkgs.length} ready)`);
    lines.push('');
    for (const p of pkgs) {
      const failedGates = Object.entries(p.gates)
        .filter(([, g]) => !g.pass)
        .map(([k, g]) => `${k}: ${g.detail}`);
      if (failedGates.length > 0) {
        lines.push(`- **${p.name}** (${p.percent}%) — missing: ${failedGates.join('; ')}`);
      } else {
        lines.push(`- **${p.name}** (${p.percent}%) \u2705 all gates pass`);
      }
    }
    lines.push('');
  }

  // Promotion candidates
  const candidates = report.packages.filter(
    (p) => p.ready && (p.tier === 'experimental' || p.tier === 'partial'),
  );
  if (candidates.length > 0) {
    lines.push('## Promotion Candidates');
    lines.push('');
    lines.push('These packages meet all required gates and can be promoted:');
    lines.push('');
    for (const c of candidates) {
      lines.push(`- **${c.name}** (${c.tier} \u2192 production, score ${c.percent}%)`);
    }
    lines.push('');
    lines.push('Run: `npx tsx scripts/promote-package.ts <package-name>`');
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main() {
  if (!quiet) {
    console.log('\n\ud83d\udccb Package Readiness Scanner');
    console.log(`   Mode: ${fullMode ? 'FULL (build+test)' : 'lightweight (filesystem)'}`);
    if (filterPkg) console.log(`   Filter: ${filterPkg}`);
    if (filterTier) console.log(`   Tier: ${filterTier}`);
    console.log('');
  }

  const dirs = readdirSync(packagesDir).filter((d) => {
    const full = join(packagesDir, d);
    if (!statSync(full).isDirectory()) return false;
    if (filterPkg && d !== filterPkg) return false;
    return true;
  });

  const packages: PackageReadiness[] = [];
  for (const d of dirs) {
    const result = assessPackage(d);
    if (result) packages.push(result);
  }

  // Sort: production first, then by score descending
  const tierOrder: Record<string, number> = {
    production: 0,
    partial: 1,
    experimental: 2,
    internal: 3,
    unlisted: 4,
  };
  packages.sort((a, b) => {
    const t = (tierOrder[a.tier] ?? 9) - (tierOrder[b.tier] ?? 9);
    return t !== 0 ? t : b.percent - a.percent;
  });

  const report: ReadinessReport = {
    generatedAt: new Date().toISOString(),
    totalPackages: packages.length,
    readyCount: packages.filter((p) => p.ready).length,
    notReadyCount: packages.filter((p) => !p.ready).length,
    threshold: PROMOTION_THRESHOLD,
    packages,
  };

  // Write reports
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }
  const jsonPath = join(reportsDir, 'readiness.json');
  const mdPath = join(reportsDir, 'readiness.md');

  writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');
  writeFileSync(mdPath, generateMarkdown(report));

  if (!quiet) {
    console.log(`\ud83d\udcca Results: ${report.readyCount} ready / ${report.totalPackages} total (threshold ${report.threshold}%)`);
    console.log(`\ud83d\udcc4 reports/readiness.json`);
    console.log(`\ud83d\udcc4 reports/readiness.md`);

    // Quick summary
    const prodPkgs = packages.filter((p) => p.tier === 'production');
    const prodReady = prodPkgs.filter((p) => p.ready).length;
    const partPkgs = packages.filter((p) => p.tier === 'partial');
    const partReady = partPkgs.filter((p) => p.ready).length;
    const expPkgs = packages.filter((p) => p.tier === 'experimental');
    const expReady = expPkgs.filter((p) => p.ready).length;

    console.log('');
    console.log(`   production:   ${prodReady}/${prodPkgs.length} ready`);
    console.log(`   partial:      ${partReady}/${partPkgs.length} ready`);
    console.log(`   experimental: ${expReady}/${expPkgs.length} ready`);
    console.log('');

    // Warn about production packages that aren't ready
    const prodNotReady = prodPkgs.filter((p) => !p.ready);
    if (prodNotReady.length > 0) {
      console.log('\u26a0\ufe0f  Production packages below threshold:');
      for (const p of prodNotReady) {
        const failed = Object.entries(p.gates)
          .filter(([, g]) => !g.pass)
          .map(([k]) => k);
        console.log(`   ${p.name} (${p.percent}%) — failing: ${failed.join(', ')}`);
      }
      console.log('');
    }
  }

  // Exit code: non-zero if any production package is not ready (for CI use)
  const prodFailing = packages.filter((p) => p.tier === 'production' && !p.ready);
  if (args.includes('--strict') && prodFailing.length > 0) {
    console.error(`\u274c ${prodFailing.length} production package(s) below readiness threshold`);
    process.exit(1);
  }
}

main();
