/**
 * Test Runner - Execute vitest, parse results, fix loop
 *
 * After generating tests:
 * 1. Run vitest run --reporter=json
 * 2. Parse results
 * 3. If failures: send failing test + source + error to fix (max 2 iterations)
 * 4. Report: X/Y tests passing
 */

import { spawn } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { existsSync } from 'node:fs';

export interface TestRunResult {
  success: boolean;
  passed: number;
  failed: number;
  total: number;
  passRate: number;
  failures: TestFailure[];
  output: string;
  durationMs: number;
}

export interface TestFailure {
  file: string;
  name: string;
  error: string;
  line?: number;
  column?: number;
}

export interface TestReport {
  passed: number;
  failed: number;
  total: number;
  passRate: number;
  verdict: 'PASS' | 'WARN' | 'FAIL';
  message: string;
  failures: TestFailure[];
}

/**
 * Parse Vitest JSON reporter output
 */
function parseVitestJson(output: string): { passed: number; failed: number; total: number; failures: TestFailure[] } {
  try {
    const lines = output.trim().split('\n');
    const jsonLine = lines.find((l) => l.startsWith('{') && l.includes('testResults'));
    if (!jsonLine) {
      return { passed: 0, failed: 0, total: 0, failures: [] };
    }

    const result = JSON.parse(jsonLine) as {
      testResults?: Array<{
        name: string;
        status: string;
        assertionResults?: Array<{
          fullName: string;
          status: string;
          failureMessages?: string[];
        }>;
      }>;
    };

    const failures: TestFailure[] = [];
    let passed = 0;
    let failed = 0;

    for (const file of result.testResults ?? []) {
      for (const test of file.assertionResults ?? []) {
        if (test.status === 'passed') {
          passed++;
        } else if (test.status === 'failed') {
          failed++;
          failures.push({
            file: file.name,
            name: test.fullName,
            error: test.failureMessages?.join('\n') ?? 'Unknown error',
          });
        }
      }
    }

    return {
      passed,
      failed,
      total: passed + failed,
      failures,
    };
  } catch {
    return { passed: 0, failed: 0, total: 0, failures: [] };
  }
}

/**
 * Run vitest and return results
 */
export async function runVitest(
  cwd: string,
  options: { configPath?: string; resultsPath?: string } = {}
): Promise<TestRunResult> {
  const start = Date.now();
  const configPath = options.configPath ?? path.join(cwd, 'tests', 'vitest.config.ts');
  const resultsPath = options.resultsPath ?? path.join(cwd, 'tests', 'results.json');

  return new Promise((resolve) => {
    const args = [
      'run',
      '--reporter=verbose',
      '--reporter=json',
      `--outputFile.json=${resultsPath}`,
    ];

    if (existsSync(configPath)) {
      args.push('--config', configPath);
    }

    const proc = spawn('npx', ['vitest', ...args], {
      cwd,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr?.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('close', async (code) => {
      const output = stdout + stderr;
      let passed = 0;
      let failed = 0;
      let total = 0;
      let failures: TestFailure[] = [];

      try {
        const jsonContent = await fs.readFile(resultsPath, 'utf-8').catch(() => '{}');
        const parsed = parseVitestJsonFile(jsonContent);
        passed = parsed.passed;
        failed = parsed.failed;
        total = parsed.total;
        failures = parsed.failures;
      } catch {
        const fromOutput = parseVitestJson(output);
        passed = fromOutput.passed;
        failed = fromOutput.failed;
        total = fromOutput.total;
        failures = fromOutput.failures;
      }

      resolve({
        success: code === 0,
        passed,
        failed,
        total,
        passRate: total > 0 ? passed / total : 1,
        failures,
        output,
        durationMs: Date.now() - start,
      });
    });

    proc.on('error', () => {
      resolve({
        success: false,
        passed: 0,
        failed: 0,
        total: 0,
        passRate: 0,
        failures: [],
        output: stderr || 'Failed to run vitest',
        durationMs: Date.now() - start,
      });
    });
  });
}

/**
 * Parse Vitest JSON output file format
 */
function parseVitestJsonFile(content: string): { passed: number; failed: number; total: number; failures: TestFailure[] } {
  try {
    const data = JSON.parse(content) as {
      testResults?: Array<{
        name: string;
        assertionResults?: Array<{
          fullName: string;
          status: string;
          failureMessages?: string[];
        }>;
      }>;
    };

    const failures: TestFailure[] = [];
    let passed = 0;
    let failed = 0;

    for (const file of data.testResults ?? []) {
      for (const test of file.assertionResults ?? []) {
        if (test.status === 'passed') {
          passed++;
        } else if (test.status === 'failed') {
          failed++;
          failures.push({
            file: file.name,
            name: test.fullName,
            error: test.failureMessages?.join('\n') ?? 'Unknown error',
          });
        }
      }
    }

    return { passed, failed, total: passed + failed, failures };
  } catch {
    return { passed: 0, failed: 0, total: 0, failures: [] };
  }
}


/**
 * Produce test report for SHIP verdict
 * SHIP requires: all tests pass OR >=80% pass with failures only in edge cases
 */
export function produceTestReport(result: TestRunResult): TestReport {
  const { passed, failed, total, passRate, failures } = result;

  const edgeCasePatterns = [
    /edge case/i,
    /boundary/i,
    /invalid input/i,
    /error condition/i,
    /timeout/i,
    /concurrent/i,
  ];

  const nonEdgeFailures = failures.filter(
    (f) => !edgeCasePatterns.some((p) => p.test(f.name) || p.test(f.error))
  );

  let verdict: 'PASS' | 'WARN' | 'FAIL';
  let message: string;

  if (total === 0) {
    verdict = 'WARN';
    message = 'No tests executed';
  } else if (failed === 0) {
    verdict = 'PASS';
    message = `${passed}/${total} tests passing`;
  } else if (passRate >= 0.8 && nonEdgeFailures.length === 0) {
    verdict = 'PASS';
    message = `${passed}/${total} tests passing (${failed} edge-case failures allowed)`;
  } else if (passRate >= 0.8) {
    verdict = 'WARN';
    message = `${passed}/${total} tests passing — ${nonEdgeFailures.length} non-edge failures`;
  } else {
    verdict = 'FAIL';
    message = `${passed}/${total} tests passing — ${failed} failures`;
  }

  return {
    passed,
    failed,
    total,
    passRate,
    verdict,
    message,
    failures,
  };
}
