// ============================================================================
// Scenario Runner - Execute ISL behaviors with generated inputs
// ============================================================================
//
// Orchestrates the full PBT loop:
//   1. Extract properties (preconditions, postconditions, invariants) from
//      an ISL behavior.
//   2. Generate inputs using ISL-type-aware generators.
//   3. Execute the behavior implementation.
//   4. Check postconditions and invariants.
//   5. On failure, shrink using ISL-type-aware strategies to a minimal
//      reproduction.
//   6. Produce a ScenarioResult with ISL-element attribution (not just a
//      "random seed: 123").
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type {
  PBTConfig,
  BehaviorProperties,
  Property,
  LogCapture,
  Generator as IGenerator,
  PRNG,
} from './types.js';
import { DEFAULT_PBT_CONFIG } from './types.js';
import { createPRNG } from './random.js';
import { createInputGenerator } from './generator.js';
import { extractProperties, expressionToString } from './property.js';
import { typeShrink } from './type-shrinker.js';
import {
  evaluatePostcondition as evalPost,
  evaluateInvariant as evalInv,
  type EvalContext,
} from './postcondition-evaluator.js';
import type { BehaviorImplementation, ExecutionResult } from './runner.js';
import { formatFailure, type FailureReport } from './failure-formatter.js';

// ============================================================================
// PUBLIC TYPES
// ============================================================================

/**
 * Attribution to a specific ISL element that caused the failure.
 */
export interface ISLAttribution {
  /** The kind of ISL element (postcondition, invariant, precondition) */
  elementKind: 'postcondition' | 'invariant' | 'precondition' | 'input_type';
  /** Human-readable expression string */
  expression: string;
  /** Source location in the .isl file */
  location: AST.SourceLocation;
  /** Guard condition (e.g., "success", "INVALID_CREDENTIALS") */
  guard?: string;
  /** The full Property object */
  property?: Property;
}

/**
 * Result of a single scenario iteration.
 */
export interface ScenarioIteration {
  iteration: number;
  size: number;
  seed: number;
  input: Record<string, unknown>;
  output?: ExecutionResult;
  passed: boolean;
  error?: string;
  attribution?: ISLAttribution;
  duration: number;
  logs: LogCapture[];
}

/**
 * Minimal counterexample after shrinking.
 */
export interface MinimalCounterexample {
  input: Record<string, unknown>;
  attribution: ISLAttribution;
  shrinkSteps: number;
  originalInput: Record<string, unknown>;
}

/**
 * Full result of a scenario run.
 */
