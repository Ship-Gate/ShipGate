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
    .filter((f) =>
      /\.(ts|tsx|js|jsx)$/.test(f) &&
      !f.includes('node_modules') &&
      !f.includes('dist/') &&
      !f.includes('build/')
    )
    .map((f) => resolve(ROOT, f))
    .filter((f) => existsSync(f));
}

async function runGate(files: string[]): Promise<{ exitCode: number; output: string }> {
  const cliPath = resolve(ROOT, 'packages/isl-firewall/dist/cli.js');
  const agentPath = resolve(ROOT, 'packages/isl-firewall/src/cli.ts');

  // Prefer built CLI; fallback to tsx if dist not built
  const useBuilt = existsSync(cliPath);
  const args = ['gate', '--explain', ...files.map((f) => relative(ROOT, f))];

  if (useBuilt) {
    const result = spawnSync('node', [cliPath, ...args], {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return {
      exitCode: result.status ?? 1,
      output: result.stdout + result.stderr,
    };
  }

  // Use tsx to run CLI source
  const result = spawnSync('pnpm', ['exec', 'tsx', agentPath, ...args], {
    cwd: ROOT,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return {
    exitCode: result.status ?? 1,
    output: result.stdout + result.stderr,
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
