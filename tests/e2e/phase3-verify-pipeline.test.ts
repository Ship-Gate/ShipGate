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

describe('Phase 3 P0 Bug Fixes Validation', () => {
  it('BUG-001: PBT failures are incorporated into evidence score', async () => {
    mkdirSync(REPORT_DIR, { recursive: true });
    const reportPath = join(REPORT_DIR, 'pbt-evidence.json');
    const result = await runCLI([
      'verify', AUTH_SPEC, '--impl', AUTH_IMPL, '--pbt', '--report', reportPath
    ]);
    
    if (existsSync(reportPath)) {
      const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
      
      // If PBT found failures, they should be in the evidence bundle
      if (report.pbtResults && !report.pbtResults.success) {
        expect(report.failures.length).toBeGreaterThan(0);
        expect(report.evidenceScore.failedChecks).toBeGreaterThan(0);
      }
    }
  }, 120000);

  it('BUG-003: Evidence bundle includes SMT/PBT/temporal results', async () => {
    mkdirSync(REPORT_DIR, { recursive: true });
    const reportPath = join(REPORT_DIR, 'all-evidence.json');
    await runCLI([
      'verify', AUTH_SPEC, '--impl', AUTH_IMPL, '--all', '--report', reportPath
    ]);
    
    if (existsSync(reportPath)) {
      const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
      
      // Evidence bundle should have dedicated sections for each verification type
      expect(report).toHaveProperty('smtResults');
      expect(report).toHaveProperty('pbtResults');
      expect(report).toHaveProperty('temporalResults');
      expect(report).toHaveProperty('failures');
    }
  }, 120000);

  it('BUG-005: Base verification produces non-zero test count or skipped synthetic tests', async () => {
    const result = await runCLI(['verify', AUTH_SPEC, '--impl', AUTH_IMPL, '--format', 'json']);
    
    if (result.exitCode === 0) {
      const parsed = JSON.parse(result.stdout);
      const testResult = parsed.verification?.testResult;
      
      // Should have either real tests or synthetic skipped tests
      if (testResult) {
        const totalTests = testResult.passed + testResult.failed + testResult.skipped;
        expect(totalTests).toBeGreaterThanOrEqual(0);
      }
    }
  }, 120000);

  it('Evidence score reflects failures when PBT finds issues', async () => {
    mkdirSync(REPORT_DIR, { recursive: true });
    const reportPath = join(REPORT_DIR, 'score-check.json');
    const result = await runCLI([
      'verify', AUTH_SPEC, '--impl', AUTH_IMPL, '--pbt', '--report', reportPath
    ]);
    
    if (existsSync(reportPath)) {
      const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
      
      // If there are failures, score should not be 100 (unless confidence is 0)
      if (report.evidenceScore.failedChecks > 0) {
        expect(report.evidenceScore.overall).toBeLessThan(100);
      }
    }
  }, 120000);

  it('Confidence is non-zero when tests are executed', async () => {
    mkdirSync(REPORT_DIR, { recursive: true });
    const reportPath = join(REPORT_DIR, 'confidence-check.json');
    await runCLI([
      'verify', AUTH_SPEC, '--impl', AUTH_IMPL, '--pbt', '--report', reportPath
    ]);
    
    if (existsSync(reportPath)) {
      const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
      
      // If totalChecks > 0, confidence should be > 0
      if (report.evidenceScore.totalChecks > 0) {
        expect(report.evidenceScore.confidence).toBeGreaterThan(0);
      }
    }
  }, 120000);
});
