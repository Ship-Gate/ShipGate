#!/usr/bin/env npx tsx
/**
 * Shipgate Pre-Push Hook
 *
 * Runs the gate on files that would be pushed. Use in git pre-push hook:
 *   pnpm exec tsx scripts/shipgate-pre-push.ts
 *
 * Also usable as pre-commit (--staged) to check only staged files.
 */

import { execSync, spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve, relative } from 'path';

const ROOT = process.cwd();

function getFilesToCheck(mode: 'staged' | 'push'): string[] {
  try {
    if (mode === 'staged') {
      const out = execSync('git diff --name-only --cached', {
        encoding: 'utf-8',
        cwd: ROOT,
      });
      return out.trim().split('\n').filter(Boolean);
    }
    // push: files in commits we're about to push (HEAD vs @{push})
    try {
      const out = execSync('git diff --name-only @{push}..HEAD', {
        encoding: 'utf-8',
        cwd: ROOT,
      });
      const files = out.trim().split('\n').filter(Boolean);
      if (files.length > 0) return files;
    } catch {
      /* @{push} may not exist for new branches */
    }
    // Fallback: all changed files (staged + unstaged)
    const diff = execSync('git diff --name-only HEAD', { encoding: 'utf-8', cwd: ROOT });
    const staged = execSync('git diff --name-only --cached', { encoding: 'utf-8', cwd: ROOT });
    return [...new Set([...diff.split('\n'), ...staged.split('\n')])].filter(Boolean);
  } catch {
    return [];
  }
}

function filterSourceFiles(files: string[]): string[] {
  return files
    .filter((f) => {
      if (!/\.(ts|tsx|js|jsx)$/.test(f)) return false;
      if (f.includes('node_modules') || f.includes('dist/') || f.includes('build/')) return false;
      // Exclude test files (vitest/jest are devDependencies; gate false-positives on ghost-import)
      if (f.includes('.test.') || f.includes('.spec.') || f.includes('/tests/') || f.includes('\\tests\\') || f.includes('__tests__')) return false;
      // Exclude scripts (CI/build scripts; console.log is acceptable)
      if (f.startsWith('scripts/')) return false;
      // Exclude isl-firewall (gate's own CLI; console.log/imports are self-referential)
      if (f.includes('packages/isl-firewall/') || f.includes('packages\\isl-firewall\\')) return false;
      // Exclude Next.js apps — framework imports (next/server, @/ aliases) can't be resolved from monorepo root
      if (f.includes('packages/shipgate-dashboard/') || f.includes('packages\\shipgate-dashboard\\')) return false;
      if (f.includes('docs-site/') || f.includes('landing-main/')) return false;
      return true;
    })
    .map((f) => resolve(ROOT, f))
    .filter((f) => existsSync(f));
}

async function runGate(files: string[]): Promise<{ exitCode: number; output: string }> {
  const cliPath = resolve(ROOT, 'packages/isl-firewall/dist/cli.js');
  const agentPath = resolve(ROOT, 'packages/isl-firewall/src/cli.ts');

  // Prefer tsx (source) so pre-commit always uses latest code; fallback to dist if tsx fails
  const args = ['gate', '--explain', ...files.map((f) => relative(ROOT, f))];

  const result = spawnSync('pnpm', ['exec', 'tsx', agentPath, ...args], {
    cwd: ROOT,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (result.status !== null && result.status !== 127) {
    return {
      exitCode: result.status,
      output: result.stdout + result.stderr,
    };
  }

  // Fallback to built dist if tsx not available
  if (existsSync(cliPath)) {
    const distResult = spawnSync('node', [cliPath, ...args], {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return {
      exitCode: distResult.status ?? 1,
      output: distResult.stdout + distResult.stderr,
    };
  }

  return {
    exitCode: 1,
    output: 'Neither tsx nor isl-firewall dist available. Run: pnpm install && pnpm --filter @isl-lang/firewall build',
  };
}

async function main() {
  const staged = process.argv.includes('--staged');
  const mode = staged ? 'staged' : 'push';

  const files = filterSourceFiles(getFilesToCheck(mode));

  if (files.length === 0) {
    console.log('No source files to gate. Skipping.');
    process.exit(0);
  }

  // Skip gate when too many files to avoid slow pre-commit (run full gate in CI or manually)
  const MAX_FILES = 200;
  if (files.length > MAX_FILES) {
    console.log(`\n🛡️ Shipgate: skipping gate (${files.length} files > ${MAX_FILES} limit). Run \`pnpm shipgate:gate\` manually or rely on CI.\n`);
    process.exit(0);
  }

  console.log(`\n🛡️ Shipgate: gating ${files.length} file(s)...\n`);

  const { exitCode, output } = await runGate(files);
  console.log(output);

  if (exitCode !== 0) {
    console.log('\n💡 To auto-fix violations: run `pnpm isl heal ./src` or `isl heal ./src`\n');
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
