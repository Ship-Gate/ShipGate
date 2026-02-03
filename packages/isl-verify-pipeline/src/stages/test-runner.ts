/**
 * Test Runner Stage
 * 
 * Executes generated tests and collects results.
 * Supports multiple test frameworks (Vitest, Jest, Mocha, Node test).
 * 
 * @module @isl-lang/verify-pipeline
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import type {
  TestRunnerOutput,
  TestSuiteResult,
  TestCaseResult,
  TestFramework,
  StageError,
} from '../types.js';

// ============================================================================
// Types
// ============================================================================

export interface TestRunnerConfig {
  /** Pattern for test files */
  pattern?: string;
  /** Test framework */
  framework?: TestFramework;
  /** Timeout in ms */
  timeout?: number;
  /** Collect coverage */
  coverage?: boolean;
  /** Working directory */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Additional args */
  args?: string[];
  /** Path to output results JSON */
  outputPath?: string;
}

// ============================================================================
// Framework Detection
// ============================================================================

/**
 * Detect test framework from package.json
 */
export async function detectFramework(cwd: string): Promise<TestFramework> {
  try {
    const pkgPath = path.join(cwd, 'package.json');
    const content = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content);
    
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };
    
    if ('vitest' in deps) return 'vitest';
    if ('jest' in deps) return 'jest';
    if ('mocha' in deps) return 'mocha';
    
    return 'node:test';
  } catch {
    return 'node:test';
  }
}

// ============================================================================
// Test Runner
// ============================================================================

/**
 * Run tests with the specified framework
 */
export async function runTests(config: TestRunnerConfig): Promise<TestRunnerOutput> {
  const cwd = config.cwd || process.cwd();
  const framework = config.framework || await detectFramework(cwd);
  const timeout = config.timeout || 60000;
  const outputPath = config.outputPath || path.join(cwd, '.verify-pipeline', 'test-results.json');
  
  // Ensure output directory exists
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  
  switch (framework) {
    case 'vitest':
      return runVitest(config, cwd, outputPath, timeout);
    case 'jest':
      return runJest(config, cwd, outputPath, timeout);
    case 'mocha':
      return runMocha(config, cwd, outputPath, timeout);
    case 'node:test':
      return runNodeTest(config, cwd, outputPath, timeout);
    default:
      throw createError('config_error', 'UNKNOWN_FRAMEWORK', `Unknown test framework: ${framework}`);
  }
}

// ============================================================================
// Vitest Runner
// ============================================================================

async function runVitest(
  config: TestRunnerConfig,
  cwd: string,
  outputPath: string,
  timeout: number
): Promise<TestRunnerOutput> {
  const args = [
    'run',
    '--reporter=json',
    `--outputFile=${outputPath}`,
  ];
  
  if (config.pattern) {
    args.push(config.pattern);
  }
  
  if (config.coverage) {
    args.push('--coverage');
  }
  
  if (config.args) {
    args.push(...config.args);
  }
  
  const startTime = Date.now();
  
  await runCommand('npx', ['vitest', ...args], {
    cwd,
    timeout,
    env: config.env,
  });
  
  const durationMs = Date.now() - startTime;
  
  // Parse Vitest JSON output
  try {
    const content = await fs.readFile(outputPath, 'utf-8');
    const results = JSON.parse(content);
    return parseVitestOutput(results, durationMs);
  } catch (error) {
    // If parsing fails, return empty results
    return {
      framework: 'vitest',
      suites: [],
      summary: {
        totalSuites: 0,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        durationMs,
      },
    };
  }
}

