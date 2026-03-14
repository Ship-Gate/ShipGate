/**
 * @isl-lang/spec-generator
 *
 * Prompt → ISL spec generator for the ShipGate no-code app builder engine.
 *
 * @example
 * ```ts
 * import { generateSpec } from '@isl-lang/spec-generator';
 *
 * const result = await generateSpec(
 *   'Build a SaaS project management tool with teams, projects, tasks, and Stripe billing',
 *   { template: 'saas', provider: 'anthropic' }
 * );
 * if (result.success) {
 *   console.log(result.spec.rawISL);
 * }
 * ```
 */

export { generateSpec, refineSpec } from './generator.js';
export { parseGeneratedISL } from './parser.js';
export { buildGenerationPrompt, buildRefinementPrompt, buildValidationRepairPrompt } from './prompts.js';
export type {
  AppTemplate,
  LLMProvider,
  SpecGeneratorOptions,
  SpecGenerationResult,
  SpecRefinementOptions,
  SpecRefinementResult,
  GeneratedSpec,
  EntitySpec,
  BehaviorSpec,
  EntityField,
  ErrorCase,
} from './types.js';