export interface ScenarioResult {
  behaviorName: string;
  domainName: string;
  success: boolean;
  iterations: number;
  passed: number;
  failed: number;
  filtered: number;
  seed: number;
  firstFailure?: ScenarioIteration;
  counterexample?: MinimalCounterexample;
  duration: number;
  config: PBTConfig;
  /** Human-friendly formatted report */
  formattedReport: string;
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Run a PBT scenario for a specific behavior in an ISL domain.
 *
 * This is the primary entry point. It generates inputs from the ISL type
 * definitions, runs the behavior implementation, checks postconditions and
 * invariants, and on failure shrinks to a minimal reproduction with ISL
 * element attribution.
 */
export async function runScenario(
  domain: AST.Domain,
  behaviorName: string,
  implementation: BehaviorImplementation,
  config: Partial<PBTConfig> = {},
): Promise<ScenarioResult> {
  const startTime = Date.now();
  const fullConfig: PBTConfig = { ...DEFAULT_PBT_CONFIG, ...config };
  const seed = fullConfig.seed ?? Date.now();
  fullConfig.seed = seed;

  // Find behavior
  const behavior = domain.behaviors.find((b) => b.name.name === behaviorName);
  if (!behavior) {
    throw new Error(`Behavior '${behaviorName}' not found in domain '${domain.name.name}'`);
  }

  // Extract properties
  const properties = extractProperties(behavior, domain);

  // Create input generator
  const inputGen = createInputGenerator(properties, fullConfig);

  // Initialize PRNG
  const prng = createPRNG(seed);

  // Run iterations
  let firstFailure: ScenarioIteration | undefined;
  let passed = 0;
  let failed = 0;
  let filtered = 0;
  let iterationsRun = 0;

  for (let i = 0; i < fullConfig.numTests; i++) {
    const size = computeSize(i, fullConfig);

    // Generate input
    let input: Record<string, unknown>;
    try {
      input = inputGen.generate(prng.fork(), size);
    } catch {
      filtered++;
      continue;
    }

    iterationsRun++;

    const iteration = await executeIteration(
      i, size, prng.seed(), input, implementation, properties, fullConfig,
    );

    if (iteration.passed) {
      passed++;
    } else {
      failed++;
      if (!firstFailure) {
        firstFailure = iteration;
        // Stop early on first failure (unless verbose)
        if (!fullConfig.verbose) break;
      }
    }
  }

  // Shrink on failure
  let counterexample: MinimalCounterexample | undefined;
  if (firstFailure && firstFailure.attribution) {
    counterexample = await shrinkToMinimal(
      firstFailure,
      properties,
      implementation,
      fullConfig,
      domain,
    );
  }

  const result: ScenarioResult = {
    behaviorName,
    domainName: domain.name.name,
    success: !firstFailure,
    iterations: iterationsRun,
    passed,
    failed,
    filtered,
    seed,
    firstFailure,
    counterexample,
    duration: Date.now() - startTime,
    config: fullConfig,
    formattedReport: '', // will be filled below
  };

  result.formattedReport = formatScenarioResult(result);
  return result;
}

// ============================================================================
// ITERATION EXECUTION
// ============================================================================

async function executeIteration(
  index: number,
  size: number,
  seed: number,
  input: Record<string, unknown>,
  implementation: BehaviorImplementation,
  properties: BehaviorProperties,
  config: PBTConfig,
): Promise<ScenarioIteration> {
  const startTime = Date.now();
  const logs: LogCapture[] = [];

  const origConsole = captureConsole(logs);

  try {
    const output = await Promise.race([
      implementation.execute(input),
      rejectAfter(config.timeout),
    ]);

    const evalCtx: EvalContext = { input, result: output, logs };

    // Check postconditions
    for (const post of properties.postconditions) {
      const evalResult = evalPost(post, evalCtx);
      if (!evalResult.passed) {
        return {
          iteration: index,
          size,
          seed,
          input,
          output,
          passed: false,
          error: evalResult.reason,
          attribution: attributionFrom(post),
          duration: Date.now() - startTime,
          logs,
        };
      }
    }

    // Check invariants
    for (const inv of properties.invariants) {
      const evalResult = evalInv(inv, evalCtx);
      if (!evalResult.passed) {
        return {
          iteration: index,
          size,
          seed,
          input,
          output,
          passed: false,
          error: evalResult.reason,
          attribution: attributionFrom(inv),
          duration: Date.now() - startTime,
          logs,
        };
      }
    }

    return {
      iteration: index,
      size,
      seed,
      input,
      output,
      passed: true,
      duration: Date.now() - startTime,
      logs,
    };
  } catch (err) {
    return {
      iteration: index,
      size,
      seed,
      input,
      passed: false,
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - startTime,
      logs,
    };
  } finally {
    restoreConsole(origConsole);
  }
}

// ============================================================================
// ISL-TYPE-AWARE SHRINKING
// ============================================================================

async function shrinkToMinimal(
  failure: ScenarioIteration,
  properties: BehaviorProperties,
  implementation: BehaviorImplementation,
  config: PBTConfig,
  domain: AST.Domain,
): Promise<MinimalCounterexample> {
  const { maxShrinks } = config;
  let current = failure.input;
  let steps = 0;
  const originalInput = { ...failure.input };

  // Build a map of field name → ISL type for type-aware shrinking
  const fieldTypes = new Map<string, AST.TypeDefinition>();
  for (const spec of properties.inputSpec) {
    fieldTypes.set(spec.name, spec.type);
  }

  for (let attempt = 0; attempt < maxShrinks; attempt++) {
    const candidates = generateTypedCandidates(current, fieldTypes, domain);
    let foundSmaller = false;

    for (const candidate of candidates) {
      steps++;
      if (steps > maxShrinks) break;

      try {
        const iter = await executeIteration(
          -1, 0, 0, candidate, implementation, properties, config,
        );
        if (!iter.passed) {
          current = candidate;
          foundSmaller = true;
          break;
        }
      } catch {
        current = candidate;
        foundSmaller = true;
        break;
      }
    }

    if (!foundSmaller || steps > maxShrinks) break;
  }

  return {
    input: current,
    attribution: failure.attribution!,
    shrinkSteps: steps,
    originalInput,
  };
}

/**
 * Generate shrink candidates for each field using its ISL type definition.
 */
function* generateTypedCandidates(
  input: Record<string, unknown>,
  fieldTypes: Map<string, AST.TypeDefinition>,
  domain: AST.Domain,
): Iterable<Record<string, unknown>> {
  for (const [fieldName, fieldValue] of Object.entries(input)) {
    if (fieldValue === undefined || fieldValue === null) continue;

    const typeDef = fieldTypes.get(fieldName);
    if (typeDef) {
      // Type-aware shrinking
      for (const shrunk of typeShrink(fieldValue, typeDef, domain)) {
        yield { ...input, [fieldName]: shrunk };
      }
    } else {
      // Fallback: generic shrinking
      for (const shrunk of genericShrink(fieldValue)) {
        yield { ...input, [fieldName]: shrunk };
      }
    }
  }
}

function* genericShrink(value: unknown): Iterable<unknown> {
  if (typeof value === 'string' && value.length > 0) {
    yield '';
    if (value.length > 1) yield value.slice(0, Math.ceil(value.length / 2));
  } else if (typeof value === 'number' && value !== 0) {
    yield 0;
    if (Math.abs(value) > 1) yield Math.trunc(value / 2);
  } else if (typeof value === 'boolean' && value) {
    yield false;
  }
}

// ============================================================================
// FORMATTING
// ============================================================================

function formatScenarioResult(result: ScenarioResult): string {
  const lines: string[] = [];

  lines.push(`\n╔══════════════════════════════════════════════════╗`);
  lines.push(`║  PBT Scenario: ${result.behaviorName}`);
  lines.push(`║  Domain: ${result.domainName}`);
  lines.push(`╚══════════════════════════════════════════════════╝\n`);

  if (result.success) {
    lines.push(`  ✓ All ${result.iterations} iterations passed (${result.duration}ms)`);
    lines.push(`    Seed: ${result.seed}  |  Filtered: ${result.filtered}`);
  } else {
    lines.push(`  ✗ FAILED after ${result.passed}/${result.iterations} iterations`);
    lines.push(`    Seed: ${result.seed}  |  Duration: ${result.duration}ms`);

    if (result.firstFailure) {
      lines.push('');
      lines.push('  ── First Failure ──');
      lines.push(`    Iteration: ${result.firstFailure.iteration}`);
      lines.push(`    Error: ${result.firstFailure.error}`);

      if (result.firstFailure.attribution) {
        const attr = result.firstFailure.attribution;
        lines.push('');
        lines.push('  ── Responsible ISL Element ──');
        lines.push(`    Kind: ${attr.elementKind}`);
        lines.push(`    Expression: ${attr.expression}`);
        lines.push(`    Location: ${attr.location.file}:${attr.location.line}:${attr.location.column}`);
        if (attr.guard) {
          lines.push(`    Guard: ${attr.guard}`);
        }
      }

      lines.push('');
      lines.push('  ── Original Input ──');
      lines.push(formatObject(result.firstFailure.input, '    '));
    }

    if (result.counterexample) {
      lines.push('');
      lines.push(`  ── Minimal Counterexample (${result.counterexample.shrinkSteps} shrink steps) ──`);
      lines.push(formatObject(result.counterexample.input, '    '));

      lines.push('');
      lines.push('  ── Reproduction ──');
      lines.push(`    Run with --seed ${result.seed} to reproduce`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function formatObject(obj: Record<string, unknown>, indent: string): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    const valueStr = typeof value === 'string'
      ? `"${value.length > 60 ? value.slice(0, 60) + '...' : value}"`
      : JSON.stringify(value);
    lines.push(`${indent}${key}: ${valueStr}`);
  }
  return lines.join('\n');
}

// ============================================================================
// UTILITIES
// ============================================================================

function attributionFrom(property: Property): ISLAttribution {
  return {
    elementKind: property.type,
    expression: property.name,
    location: property.location,
    guard: property.guard,
    property,
  };
}

function computeSize(iteration: number, config: PBTConfig): number {
  if (config.sizeGrowth === 'logarithmic') {
    return Math.min(config.maxSize, Math.floor(Math.log2(iteration + 2) * 10));
  }
  return Math.min(config.maxSize, Math.floor((iteration / config.numTests) * config.maxSize));
}

function rejectAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });
}

interface ConsoleState {
  log: typeof console.log;
  info: typeof console.info;
  warn: typeof console.warn;
  error: typeof console.error;
}

function captureConsole(logs: LogCapture[]): ConsoleState {
  const original: ConsoleState = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  const capture = (level: LogCapture['level']) => (...args: unknown[]) => {
    logs.push({
      level,
      message: args.map(String).join(' '),
      args,
      timestamp: Date.now(),
    });
  };

  console.log = capture('log');
  console.info = capture('info');
  console.warn = capture('warn');
  console.error = capture('error');

  return original;
}

function restoreConsole(original: ConsoleState): void {
  console.log = original.log;
  console.info = original.info;
  console.warn = original.warn;
  console.error = original.error;
}
