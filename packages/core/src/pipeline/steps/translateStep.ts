/**
 * Translation Step
 *
 * Translates natural language prompts to ISL AST, or validates provided AST.
 * This is a stub implementation - actual translation requires LLM integration.
 */

import type { Domain } from '@isl-lang/parser';
import type { TranslateStepResult, PipelineState } from '../pipelineTypes.js';

/**
 * Run the translation step
 *
 * If the input is an AST, it passes through directly.
 * If the input is a prompt, this stub returns an error since LLM translation
 * is not implemented in this module.
 *
 * @param state - Current pipeline state
 * @returns Translation step result
 */
export async function runTranslateStep(state: PipelineState): Promise<TranslateStepResult> {
  const startTime = performance.now();
  const warnings: string[] = [];

  try {
    if (state.input.mode === 'ast') {
      // AST provided directly - pass through
      return {
        stepName: 'translate',
        success: true,
        data: state.input.ast,
        wasProvided: true,
        durationMs: performance.now() - startTime,
        warnings,
      };
    }

    // Prompt mode - translation not implemented in this module
    // Real implementation would call the translator service
    warnings.push(
      'Prompt translation requires LLM integration. ' +
        'Use the @isl-lang/translator package or provide a pre-parsed AST.'
    );

    return {
      stepName: 'translate',
      success: false,
      error:
        'Prompt translation not implemented in core pipeline. ' +
        'Provide a parsed AST instead, or use the full translator module.',
      wasProvided: false,
      durationMs: performance.now() - startTime,
      warnings,
    };
  } catch (error) {
    return {
      stepName: 'translate',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      wasProvided: false,
      durationMs: performance.now() - startTime,
      warnings,
    };
  }
}

/**
 * Validate that an object looks like a valid ISL Domain AST
 *
 * @param ast - The object to validate
 * @returns Whether the object appears to be a valid Domain AST
 */
export function isValidDomainAst(ast: unknown): ast is Domain {
  if (!ast || typeof ast !== 'object') return false;

  const domain = ast as Partial<Domain>;

  // Check required Domain properties
  if (domain.kind !== 'Domain') return false;
  if (!domain.name || typeof domain.name !== 'object') return false;
  if (!domain.version || typeof domain.version !== 'object') return false;

  // Check that arrays are present (can be empty)
  if (!Array.isArray(domain.imports)) return false;
  if (!Array.isArray(domain.types)) return false;
  if (!Array.isArray(domain.entities)) return false;
  if (!Array.isArray(domain.behaviors)) return false;

  return true;
}
