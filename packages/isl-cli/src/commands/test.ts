/**
 * Test Command
 * 
 * Runs executable tests and generates proof bundles with traces.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import type { Trace } from '@isl-lang/trace-viewer';
import type { TestResult, TestFileResult } from '@isl-lang/proof';

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

export interface TestOptions {
  /** Test directory or file pattern */
  pattern?: string;
  /** Output directory for proof bundle */
  outputDir?: string;
  /** Test framework (vitest or jest) */
  framework?: 'vitest' | 'jest';
  /** Verbose output */
  verbose?: boolean;
  /** Generate JUnit XML */
  junit?: boolean;
  /** Generate JSON summary */
  json?: boolean;
}

export interface TestCommandResult {
  success: boolean;
  testResult: TestResult;
  traces: Trace[];
  junitPath?: string;
  jsonPath?: string;
  error?: string;
}

// ============================================================================
// Test Runner
// ============================================================================

/**
 * Run tests and collect results
 */
export async function test(pattern: string, options: TestOptions = {}): Promise<TestCommandResult> {
  return runTests({ ...options, pattern });
}

/**
 * Run tests and collect results (internal)
 */
async function runTests(options: TestOptions = {}): Promise<TestCommandResult> {
  const {
    pattern = '**/*.test.ts',
    outputDir = '.proof-bundle',
    framework = 'vitest',
    verbose = false,
    junit = true,
    json = true,
  } = options;

  try {
    // Detect framework from package.json or use default
    const detectedFramework = await detectFramework();
    const testFramework = framework || detectedFramework || 'vitest';

    // Run tests
    const testOutput = await runTestFramework(testFramework, pattern, {
      junit,
      json,
      verbose,
    });

    // Parse test results
    const testResult = parseTestResults(testOutput, testFramework);

    // Collect traces from test execution
    const traces = await collectTraces();

    // Generate proof bundle artifacts
    const artifacts: { junitPath?: string; jsonPath?: string } = {};
    
    if (junit && testOutput.junitPath) {
      artifacts.junitPath = testOutput.junitPath;
    }

    if (json) {
      const jsonPath = path.join(outputDir, 'test-results.json');
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(
        jsonPath,
        JSON.stringify({
          ...testResult,
          traces: traces.map(t => ({
            id: t.id,
            name: t.name,
            domain: t.domain,
            metadata: t.metadata,
            eventCount: t.events.length,
          })),
        }, null, 2)
      );
      artifacts.jsonPath = jsonPath;
    }

    return {
      success: testResult.status === 'pass',
      testResult,
      traces,
      ...artifacts,
    };
  } catch (error) {
    return {
      success: false,
      testResult: {
        framework: framework || 'unknown',
        frameworkVersion: 'unknown',
        status: 'fail',
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        durationMs: 0,
        timestamp: new Date().toISOString(),
      },
      traces: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run test framework
 */
async function runTestFramework(
  framework: 'vitest' | 'jest',
  pattern: string,
  options: { junit: boolean; json: boolean; verbose: boolean }
): Promise<{ stdout: string; stderr: string; junitPath?: string }> {
  const args: string[] = [];

  if (framework === 'vitest') {
    args.push('vitest', 'run', pattern);
    
    if (options.junit) {
      const junitPath = path.join('.proof-bundle', 'junit.xml');
      args.push('--reporter=json', '--reporter=junit', '--outputFile.junit', junitPath);
    } else {
      args.push('--reporter=json');
    }

    if (options.verbose) {
      args.push('--reporter=verbose');
    }
  } else {
    // Jest
    args.push('jest', pattern);
    
    if (options.junit) {
      const junitPath = path.join('.proof-bundle', 'junit.xml');
      args.push('--reporters=default', `--reporters=jest-junit`, `--outputFile=${junitPath}`);
    }

    if (options.verbose) {
      args.push('--verbose');
    }
  }

  const { stdout, stderr } = await execAsync(args.join(' '), {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  });

  return {
    stdout,
    stderr,
    junitPath: options.junit ? path.join('.proof-bundle', 'junit.xml') : undefined,
  };
}

/**
 * Parse test results from framework output
 */
function parseTestResults(
  output: { stdout: string; stderr: string },
  framework: 'vitest' | 'jest'
): TestResult {
  try {
    if (framework === 'vitest') {
      // Try to parse JSON output
      const jsonMatch = output.stdout.match(/\{[\s\S]*"numTotalTests"[\s\S]*\}/);
      if (jsonMatch) {
        const json = JSON.parse(jsonMatch[0]);
        return {
          framework: 'vitest',
          frameworkVersion: 'unknown',
          status: json.numFailedTests > 0 ? 'fail' : json.numTotalTests === 0 ? 'no_tests' : 'pass',
          totalTests: json.numTotalTests || 0,
          passedTests: json.numPassedTests || 0,
          failedTests: json.numFailedTests || 0,
          skippedTests: json.numSkippedTests || 0,
          durationMs: json.startTime && json.endTime ? json.endTime - json.startTime : 0,
          testFiles: json.testResults?.map((file: {
            name: string;
            status: string;
            assertionResults: Array<{ title: string; status: string; duration?: number }>;
          }) => ({
            file: file.name,
            tests: file.assertionResults?.length || 0,
            passed: file.assertionResults?.filter((r: { status: string }) => r.status === 'passed').length || 0,
            failed: file.assertionResults?.filter((r: { status: string }) => r.status === 'failed').length || 0,
            skipped: file.assertionResults?.filter((r: { status: string }) => r.status === 'skipped').length || 0,
            durationMs: file.assertionResults?.reduce((sum: number, r: { duration?: number }) => sum + (r.duration || 0), 0) || 0,
            failures: file.assertionResults
              ?.filter((r: { status: string; failureMessages?: string[] }) => r.status === 'failed')
              .map((r: { title: string; failureMessages?: string[] }) => ({
                name: r.title,
                error: r.failureMessages?.join('\n') || 'Unknown error',
              })) || [],
          })) || [],
          timestamp: new Date().toISOString(),
        };
      }
    }

    // Fallback: parse from stdout
    const passedMatch = output.stdout.match(/(\d+)\s+passed/);
    const failedMatch = output.stdout.match(/(\d+)\s+failed/);
    const totalMatch = output.stdout.match(/Tests:\s+(\d+)/);

    return {
      framework,
      frameworkVersion: 'unknown',
      status: failedMatch && parseInt(failedMatch[1]) > 0 ? 'fail' : 'pass',
      totalTests: totalMatch ? parseInt(totalMatch[1]) : 0,
      passedTests: passedMatch ? parseInt(passedMatch[1]) : 0,
      failedTests: failedMatch ? parseInt(failedMatch[1]) : 0,
      skippedTests: 0,
      durationMs: 0,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    // Return default on parse error
    return {
      framework,
      frameworkVersion: 'unknown',
      status: 'fail',
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      durationMs: 0,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Collect traces from test execution
 */
async function collectTraces(): Promise<Trace[]> {
  const traces: Trace[] = [];

  // Traces are stored in globalThis.__testTrace during test execution
  // In a real implementation, we'd read from a trace store or file system
  // For now, return empty array - traces are collected during test execution
  // and stored in the proof bundle separately

  return traces;
}

/**
 * Detect test framework from package.json
 */
async function detectFramework(): Promise<'vitest' | 'jest' | null> {
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    
    if (packageJson.devDependencies?.vitest || packageJson.dependencies?.vitest) {
      return 'vitest';
    }
    if (packageJson.devDependencies?.jest || packageJson.dependencies?.jest) {
      return 'jest';
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Print test results
 */
export function printTestResult(result: TestCommandResult): void {
  console.log(chalk.bold('\n📊 Test Results\n'));
  
  const statusColor = result.success ? chalk.green : chalk.red;
  const statusIcon = result.success ? '✓' : '✗';
  
  console.log(`Status: ${statusColor(`${statusIcon} ${result.testResult.status.toUpperCase()}`)}`);
  console.log(`Framework: ${result.testResult.framework} ${result.testResult.frameworkVersion}`);
  console.log(`Tests: ${chalk.cyan(result.testResult.passedTests)}/${chalk.cyan(result.testResult.totalTests)} passed`);
  
  if (result.testResult.failedTests > 0) {
    console.log(`Failed: ${chalk.red(result.testResult.failedTests)}`);
  }
  
  if (result.testResult.skippedTests > 0) {
    console.log(`Skipped: ${chalk.yellow(result.testResult.skippedTests)}`);
  }
  
  console.log(`Duration: ${result.testResult.durationMs}ms`);
  console.log(`Traces: ${result.traces.length}`);
  
  if (result.junitPath) {
    console.log(`\nJUnit XML: ${chalk.cyan(result.junitPath)}`);
  }
  
  if (result.jsonPath) {
    console.log(`JSON Summary: ${chalk.cyan(result.jsonPath)}`);
  }
  
  if (result.error) {
    console.log(`\n${chalk.red('Error:')} ${result.error}`);
  }
  
  console.log('');
}
