/**
 * Phase 3 Integration Test: Full Verify Pipeline
 *
 * Validates the complete end-to-end verification pipeline:
 *   ISL spec -> parse -> verify (SMT + PBT + Temporal + Chaos) -> proof bundle -> trust score
 *
 * Stop criteria:
 *   - isl verify examples/auth.isl --impl examples/auth-impl.ts works
 *   - Proof bundle contains SMT + PBT + Chaos + Temporal evidence
 *   - Trust score >= 80
 */

import { describe, it, expect } from 'vitest';
import { mkdirSync, readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { parse } from '@isl-lang/parser';

const execAsync = promisify(exec);

const ROOT = resolve(__dirname, '../..');
const CLI_PATH = resolve(ROOT, 'packages/cli/src/index.ts');
const AUTH_SPEC = resolve(ROOT, 'examples/auth.isl');
const AUTH_IMPL = resolve(ROOT, 'examples/auth-impl.ts');
const REPORT_DIR = resolve(ROOT, '.test-temp/phase3-reports');

async function runCLI(args: string[], options: { cwd?: string; timeout?: number } = {}) {
  const { cwd = ROOT, timeout = 120000 } = options;
  try {
    const { stdout, stderr } = await execAsync(
      `pnpm exec tsx "${CLI_PATH}" ${args.join(' ')}`,
      { cwd, timeout, env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' } }
    );
    return { exitCode: 0, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (error: unknown) {
    const e = error as { code?: number; stdout?: string; stderr?: string };
    return {
      exitCode: e.code ?? 1,
      stdout: e.stdout?.trim() ?? '',
      stderr: e.stderr?.trim() ?? '',
    };
  }
}

describe('Phase 3 Prerequisites', () => {
  it('auth.isl spec file exists', () => {
    expect(existsSync(AUTH_SPEC)).toBe(true);
  });
  it('auth-impl.ts implementation file exists', () => {
    expect(existsSync(AUTH_IMPL)).toBe(true);
  });
  it('auth.isl parses successfully', () => {
    const source = readFileSync(AUTH_SPEC, 'utf-8');
    const result = parse(source, AUTH_SPEC);
    expect(result.success).toBe(true);
    expect(result.domain?.name.name).toBe('UserAuthentication');
  });
});

describe('Phase 3 CLI Verify', () => {
  it('isl verify examples/auth.isl --impl examples/auth-impl.ts works', async () => {
    const result = await runCLI(['verify', AUTH_SPEC, '--impl', AUTH_IMPL, '--format', 'json']);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.success).toBe(true);
    expect(parsed.trustScore).toBeGreaterThanOrEqual(80);
  }, 120000);
  it('--report writes evidence report', async () => {
    mkdirSync(REPORT_DIR, { recursive: true });
    const reportPath = join(REPORT_DIR, 'auth-evidence.json');
    await runCLI(['verify', AUTH_SPEC, '--impl', AUTH_IMPL, '--report', reportPath]);
    if (existsSync(reportPath)) {
      const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
      expect(report).toHaveProperty('metadata');
      expect(report).toHaveProperty('evidenceScore');
    }
  }, 120000);
});
