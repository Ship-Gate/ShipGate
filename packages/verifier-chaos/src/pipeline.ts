/**
 * Pipeline Step Integration
 *
 * Integrates the chaos engine with the ISL core pipeline so that
 * `runPipeline()` can include a chaos-verification step.
 *
 * The step follows the same StepResult<T> pattern used by the other
 * pipeline steps (validate, generate, verify, score).
 */

import type { DomainDeclaration } from '@isl-lang/isl-core';
import { ChaosEngine, type EngineConfig, type EngineResult } from './engine.js';
import type { BehaviorImplementation } from './executor.js';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface ChaosStepInput {
  /** The parsed domain AST. */
  domain: DomainDeclaration;
  /** The implementation to verify against. */
  implementation: BehaviorImplementation;
  /** Optional: restrict to a single behavior. */
  behaviorName?: string;
  /** Engine configuration overrides. */
  engineConfig?: EngineConfig;
}

export interface ChaosStepResult {
  stepName: 'chaos';
  success: boolean;
  data: EngineResult | null;
  durationMs: number;
  warnings: string[];
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  Step runner                                                       */
/* ------------------------------------------------------------------ */

/**
 * Run the chaos-verification pipeline step.
 *
 * ```ts
 * const result = await runChaosStep({
 *   domain,
 *   implementation,
 *   behaviorName: 'CreateOrder',
 * });
 * ```
 */
export async function runChaosStep(
  input: ChaosStepInput,
): Promise<ChaosStepResult> {
  const startTime = performance.now();
  const warnings: string[] = [];

  try {
    const engine = new ChaosEngine(input.engineConfig);
    const result = await engine.run(
      input.domain,
      input.implementation,
      input.behaviorName,
    );

    // Collect warnings
    if (result.report.summary.skipped > 0) {
      warnings.push(
        `${result.report.summary.skipped} chaos scenario(s) were skipped`,
      );
    }
    if (result.report.coverage.overallCoverage < 50) {
      warnings.push(
        `Chaos coverage is low (${result.report.coverage.overallCoverage}%)`,
      );
    }

    return {
      stepName: 'chaos',
      success: result.success,
      data: result,
      durationMs: performance.now() - startTime,
      warnings,
    };
  } catch (error) {
    return {
      stepName: 'chaos',
      success: false,
      data: null,
      durationMs: performance.now() - startTime,
      warnings,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create a reusable chaos pipeline step function.
 *
 * Useful when you want to pre-configure the engine and bind it
 * to a pipeline runner.
 */
export function createChaosStep(
  defaultConfig?: EngineConfig,
): (input: Omit<ChaosStepInput, 'engineConfig'>) => Promise<ChaosStepResult> {
  return (input) =>
    runChaosStep({
      ...input,
      engineConfig: defaultConfig,
    });
}
