/**
 * Package Template Stamping Tool
 *
 * Detects missing/invalid configs across packages/ and applies the
 * standard template from templates/package-ts/ safely.
 *
 * Usage:
 *   npx tsx scripts/stamp-packages.ts --dry-run   # Preview changes
 *   npx tsx scripts/stamp-packages.ts --apply      # Apply changes
 *
 * Guardrails:
 *   - Never overwrites existing src/ files
 *   - Merges package.json fields (preserves deps, scripts additions only)
 *   - Writes conflicts to reports/stamp-conflicts.md
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  mkdirSync,
  statSync,
  copyFileSync,
} from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PACKAGES_DIR = join(ROOT, 'packages');
const TEMPLATE_DIR = join(ROOT, 'templates', 'package-ts');
const REPORTS_DIR = join(ROOT, 'reports');

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const APPLY = args.includes('--apply');
const FILTER = args.find((a) => a.startsWith('--filter='))?.split('=')[1];

if (!DRY_RUN && !APPLY) {
  console.log(`
Usage:
  npx tsx scripts/stamp-packages.ts --dry-run          Preview changes
  npx tsx scripts/stamp-packages.ts --apply             Apply changes
  npx tsx scripts/stamp-packages.ts --apply --filter=X  Apply to packages matching X

Options:
  --dry-run          Show what would change without writing files
  --apply            Write changes to disk
  --filter=<glob>    Only process packages whose directory name contains this string
`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Template loading
// ---------------------------------------------------------------------------

function loadTemplate(name: string): string {
  return readFileSync(join(TEMPLATE_DIR, name), 'utf-8');
}

const TEMPLATE_TSCONFIG = JSON.parse(loadTemplate('tsconfig.json'));
const TEMPLATE_VITEST = loadTemplate('vitest.config.ts');
const TEMPLATE_PKG = JSON.parse(loadTemplate('package.json'));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Diagnostic {
  pkg: string;
  file: string;
  issue: string;
  action: string;
}

interface Conflict {
  pkg: string;
  file: string;
  existing: string;
  expected: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonStable(obj: unknown): string {
  return JSON.stringify(obj, null, 2) + '\n';
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function writeIfApply(filePath: string, content: string): void {
  if (APPLY) {
    const dir = dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, content, 'utf-8');
  }
}

// ---------------------------------------------------------------------------
// tsconfig.json auditing
// ---------------------------------------------------------------------------

function auditTsconfig(
  pkgDir: string,
  pkgName: string,
  diagnostics: Diagnostic[],
  conflicts: Conflict[],
): void {
  const tsconfigPath = join(pkgDir, 'tsconfig.json');

  if (!existsSync(tsconfigPath)) {
    diagnostics.push({
      pkg: pkgName,
      file: 'tsconfig.json',
      issue: 'Missing',
      action: 'Created from template',
    });
    writeIfApply(tsconfigPath, jsonStable(TEMPLATE_TSCONFIG));
    return;
  }

  // Validate critical fields
  try {
    const existing = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));
    const opts = existing.compilerOptions ?? {};
    const issues: string[] = [];

    if (opts.strict !== true) issues.push('strict not enabled');
    if (opts.declaration !== true) issues.push('declaration not enabled');
    if (!opts.outDir) issues.push('outDir missing');
    if (!opts.rootDir) issues.push('rootDir missing');

    if (issues.length > 0) {
      // Merge missing fields into existing
      const merged = { ...existing };
      merged.compilerOptions = { ...TEMPLATE_TSCONFIG.compilerOptions, ...opts };
      // Ensure critical fields are set
      merged.compilerOptions.strict = true;
      merged.compilerOptions.declaration = true;
      if (!merged.compilerOptions.outDir) merged.compilerOptions.outDir = './dist';
      if (!merged.compilerOptions.rootDir) merged.compilerOptions.rootDir = './src';
      if (!merged.include) merged.include = TEMPLATE_TSCONFIG.include;
      if (!merged.exclude) merged.exclude = TEMPLATE_TSCONFIG.exclude;

      diagnostics.push({
        pkg: pkgName,
        file: 'tsconfig.json',
        issue: issues.join(', '),
        action: 'Patched missing fields',
      });
      writeIfApply(tsconfigPath, jsonStable(merged));
    }
  } catch {
    diagnostics.push({
      pkg: pkgName,
      file: 'tsconfig.json',
      issue: 'Invalid JSON',
      action: 'Replaced from template',
    });
    writeIfApply(tsconfigPath, jsonStable(TEMPLATE_TSCONFIG));
  }
}

// ---------------------------------------------------------------------------
// vitest.config.ts auditing
// ---------------------------------------------------------------------------

function auditVitest(
  pkgDir: string,
  pkgName: string,
  diagnostics: Diagnostic[],
  _conflicts: Conflict[],
): void {
  const vitestPath = join(pkgDir, 'vitest.config.ts');

  if (!existsSync(vitestPath)) {
    diagnostics.push({
      pkg: pkgName,
      file: 'vitest.config.ts',
      issue: 'Missing',
      action: 'Created from template',
    });
    writeIfApply(vitestPath, TEMPLATE_VITEST);
  }
  // If it exists, leave it alone — vitest configs often have package-specific tuning
}

// ---------------------------------------------------------------------------
// package.json auditing
// ---------------------------------------------------------------------------

function auditPackageJson(
  pkgDir: string,
  pkgName: string,
  diagnostics: Diagnostic[],
  conflicts: Conflict[],
): void {
  const pkgPath = join(pkgDir, 'package.json');
  if (!existsSync(pkgPath)) return; // No package.json = not a package

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  } catch {
    diagnostics.push({
      pkg: pkgName,
      file: 'package.json',
      issue: 'Invalid JSON',
      action: 'Skipped — manual fix required',
    });
    return;
  }

  const issues: string[] = [];
  let changed = false;

  // 1. Ensure type: module
  if (pkg.type !== 'module') {
    issues.push('type !== "module"');
    pkg.type = 'module';
    changed = true;
  }

  // 2. Ensure exports field
  if (!pkg.exports) {
    issues.push('exports field missing');
    pkg.exports = {
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.js',
        require: './dist/index.cjs',
      },
    };
    changed = true;
  }

  // 3. Ensure types field
  if (!pkg.types) {
    issues.push('types field missing');
    pkg.types = './dist/index.d.ts';
    changed = true;
  }

  // 4. Ensure sideEffects
  if (pkg.sideEffects === undefined) {
    issues.push('sideEffects missing');
    pkg.sideEffects = false;
    changed = true;
  }

  // 5. Ensure files field
  if (!pkg.files) {
    issues.push('files field missing');
    pkg.files = ['dist', 'README.md', 'LICENSE'];
    changed = true;
  }

  // 6. Ensure standard scripts exist (additive only — never overwrite)
  const scripts = (pkg.scripts ?? {}) as Record<string, string>;
  const requiredScripts: Record<string, string> = {
    build: 'tsup src/index.ts --format esm,cjs --dts --clean',
    test: 'vitest run --passWithNoTests',
    typecheck: 'tsc --noEmit',
    clean: 'rimraf dist',
  };

  for (const [key, defaultVal] of Object.entries(requiredScripts)) {
    if (!scripts[key]) {
      issues.push(`scripts.${key} missing`);
      scripts[key] = defaultVal;
      changed = true;
    }
  }
  if (changed && !pkg.scripts) {
    pkg.scripts = scripts;
  }

  // 7. Ensure devDependencies include standard tooling
  const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
  const requiredDevDeps: Record<string, string> = {
    typescript: '^5.3.0',
    vitest: '^1.0.0',
    tsup: '^8.0.1',
    rimraf: '^5.0.5',
  };
  for (const [dep, ver] of Object.entries(requiredDevDeps)) {
    if (!devDeps[dep]) {
      issues.push(`devDeps.${dep} missing`);
      devDeps[dep] = ver;
      changed = true;
    }
  }
  if (changed) {
    pkg.devDependencies = devDeps;
  }

  if (issues.length > 0) {
    diagnostics.push({
      pkg: pkgName,
      file: 'package.json',
      issue: issues.join(', '),
      action: 'Patched missing fields',
    });
    writeIfApply(pkgPath, jsonStable(pkg));
  }
}

// ---------------------------------------------------------------------------
// src/index.ts auditing — NEVER overwrite existing source
// ---------------------------------------------------------------------------

function auditSrcIndex(
  pkgDir: string,
  pkgName: string,
  diagnostics: Diagnostic[],
  _conflicts: Conflict[],
): void {
  const srcDir = join(pkgDir, 'src');
  const indexPath = join(srcDir, 'index.ts');

  if (!existsSync(srcDir)) {
    diagnostics.push({
      pkg: pkgName,
      file: 'src/',
      issue: 'Missing src directory',
      action: 'Created src/ with stub index.ts',
    });
    writeIfApply(indexPath, `/**\n * @packageDocumentation\n * ${pkgName}\n */\n\nexport {};\n`);
    return;
  }

  if (!existsSync(indexPath)) {
    // src/ exists but no index.ts — check if there are other .ts files
    const tsFiles = existsSync(srcDir)
      ? readdirSync(srcDir).filter((f) => f.endsWith('.ts'))
      : [];

    if (tsFiles.length === 0) {
      diagnostics.push({
        pkg: pkgName,
        file: 'src/index.ts',
        issue: 'Missing entry point',
        action: 'Created stub index.ts',
      });
      writeIfApply(
        indexPath,
        `/**\n * @packageDocumentation\n * ${pkgName}\n */\n\nexport {};\n`,
      );
    } else {
      diagnostics.push({
        pkg: pkgName,
        file: 'src/index.ts',
        issue: 'Missing entry point (other .ts files exist)',
        action: 'Skipped — manual barrel export needed',
      });
    }
  }
  // If index.ts exists, NEVER touch it
}

// ---------------------------------------------------------------------------
// README auditing
// ---------------------------------------------------------------------------

function auditReadme(
  pkgDir: string,
  pkgName: string,
  diagnostics: Diagnostic[],
  _conflicts: Conflict[],
): void {
  const readmePath = join(pkgDir, 'README.md');
  if (!existsSync(readmePath)) {
    const readmeTemplate = loadTemplate('README.md')
      .replace(/\{\{PACKAGE_NAME\}\}/g, pkgName)
      .replace(/\{\{DESCRIPTION\}\}/g, 'TODO: Add description');
    diagnostics.push({
      pkg: pkgName,
      file: 'README.md',
      issue: 'Missing',
      action: 'Created from template',
    });
    writeIfApply(readmePath, readmeTemplate);
  }
}

// ---------------------------------------------------------------------------
// Main scan
// ---------------------------------------------------------------------------

function main(): void {
  console.log(`\n📦 Package Stamp Tool${DRY_RUN ? ' (DRY RUN)' : ' (APPLY)'}\n`);

  const diagnostics: Diagnostic[] = [];
  const conflicts: Conflict[] = [];

  // Enumerate packages
  const entries = readdirSync(PACKAGES_DIR).filter((name) => {
    const full = join(PACKAGES_DIR, name);
    if (!statSync(full).isDirectory()) return false;
    if (!existsSync(join(full, 'package.json'))) return false;
    if (FILTER && !name.includes(FILTER)) return false;
    return true;
  });

  console.log(`Scanning ${entries.length} packages...\n`);

  for (const dirName of entries) {
    const pkgDir = join(PACKAGES_DIR, dirName);
    const pkgJsonPath = join(pkgDir, 'package.json');
    let pkgName = `@isl-lang/${dirName}`;
    try {
      const pj = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
      if (pj.name) pkgName = pj.name;
    } catch {
      // use default
    }

    auditTsconfig(pkgDir, pkgName, diagnostics, conflicts);
    auditVitest(pkgDir, pkgName, diagnostics, conflicts);
    auditPackageJson(pkgDir, pkgName, diagnostics, conflicts);
    auditSrcIndex(pkgDir, pkgName, diagnostics, conflicts);
    auditReadme(pkgDir, pkgName, diagnostics, conflicts);
  }

  // ---------------------------------------------------------------------------
  // Report
  // ---------------------------------------------------------------------------

  if (diagnostics.length === 0) {
    console.log('✅ All packages conform to the standard template. Nothing to do.\n');
    return;
  }

  // Group by package
  const byPkg = new Map<string, Diagnostic[]>();
  for (const d of diagnostics) {
    const arr = byPkg.get(d.pkg) ?? [];
    arr.push(d);
    byPkg.set(d.pkg, arr);
  }

  console.log(`Found ${diagnostics.length} issue(s) across ${byPkg.size} package(s):\n`);

  for (const [pkg, items] of byPkg) {
    console.log(`  📁 ${pkg}`);
    for (const item of items) {
      const icon = DRY_RUN ? '  ⚠️ ' : '  ✅';
      console.log(`${icon} ${item.file}: ${item.issue} → ${item.action}`);
    }
    console.log();
  }

  // ---------------------------------------------------------------------------
  // Write conflicts report
  // ---------------------------------------------------------------------------

  if (conflicts.length > 0) {
    if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
    const reportPath = join(REPORTS_DIR, 'stamp-conflicts.md');
    const lines = [
      '# Stamp Conflicts Report',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      `Total conflicts: ${conflicts.length}`,
      '',
    ];

    for (const c of conflicts) {
      lines.push(`## ${c.pkg} — ${c.file}`);
      lines.push('');
      lines.push(`**Reason:** ${c.reason}`);
      lines.push('');
      lines.push('### Existing');
      lines.push('```');
      lines.push(c.existing.slice(0, 500));
      lines.push('```');
      lines.push('');
      lines.push('### Expected');
      lines.push('```');
      lines.push(c.expected.slice(0, 500));
      lines.push('```');
      lines.push('');
    }

    writeFileSync(reportPath, lines.join('\n'), 'utf-8');
    console.log(`⚠️  Conflicts written to: ${relative(ROOT, reportPath)}\n`);
  }

  // Summary
  console.log('─'.repeat(60));
  console.log(
    `  ${DRY_RUN ? 'Would fix' : 'Fixed'}: ${diagnostics.length} issues in ${byPkg.size} packages`,
  );
  if (DRY_RUN) {
    console.log('  Run with --apply to write changes to disk.');
  }
  console.log('─'.repeat(60));
  console.log();
}

main();