function parseVitestOutput(results: unknown, durationMs: number): TestRunnerOutput {
  const data = results as {
    numTotalTestSuites?: number;
    numPassedTestSuites?: number;
    numFailedTestSuites?: number;
    numTotalTests?: number;
    numPassedTests?: number;
    numFailedTests?: number;
    numPendingTests?: number;
    testResults?: Array<{
      name: string;
      status: string;
      assertionResults?: Array<{
        ancestorTitles?: string[];
        title: string;
        status: string;
        duration?: number;
        failureMessages?: string[];
      }>;
    }>;
  };
  
  const suites: TestSuiteResult[] = [];
  
  if (data.testResults) {
    for (const suite of data.testResults) {
      const tests: TestCaseResult[] = [];
      let suitePassed = 0;
      let suiteFailed = 0;
      let suiteSkipped = 0;
      
      if (suite.assertionResults) {
        for (const test of suite.assertionResults) {
          const status = test.status === 'passed' ? 'passed' 
            : test.status === 'failed' ? 'failed'
            : test.status === 'pending' ? 'pending'
            : 'skipped';
          
          tests.push({
            id: `${suite.name}::${test.title}`,
            name: test.title,
            status,
            durationMs: test.duration || 0,
            error: test.failureMessages?.length ? {
              message: test.failureMessages.join('\n'),
            } : undefined,
          });
          
          if (status === 'passed') suitePassed++;
          else if (status === 'failed') suiteFailed++;
          else suiteSkipped++;
        }
      }
      
      suites.push({
        name: suite.name,
        tests,
        totalTests: tests.length,
        passedTests: suitePassed,
        failedTests: suiteFailed,
        skippedTests: suiteSkipped,
        durationMs: tests.reduce((sum, t) => sum + t.durationMs, 0),
      });
    }
  }
  
  return {
    framework: 'vitest',
    suites,
    summary: {
      totalSuites: data.numTotalTestSuites || suites.length,
      totalTests: data.numTotalTests || suites.reduce((sum, s) => sum + s.totalTests, 0),
      passedTests: data.numPassedTests || suites.reduce((sum, s) => sum + s.passedTests, 0),
      failedTests: data.numFailedTests || suites.reduce((sum, s) => sum + s.failedTests, 0),
      skippedTests: data.numPendingTests || suites.reduce((sum, s) => sum + s.skippedTests, 0),
      durationMs,
    },
  };
}

// ============================================================================
// Jest Runner
// ============================================================================

async function runJest(
  config: TestRunnerConfig,
  cwd: string,
  outputPath: string,
  timeout: number
): Promise<TestRunnerOutput> {
  const args = [
    '--json',
    `--outputFile=${outputPath}`,
    '--testLocationInResults',
  ];
  
  if (config.pattern) {
    args.push('--testPathPattern', config.pattern);
  }
  
  if (config.coverage) {
    args.push('--coverage');
  }
  
  if (config.args) {
    args.push(...config.args);
  }
  
  const startTime = Date.now();
  
  await runCommand('npx', ['jest', ...args], {
    cwd,
    timeout,
    env: config.env,
  });
  
  const durationMs = Date.now() - startTime;
  
  try {
    const content = await fs.readFile(outputPath, 'utf-8');
    const results = JSON.parse(content);
    return parseJestOutput(results, durationMs);
  } catch {
    return {
      framework: 'jest',
      suites: [],
      summary: {
        totalSuites: 0,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        durationMs,
      },
    };
  }
}

function parseJestOutput(results: unknown, durationMs: number): TestRunnerOutput {
  // Jest output format is similar to Vitest
  return parseVitestOutput(results, durationMs);
}

// ============================================================================
// Mocha Runner
// ============================================================================

async function runMocha(
  config: TestRunnerConfig,
  cwd: string,
  outputPath: string,
  timeout: number
): Promise<TestRunnerOutput> {
  const args = [
    '--reporter', 'json',
    '--reporter-option', `output=${outputPath}`,
  ];
  
  if (config.pattern) {
    args.push(config.pattern);
  }
  
  if (config.args) {
    args.push(...config.args);
  }
  
  const startTime = Date.now();
  
  await runCommand('npx', ['mocha', ...args], {
    cwd,
    timeout,
    env: config.env,
  });
  
  const durationMs = Date.now() - startTime;
  
  try {
    const content = await fs.readFile(outputPath, 'utf-8');
    const results = JSON.parse(content);
    return parseMochaOutput(results, durationMs);
  } catch {
    return {
      framework: 'mocha',
      suites: [],
      summary: {
        totalSuites: 0,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        durationMs,
      },
    };
  }
}

