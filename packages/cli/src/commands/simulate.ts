/**
 * Simulate Command
 * 
 * Run ISL behavior simulations against generated inputs.
 * 
 * Usage:
 *   shipgate simulate <spec> --behavior <name>    # Simulate specific behavior
 *   shipgate simulate <spec> --generate            # Generate inputs and simulate
 *   shipgate simulate <spec> --input <file>        # Use input file
 */

import { readFile } from 'fs/promises';
import { resolve } from 'path';
import chalk from 'chalk';
import { parse as parseISL, type Domain } from '@isl-lang/parser';
import { output } from '../output.js';

// @isl-lang/interpreter is optional - loaded dynamically
type SimulationResult = any;
type TestData = any;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SimulateOptions {
  /** ISL spec file path */
  spec: string;
  /** Behavior name to simulate */
  behavior?: string;
  /** Generate inputs automatically */
  generate?: boolean;
  /** Input test data file (JSON) */
  input?: string;
  /** Number of generated inputs */
  count?: number;
  /** Timeout per simulation in milliseconds */
  timeout?: number;
  /** Verbose output */
  verbose?: boolean;
  /** Output format */
  format?: 'text' | 'json';
}

export interface SimulateResult {
  success: boolean;
  specFile: string;
  behavior?: string;
  results: SimulationResult[];
  totalDuration: number;
  errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Function
// ─────────────────────────────────────────────────────────────────────────────

export async function simulateCommand(options: SimulateOptions): Promise<SimulateResult> {
  const startTime = performance.now();
  const errors: string[] = [];
  const results: SimulationResult[] = [];

  try {
    // Load and parse ISL spec
    const specPath = resolve(options.spec);
    const specContent = await readFile(specPath, 'utf-8');
    const parseResult = parseISL(specContent);

    if (!parseResult.success || !parseResult.domain) {
      const errorMsg = parseResult.errors?.map((e) => e.message).join(', ') || 'Parse failed';
      throw new Error(`Failed to parse ISL spec: ${errorMsg}`);
    }

    const domain = parseResult.domain;

    // Determine which behaviors to simulate
    const behaviorsToSimulate = options.behavior
      ? [domain.behaviors.find((b) => b.name.name === options.behavior)]
      : domain.behaviors;

    const validBehaviors = behaviorsToSimulate.filter((b): b is NonNullable<typeof b> => b !== undefined);

    if (validBehaviors.length === 0) {
      throw new Error(`No behaviors found${options.behavior ? ` matching "${options.behavior}"` : ''}`);
    }

    // Dynamically load interpreter (optional dependency)
    let RuntimeSimulator: any;
    let simulate: any;
    let parseTestData: any;
    
    try {
      // @ts-expect-error - @isl-lang/interpreter is an optional dependency
      const interpreterModule = await import('@isl-lang/interpreter');
      RuntimeSimulator = interpreterModule.RuntimeSimulator;
      simulate = interpreterModule.simulate;
      parseTestData = interpreterModule.parseTestData;
    } catch (error: unknown) {
      // @isl-lang/interpreter is an optional dependency
      throw new Error(
        '@isl-lang/interpreter is not available. Install it with: pnpm add -D @isl-lang/interpreter'
      );
    }

    // Create simulator
    const simulator = new RuntimeSimulator({
      timeout: options.timeout ?? 5000,
      sandbox: true,
      allowFs: false,
      allowNet: false,
      verbose: options.verbose ?? false,
    });

    simulator.setDomain(domain);

    // Generate or load test data
    if (options.input) {
      // Load from file
      const inputPath = resolve(options.input);
      const inputContent = await readFile(inputPath, 'utf-8');
      const testData = parseTestData(JSON.parse(inputContent));

      for (const behavior of validBehaviors) {
        const result = await simulator.simulate(behavior.name.name, testData);
        results.push(result);
      }
    } else if (options.generate) {
      // Generate simple test inputs
      const count = options.count ?? 5;

      for (const behavior of validBehaviors) {
        // Generate simple test data based on input spec
        const testData = generateSimpleTestData(behavior, count);

        for (const test of testData) {
          const result = await simulator.simulate(behavior.name.name, test);
          results.push(result);
        }
      }
    } else {
      // Default: generate one simple test
      for (const behavior of validBehaviors) {
        const testData = generateSimpleTestData(behavior, 1)[0]!;
        const result = await simulator.simulate(behavior.name.name, testData);
        results.push(result);
      }
    }

    const totalDuration = performance.now() - startTime;
    const success = results.every((r) => r.passed);

    return {
      success,
      specFile: specPath,
      behavior: options.behavior,
      results,
      totalDuration,
      errors,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return {
      success: false,
      specFile: options.spec,
      behavior: options.behavior,
      results: [],
      totalDuration: performance.now() - startTime,
      errors,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Data Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate simple test data for a behavior
 */
function generateSimpleTestData(behavior: Domain['behaviors'][0], count: number): TestData[] {
  const testDataList: TestData[] = [];

  for (let i = 0; i < count; i++) {
    const pre: Record<string, unknown> = {};

    // Generate values for each input field
    for (const field of behavior.input.fields) {
      const fieldName = field.name.name;
      const fieldType = field.type;

      // Simple value generation based on type
      if (fieldType.kind === 'PrimitiveType') {
        switch (fieldType.name) {
          case 'String':
            pre[fieldName] = `test_${fieldName}_${i}`;
            break;
          case 'Int':
            pre[fieldName] = 10 + i;
            break;
          case 'Decimal':
            pre[fieldName] = 10.5 + i;
            break;
          case 'Boolean':
            pre[fieldName] = i % 2 === 0;
            break;
          case 'UUID':
            pre[fieldName] = `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`;
            break;
          default:
            pre[fieldName] = null;
        }
      } else {
        pre[fieldName] = null;
      }
    }

    testDataList.push({
      intent: behavior.name.name,
      bindings: { pre },
    });
  }

  return testDataList;
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Functions
// ─────────────────────────────────────────────────────────────────────────────

export function printSimulateResult(result: SimulateResult, options: { format?: 'text' | 'json'; verbose?: boolean } = {}): void {
  const isJson = options.format === 'json';

  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Text output
  console.log('');
  console.log(chalk.bold.cyan('Simulation Results'));
  console.log(chalk.gray(`Spec: ${result.specFile}`));
  if (result.behavior) {
    console.log(chalk.gray(`Behavior: ${result.behavior}`));
  }
  console.log('');

  if (result.errors.length > 0) {
    console.log(chalk.red('Errors:'));
    for (const error of result.errors) {
      console.log(chalk.red(`  - ${error}`));
    }
    console.log('');
  }

  for (const simResult of result.results) {
    const status = simResult.passed ? chalk.green('✓ PASSED') : chalk.red('✗ FAILED');
    console.log(chalk.bold(`${simResult.behavior}: ${status}`));
    console.log(chalk.gray(`  Duration: ${simResult.duration.toFixed(2)}ms`));
    console.log('');

    // Preconditions
    if (simResult.preconditions.length > 0) {
      console.log(chalk.bold('  Preconditions:'));
      for (const pre of simResult.preconditions) {
        const preStatus = pre.passed ? chalk.green('✓') : chalk.red('✗');
        console.log(`    ${preStatus} ${pre.expression}`);
        if (!pre.passed && pre.error) {
          console.log(chalk.red(`      Error: ${pre.error}`));
        }
        if (options.verbose && pre.value !== undefined) {
          console.log(chalk.gray(`      Value: ${JSON.stringify(pre.value)}`));
        }
      }
      console.log('');
    }

    // Postconditions
    if (simResult.postconditions.length > 0) {
      console.log(chalk.bold('  Postconditions:'));
      for (const post of simResult.postconditions) {
        const postStatus = post.passed ? chalk.green('✓') : chalk.red('✗');
        console.log(`    ${postStatus} ${post.expression}`);
        if (!post.passed && post.error) {
          console.log(chalk.red(`      Error: ${post.error}`));
        }
        if (options.verbose && post.value !== undefined) {
          console.log(chalk.gray(`      Value: ${JSON.stringify(post.value)}`));
        }
      }
      console.log('');
    }

    // Entity validations
    if (simResult.entityValidations.length > 0) {
      console.log(chalk.bold('  Entity Validations:'));
      for (const validation of simResult.entityValidations) {
        const valStatus = validation.passed ? chalk.green('✓') : chalk.red('✗');
        console.log(`    ${valStatus} ${validation.entity}`);
        if (!validation.passed && validation.errors.length > 0) {
          for (const error of validation.errors) {
            console.log(chalk.red(`      - ${error}`));
          }
        }
      }
      console.log('');
    }
  }

  console.log(chalk.gray(`Total duration: ${result.totalDuration.toFixed(2)}ms`));
  console.log('');
}

export function getSimulateExitCode(result: SimulateResult): number {
  return result.success ? 0 : 1;
}
