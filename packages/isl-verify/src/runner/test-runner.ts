/**
 * Test Runner
 * 
 * Executes generated tests against implementations.
 */

import { spawn } from 'child_process';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { DomainDeclaration } from '@intentos/isl-core';
import { compile } from '@intentos/isl-compiler';

export interface TestResult {
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  details: TestDetail[];
}

export interface TestDetail {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

export interface RunnerOptions {
  timeout?: number;
  verbose?: boolean;
  workDir?: string;
}

export class TestRunner {
  private options: Required<RunnerOptions>;

  constructor(options: RunnerOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 30000,
      verbose: options.verbose ?? false,
      workDir: options.workDir ?? join(tmpdir(), 'isl-verify'),
    };
  }

  /**
   * Run verification tests for a domain against an implementation
   */
  async run(
    domain: DomainDeclaration,
    implementationCode: string
  ): Promise<TestResult> {
    // Create temp directory
    const workDir = join(this.options.workDir, `verify-${Date.now()}`);
    await mkdir(workDir, { recursive: true });

    try {
      // Generate test files
      const { types, tests } = compile(domain);

      // Write files
      await writeFile(join(workDir, types.filename), types.content);
      await writeFile(join(workDir, tests.filename), tests.content);
      await writeFile(
        join(workDir, `${domain.name.name.toLowerCase()}.impl.ts`),
        implementationCode
      );

      // Write package.json for the test
      await writeFile(
        join(workDir, 'package.json'),
        JSON.stringify({
          type: 'module',
          scripts: {
            test: 'vitest run --reporter=json',
          },
        })
      );

      // Write vitest config
      await writeFile(
        join(workDir, 'vitest.config.ts'),
        `import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: true,
    testTimeout: ${this.options.timeout},
  },
});`
      );

      // Run tests
      const result = await this.executeTests(workDir);
      return result;
    } finally {
      // Cleanup
      if (!this.options.verbose) {
        await rm(workDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  }

  /**
   * Execute vitest and parse results
   */
  private executeTests(workDir: string): Promise<TestResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';

      const proc = spawn('npx', ['vitest', 'run', '--reporter=json'], {
        cwd: workDir,
        shell: true,
        timeout: this.options.timeout,
      });

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('error', (error) => {
        reject(error);
      });

      proc.on('close', (code) => {
        const duration = Date.now() - startTime;

        // Parse vitest JSON output
        try {
          const result = this.parseVitestOutput(stdout, duration);
          resolve(result);
        } catch (e) {
          // If parsing fails, create a basic result
          resolve({
            passed: code === 0 ? 1 : 0,
            failed: code === 0 ? 0 : 1,
            skipped: 0,
            duration,
            details: [{
              name: 'test-execution',
              status: code === 0 ? 'passed' : 'failed',
              duration,
              error: code !== 0 ? stderr || stdout : undefined,
            }],
          });
        }
      });
    });
  }

  /**
   * Parse vitest JSON output
   */
  private parseVitestOutput(output: string, totalDuration: number): TestResult {
    // Try to find JSON in output
    const jsonMatch = output.match(/\{[\s\S]*"testResults"[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: totalDuration,
        details: [],
      };
    }

    const json = JSON.parse(jsonMatch[0]);
    const details: TestDetail[] = [];
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    for (const file of json.testResults ?? []) {
      for (const test of file.assertionResults ?? []) {
        const status = test.status === 'passed' ? 'passed' 
          : test.status === 'failed' ? 'failed' 
          : 'skipped';
        
        if (status === 'passed') passed++;
        else if (status === 'failed') failed++;
        else skipped++;

        details.push({
          name: test.fullName ?? test.title ?? 'unknown',
          status,
          duration: test.duration ?? 0,
          error: test.failureMessages?.join('\n'),
        });
      }
    }

    return {
      passed,
      failed,
      skipped,
      duration: totalDuration,
      details,
    };
  }
}

/**
 * Run verification tests
 */
export async function runTests(
  domain: DomainDeclaration,
  implementationCode: string,
  options?: RunnerOptions
): Promise<TestResult> {
  const runner = new TestRunner(options);
  return runner.run(domain, implementationCode);
}
