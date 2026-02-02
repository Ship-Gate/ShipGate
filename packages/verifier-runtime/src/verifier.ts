// ============================================================================
// Runtime Verifier - Main verification logic
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type {
  Implementation,
  VerifyResult,
  GeneratedInput,
  EvaluationContext,
  CheckResult,
  CoverageInfo,
  TimingInfo,
  VerifyVerdict,
} from './types.js';
import { generateInputs, generateQuickInput } from './inputs.js';
import { createRunner, createEntityStore, type RunnerOptions } from './runner.js';
import {
  checkPreconditions,
  allPreconditionsPassed,
  checkPostconditions,
  determineOutcome,
  checkAllInvariants,
} from './checks/index.js';

/**
 * Options for verification
 */
export interface VerifyOptions {
  /** Runner options */
  runner?: RunnerOptions;
  
  /** Specific inputs to test (if not provided, will generate) */
  inputs?: GeneratedInput[];
  
  /** Only run quick test with single valid input */
  quickTest?: boolean;
  
  /** Skip input generation and use provided input */
  input?: Record<string, unknown>;
  
  /** Continue on failure */
  continueOnFailure?: boolean;
}

/**
 * Verify an implementation against a domain behavior
 */
export async function verify(
  implementation: Implementation,
  domain: AST.Domain,
  behaviorName: string,
  options: VerifyOptions = {}
): Promise<VerifyResult> {
  const timing: TimingInfo = {
    total: 0,
    inputGeneration: 0,
    preconditionCheck: 0,
    execution: 0,
    postconditionCheck: 0,
    invariantCheck: 0,
  };

  const totalStartTime = performance.now();

  // Find the behavior
  const behavior = domain.behaviors.find((b) => b.name.name === behaviorName);
  if (!behavior) {
    throw new Error(`Behavior not found: ${behaviorName}`);
  }

  // Generate or use provided inputs
  const inputStartTime = performance.now();
  let inputs: GeneratedInput[];
  
  if (options.input) {
    inputs = [{
      category: 'valid',
      name: 'provided_input',
      description: 'User-provided input',
      values: options.input,
    }];
  } else if (options.inputs) {
    inputs = options.inputs;
  } else if (options.quickTest) {
    inputs = [generateQuickInput(behavior, domain)];
  } else {
    inputs = generateInputs(behavior, domain);
  }
  timing.inputGeneration = performance.now() - inputStartTime;

  // Use first input for single verification (extend for property-based testing)
  const testInput = inputs[0]!;
  
  // Create runner
  const runner = createRunner(options.runner);
  
  // Get entity store and capture initial state
  const store = implementation.getEntityStore();
  const oldState = store.snapshot();

  // Build evaluation context
  const ctx: EvaluationContext = {
    input: testInput.values,
    store,
    oldState,
    domain,
    now: new Date(),
    variables: new Map(),
  };

  // Check preconditions
  const preconditionStartTime = performance.now();
  const preconditionResults = checkPreconditions(behavior, ctx);
  timing.preconditionCheck = performance.now() - preconditionStartTime;

  // If preconditions fail and we're not testing invalid inputs, stop
  const preconditionsPassed = allPreconditionsPassed(preconditionResults);
  if (!preconditionsPassed && testInput.category !== 'invalid') {
    timing.total = performance.now() - totalStartTime;
    
    return buildResult({
      behaviorName,
      input: testInput,
      preconditions: preconditionResults,
      postconditions: [],
      invariants: [],
      execution: {
        success: false,
        error: {
          code: 'PRECONDITION_FAILED',
          message: 'One or more preconditions failed',
          retriable: false,
        },
        duration: 0,
        logs: [],
      },
      timing,
    });
  }

  // Execute the behavior
  const executionStartTime = performance.now();
  const executionResult = await runner.execute(implementation, testInput.values);
  timing.execution = performance.now() - executionStartTime;

  // Update context with result
  ctx.result = executionResult.result;
  ctx.error = executionResult.error;

  // Determine outcome
  const outcome = determineOutcome(executionResult.result, executionResult.error);

  // Check postconditions
  const postconditionStartTime = performance.now();
  const postconditionResults = checkPostconditions(behavior, ctx, outcome);
  timing.postconditionCheck = performance.now() - postconditionStartTime;

  // Check invariants
  const invariantStartTime = performance.now();
  const invariantResults = checkAllInvariants(behavior, domain, ctx);
  timing.invariantCheck = performance.now() - invariantStartTime;

  timing.total = performance.now() - totalStartTime;

  return buildResult({
    behaviorName,
    input: testInput,
    preconditions: preconditionResults,
    postconditions: postconditionResults,
    invariants: invariantResults,
    execution: executionResult,
    timing,
  });
}

/**
 * Run multiple verification passes with different inputs
 */
export async function verifyAll(
  implementation: Implementation,
  domain: AST.Domain,
  behaviorName: string,
  options: VerifyOptions = {}
): Promise<VerifyResult[]> {
  const behavior = domain.behaviors.find((b) => b.name.name === behaviorName);
  if (!behavior) {
    throw new Error(`Behavior not found: ${behaviorName}`);
  }

  const inputs = options.inputs ?? generateInputs(behavior, domain);
  const results: VerifyResult[] = [];

  for (const input of inputs) {
    const result = await verify(implementation, domain, behaviorName, {
      ...options,
      inputs: [input],
    });
    results.push(result);

    // Stop on first failure unless continueOnFailure is set
    if (!result.success && !options.continueOnFailure) {
      break;
    }
  }

  return results;
}

