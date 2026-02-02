#!/usr/bin/env node
/**
 * ISL Mutation Testing Harness - CLI Runner
 * 
 * Run mutation tests to validate verification effectiveness.
 * 
 * Usage:
 *   npx tsx bench/mutation/src/runner.ts [options]
 * 
 * Options:
 *   -m, --mutation <type>   Run only specific mutation type
 *   -f, --fixture <name>    Run only specific fixture
 *   -v, --verbose           Enable verbose output
 *   --bail                  Stop on first surviving mutation
 *   -o, --output <dir>      Output directory for reports
 */

import { parseArgs } from 'node:util';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';

import type { HarnessConfig, MutationType } from './types.js';
import { getMutationTypes, isValidMutationType } from './mutators/index.js';
import { 
  runMutationHarness, 
  writeReport, 
  printReportSummary 
} from './harness.js';

// ============================================================================
// CLI ARGUMENT PARSING
// ============================================================================

interface CLIOptions {
  mutation?: string;
  fixture?: string;
  verbose: boolean;
  bail: boolean;
  output?: string;
  help: boolean;
}

function parseCliArgs(): CLIOptions {
  try {
    const { values } = parseArgs({
      options: {
        mutation: { type: 'string', short: 'm' },
        fixture: { type: 'string', short: 'f' },
        verbose: { type: 'boolean', short: 'v', default: false },
        bail: { type: 'boolean', short: 'b', default: false },
        output: { type: 'string', short: 'o' },
        help: { type: 'boolean', short: 'h', default: false },
      },
      strict: true,
    });
    return values as CLIOptions;
  } catch (error) {
    console.error('Error parsing arguments:', error);
    return { verbose: false, bail: false, help: true };
  }
}