function parseMochaOutput(results: unknown, durationMs: number): TestRunnerOutput {
  const data = results as {
    stats?: {
      suites?: number;
      tests?: number;
      passes?: number;
      failures?: number;
      pending?: number;
      duration?: number;
    };
    tests?: Array<{
      title: string;
      fullTitle: string;
      duration?: number;
      err?: { message?: string; stack?: string };
    }>;
    passes?: Array<{ title: string; fullTitle: string; duration?: number }>;
    failures?: Array<{ title: string; fullTitle: string; err?: { message?: string } }>;
    pending?: Array<{ title: string; fullTitle: string }>;
  };
  
  const tests: TestCaseResult[] = [];
  
  if (data.passes) {
    for (const test of data.passes) {
      tests.push({
        id: test.fullTitle,
        name: test.title,
        status: 'passed',
        durationMs: test.duration || 0,
      });
    }
  }
  
  if (data.failures) {
    for (const test of data.failures) {
      tests.push({
        id: test.fullTitle,
        name: test.title,
        status: 'failed',
        durationMs: 0,
        error: test.err ? { message: test.err.message || 'Unknown error' } : undefined,
      });
    }
  }
  
  if (data.pending) {
    for (const test of data.pending) {
      tests.push({
        id: test.fullTitle,
        name: test.title,
        status: 'pending',
        durationMs: 0,
      });
    }
  }
  
  // Group into single suite for simplicity
  const suite: TestSuiteResult = {
    name: 'Mocha Tests',
    tests,
    totalTests: tests.length,
    passedTests: data.stats?.passes || 0,
    failedTests: data.stats?.failures || 0,
    skippedTests: data.stats?.pending || 0,
    durationMs: data.stats?.duration || durationMs,
  };
  
  return {
    framework: 'mocha',
    suites: [suite],
    summary: {
      totalSuites: data.stats?.suites || 1,
      totalTests: data.stats?.tests || tests.length,
      passedTests: data.stats?.passes || 0,
      failedTests: data.stats?.failures || 0,
      skippedTests: data.stats?.pending || 0,
      durationMs,
    },
  };
}

// ============================================================================
// Node Test Runner
// ============================================================================

async function runNodeTest(
  config: TestRunnerConfig,
  cwd: string,
  outputPath: string,
  timeout: number
): Promise<TestRunnerOutput> {
  const args = [
    '--test',
    '--test-reporter=tap',
  ];
  
  if (config.pattern) {
    args.push(config.pattern);
  }
  
  if (config.args) {
    args.push(...config.args);
  }
  
  const startTime = Date.now();
  
  const { stdout } = await runCommand('node', args, {
    cwd,
    timeout,
    env: config.env,
    captureOutput: true,
  });
  
  const durationMs = Date.now() - startTime;
  
  // Parse TAP output
  return parseNodeTestOutput(stdout || '', durationMs);
}

function parseNodeTestOutput(output: string, durationMs: number): TestRunnerOutput {
  const lines = output.split('\n');
  const tests: TestCaseResult[] = [];
  let passed = 0;
  let failed = 0;
  
  for (const line of lines) {
    if (line.startsWith('ok ')) {
      const name = line.replace(/^ok \d+ - /, '').trim();
      tests.push({
        id: name,
        name,
        status: 'passed',
        durationMs: 0,
      });
      passed++;
    } else if (line.startsWith('not ok ')) {
      const name = line.replace(/^not ok \d+ - /, '').trim();
      tests.push({
        id: name,
        name,
        status: 'failed',
        durationMs: 0,
        error: { message: 'Test failed' },
      });
      failed++;
    }
  }
  
  return {
    framework: 'node:test',
    suites: [{
      name: 'Node Tests',
      tests,
      totalTests: tests.length,
      passedTests: passed,
      failedTests: failed,
      skippedTests: 0,
      durationMs,
    }],
    summary: {
      totalSuites: 1,
      totalTests: tests.length,
      passedTests: passed,
      failedTests: failed,
      skippedTests: 0,
      durationMs,
    },
  };
}

// ============================================================================
// Utilities
// ============================================================================

interface RunCommandOptions {
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
  captureOutput?: boolean;
}

interface RunCommandResult {
  exitCode: number;
  stdout?: string;
  stderr?: string;
}

async function runCommand(
  cmd: string,
  args: string[],
  options: RunCommandOptions
): Promise<RunCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: options.cwd,
      shell: true,
      env: { ...process.env, ...options.env },
      stdio: options.captureOutput ? ['pipe', 'pipe', 'pipe'] : 'inherit',
    });
    
    let stdout = '';
    let stderr = '';
    
    if (options.captureOutput) {
      child.stdout?.on('data', (data) => { stdout += data; });
      child.stderr?.on('data', (data) => { stderr += data; });
    }
    
    const timer = options.timeout 
      ? setTimeout(() => {
          child.kill('SIGTERM');
          reject(createError('timeout', 'TEST_TIMEOUT', `Test execution timed out after ${options.timeout}ms`));
        }, options.timeout)
      : null;
    
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({
        exitCode: code || 0,
        stdout: options.captureOutput ? stdout : undefined,
        stderr: options.captureOutput ? stderr : undefined,
      });
    });
    
    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      reject(createError('internal_error', 'SPAWN_ERROR', err.message));
    });
  });
}

function createError(
  category: StageError['category'],
  code: string,
  message: string
): StageError {
  return {
    category,
    code,
    message,
    stage: 'test_runner',
    recoverable: category === 'timeout',
  };
}