/**
 * Verify with a specific entity store state
 */
export async function verifyWithState(
  implementation: Implementation,
  domain: AST.Domain,
  behaviorName: string,
  setupState: () => void | Promise<void>,
  options: VerifyOptions = {}
): Promise<VerifyResult> {
  // Setup initial state
  await setupState();
  
  // Run verification
  return verify(implementation, domain, behaviorName, options);
}

// ============================================================================
// RESULT BUILDING
// ============================================================================

interface BuildResultParams {
  behaviorName: string;
  input: GeneratedInput;
  preconditions: CheckResult[];
  postconditions: CheckResult[];
  invariants: CheckResult[];
  execution: import('./types').ExecutionResult;
  timing: TimingInfo;
}

function buildResult(params: BuildResultParams): VerifyResult {
  const {
    behaviorName,
    input,
    preconditions,
    postconditions,
    invariants,
    execution,
    timing,
  } = params;

  // Calculate coverage
  const coverage = calculateCoverage(preconditions, postconditions, invariants);

  // Determine success
  const allPreconditionsPassed = preconditions.every((r) => r.passed);
  const allPostconditionsPassed = postconditions.every((r) => r.passed);
  const allInvariantsPassed = invariants.every((r) => r.passed);
  
  const success = 
    allPreconditionsPassed && 
    execution.success && 
    allPostconditionsPassed && 
    allInvariantsPassed;

  // Calculate score
  const score = calculateScore(
    preconditions,
    postconditions,
    invariants,
    execution.success
  );

  // Determine verdict
  const verdict = determineVerdict(score, success);

  return {
    success,
    verdict,
    score,
    behaviorName,
    inputUsed: input,
    preconditions,
    postconditions,
    invariants,
    execution,
    coverage,
    timing,
  };
}

function calculateCoverage(
  preconditions: CheckResult[],
  postconditions: CheckResult[],
  invariants: CheckResult[]
): CoverageInfo {
  const preconditionCoverage = {
    total: preconditions.length,
    checked: preconditions.length,
    passed: preconditions.filter((r) => r.passed).length,
  };

  const postconditionCoverage = {
    total: postconditions.length,
    checked: postconditions.length,
    passed: postconditions.filter((r) => r.passed).length,
  };

  const invariantCoverage = {
    total: invariants.length,
    checked: invariants.length,
    passed: invariants.filter((r) => r.passed).length,
  };

  const totalChecks = 
    preconditions.length + postconditions.length + invariants.length;
  const totalPassed = 
    preconditionCoverage.passed + 
    postconditionCoverage.passed + 
    invariantCoverage.passed;

  const overall = totalChecks > 0 ? (totalPassed / totalChecks) * 100 : 100;

  return {
    preconditions: preconditionCoverage,
    postconditions: postconditionCoverage,
    invariants: invariantCoverage,
    overall,
  };
}

function calculateScore(
  preconditions: CheckResult[],
  postconditions: CheckResult[],
  invariants: CheckResult[],
  executionSuccess: boolean
): number {
  // Weight different aspects
  const weights = {
    preconditions: 0.2,
    execution: 0.3,
    postconditions: 0.35,
    invariants: 0.15,
  };

  let score = 0;

  // Precondition score
  if (preconditions.length > 0) {
    const preconditionScore = 
      preconditions.filter((r) => r.passed).length / preconditions.length;
    score += preconditionScore * weights.preconditions * 100;
  } else {
    score += weights.preconditions * 100;
  }

  // Execution score
  score += (executionSuccess ? 1 : 0) * weights.execution * 100;

  // Postcondition score
  if (postconditions.length > 0) {
    const postconditionScore = 
      postconditions.filter((r) => r.passed).length / postconditions.length;
    score += postconditionScore * weights.postconditions * 100;
  } else {
    score += weights.postconditions * 100;
  }

  // Invariant score
  if (invariants.length > 0) {
    const invariantScore = 
      invariants.filter((r) => r.passed).length / invariants.length;
    score += invariantScore * weights.invariants * 100;
  } else {
    score += weights.invariants * 100;
  }

  return Math.round(score);
}

function determineVerdict(score: number, success: boolean): VerifyVerdict {
  if (success && score >= 90) {
    return 'verified';
  }
  if (score >= 70) {
    return 'risky';
  }
  return 'unsafe';
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create an evaluation context for manual expression evaluation
 */
export function createEvaluationContext(
  domain: AST.Domain,
  input: Record<string, unknown>,
  result?: unknown
): EvaluationContext {
  const store = createEntityStore();
  
  return {
    input,
    result,
    store,
    domain,
    now: new Date(),
    variables: new Map(),
  };
}

/**
 * Find a behavior by name
 */
export function findBehavior(
  domain: AST.Domain,
  behaviorName: string
): AST.Behavior | undefined {
  return domain.behaviors.find((b) => b.name.name === behaviorName);
}

/**
 * Get all behavior names in a domain
 */
export function getBehaviorNames(domain: AST.Domain): string[] {
  return domain.behaviors.map((b) => b.name.name);
}