function printHelp(): void {
  const mutationTypes = getMutationTypes().join(', ');
  
  console.log(`
ISL Mutation Testing Harness

Validates that the ISL verification system catches real bugs by intentionally
breaking code and ensuring the verifier properly fails.

Usage:
  npx tsx bench/mutation/src/runner.ts [options]

Options:
  -m, --mutation <type>   Run only specific mutation type
  -f, --fixture <name>    Run only specific fixture
  -v, --verbose           Enable verbose output
  -b, --bail              Stop on first surviving mutation
  -o, --output <dir>      Output directory for reports
  -h, --help              Show this help message

Available Mutation Types:
  ${mutationTypes}

Examples:
  # Run all mutation tests
  npx tsx bench/mutation/src/runner.ts

  # Run with verbose output
  npx tsx bench/mutation/src/runner.ts --verbose

  # Run only remove-assert mutations
  npx tsx bench/mutation/src/runner.ts --mutation remove-assert

  # Run only the counter fixture
  npx tsx bench/mutation/src/runner.ts --fixture counter

  # Stop on first surviving mutation
  npx tsx bench/mutation/src/runner.ts --bail
`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const options = parseCliArgs();
  
  if (options.help) {
    printHelp();
    process.exit(0);
  }

  console.log('ISL Mutation Testing Harness');
  console.log('='.repeat(40));

  // Resolve paths - use fileURLToPath for ESM compatibility
  const currentDir = import.meta.dirname ?? 
    (import.meta.url ? new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') : __dirname);
  const benchRoot = resolve(currentDir, '..');
  const fixturesDir = join(benchRoot, 'fixtures');
  const outputDir = options.output 
    ? resolve(options.output)
    : join(benchRoot, 'output');
  
  if (options.verbose) {
    console.log(`\nPaths:`);
    console.log(`  Current: ${currentDir}`);
    console.log(`  Bench root: ${benchRoot}`);
    console.log(`  Fixtures: ${fixturesDir}`);
  }

  // Build configuration
  const config: HarnessConfig = {
    fixturesDir,
    outputDir,
    verifyTimeout: 30_000,
    verbose: options.verbose,
    bailOnSurvivor: options.bail,
  };

  // Apply filters
  if (options.mutation) {
    if (!isValidMutationType(options.mutation)) {
      console.error(`Invalid mutation type: ${options.mutation}`);
      console.error(`Valid types: ${getMutationTypes().join(', ')}`);
      process.exit(1);
    }
    config.mutationFilter = [options.mutation as MutationType];
  }

  if (options.fixture) {
    config.fixtureFilter = [options.fixture];
  }

  // Check fixtures directory
  if (!existsSync(fixturesDir)) {
    console.log(`\nNo fixtures directory found at: ${fixturesDir}`);
    console.log('Creating example fixtures...');
    createExampleFixtures(fixturesDir);
  }

  // Run the harness
  const report = await runMutationHarness(config);

  // Write report
  if (report.totalMutations > 0) {
    const reportPath = writeReport(report, outputDir);
    console.log(`\nReport written to: ${reportPath}`);
  }

  // Print summary
  printReportSummary(report);

  // Exit code based on surviving mutations
  const exitCode = report.survived > 0 ? 1 : 0;
  process.exit(exitCode);
}

// ============================================================================
// FIXTURE GENERATION
// ============================================================================

/**
 * Create example fixtures if none exist
 */
function createExampleFixtures(fixturesDir: string): void {
  const { mkdirSync, writeFileSync } = require('node:fs');
  
  // Create counter fixture
  const counterDir = join(fixturesDir, 'counter');
  mkdirSync(counterDir, { recursive: true });
  
  // fixture.json
  writeFileSync(
    join(counterDir, 'fixture.json'),
    JSON.stringify({
      name: 'counter',
      specFile: 'counter.isl',
      implFile: 'counter.impl.ts',
      testFile: 'counter.test.ts',
      mutations: [
        {
          id: 'remove-increment-assert',
          type: 'remove-assert',
          description: 'Remove assertion that value must be positive',
          target: { file: 'counter.impl.ts', line: 12 },
          expectedFailedClause: 'precondition_1',
        },
        {
          id: 'change-boundary-check',
          type: 'change-comparator',
          description: 'Change > to >= in boundary check',
          target: { file: 'counter.impl.ts', line: 8 },
          expectedFailedClause: 'invariant_boundary_1',
        },
        {
          id: 'delete-result-check',
          type: 'delete-expectation',
          description: 'Delete expectation for result value',
          target: { file: 'counter.test.ts', line: 15 },
          expectedFailedClause: 'postcondition_success_1',
        },
        {
          id: 'bypass-validation',
          type: 'bypass-precondition',
          description: 'Bypass input validation',
          target: { file: 'counter.impl.ts', line: 4 },
          expectedFailedClause: 'precondition_validation_1',
        },
      ],
      expectedBaselineScore: 100,
    }, null, 2)
  );
  
  // counter.isl
  writeFileSync(
    join(counterDir, 'counter.isl'),
    `# Counter Domain
domain Counter {
  version: "1.0.0"

  entity Counter {
    id: UUID
    value: Int [default: 0]
    
    invariants {
      value >= 0
    }
  }

  behavior Increment {
    input {
      counterId: UUID
      amount: Int
    }

    output {
      success: Counter
      errors {
        INVALID_AMOUNT { when: "Amount is not positive" }
        COUNTER_NOT_FOUND { when: "Counter does not exist" }
      }
    }

    pre {
      amount > 0
      Counter.exists(counterId)
    }

    post success {
      result.value == old(Counter.lookup(counterId).value) + input.amount
      result.value > 0
    }

    invariants {
      result.value >= 0
    }
  }
}
`
  );
  
  // counter.impl.ts
  writeFileSync(
    join(counterDir, 'counter.impl.ts'),
    `/**
 * Counter Implementation
 */

function validateInput(amount: number): boolean {
  return amount > 0 && Number.isInteger(amount);
}

function checkBoundary(value: number): boolean {
  return value > 0;
}

export function increment(counterId: string, amount: number): { value: number } {
  assert(validateInput(amount), 'Amount must be a positive integer');
  
  // Get current value (simulated)
  const currentValue = 0; // Would be fetched from store
  
  const newValue = currentValue + amount;
  
  if (!checkBoundary(newValue)) {
    throw new Error('Value out of bounds');
  }
  
  return { value: newValue };
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}
`
  );
  
  // counter.test.ts
  writeFileSync(
    join(counterDir, 'counter.test.ts'),
    `/**
 * Counter Tests
 */
import { increment } from './counter.impl';

describe('Counter', () => {
  it('should increment counter', () => {
    const counterId = 'test-counter';
    const amount = 5;
    
    const result = increment(counterId, amount);
    
    expect(result).toBeDefined();
    expect(result.value).toBeGreaterThan(0);
    expect(result.value).toBe(amount);
  });

  it('should reject negative amounts', () => {
    expect(() => increment('test', -1)).toThrow();
  });

  it('should reject zero amounts', () => {
    expect(() => increment('test', 0)).toThrow();
  });
});
`
  );
  
  console.log(`Created example fixture: ${counterDir}`);
}

// Run if executed directly
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
