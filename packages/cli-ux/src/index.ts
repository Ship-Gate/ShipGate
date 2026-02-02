/**
 * @isl-lang/cli-ux
 *
 * CLI UX components for ISL verification output.
 *
 * Features:
 * - Pretty renderer with summary banner, failures, fixes, and repro commands
 * - JSON mode with stable, schema-validated output
 *
 * @example
 * ```typescript
 * import { render, formatJson, validateJsonOutput } from '@isl-lang/cli-ux';
 *
 * // Pretty output
 * const prettyOutput = render(verificationResult, { colors: true });
 * console.log(prettyOutput);
 *
 * // JSON output
 * const jsonResult = formatJson(verificationResult);
 * if (jsonResult.valid) {
 *   console.log(jsonResult.output);
 * }
 * ```
 */

// Types
export type {
  ClauseStatus,
  ImpactLevel,
  ClauseCategory,
  Recommendation,
  ClauseResult,
  CategoryScore,
  CategoryBreakdown,
  VerificationResult,
  RenderOptions,
  JsonOutput,
  GroupedFailures,
  ReproCommand,
} from './types.js';

export { DEFAULT_RENDER_OPTIONS } from './types.js';

// Renderer
export {
  render,
  print,
  renderBanner,
  renderFailures,
  renderHowToFix,
  renderReproCommands,
  renderBreakdown,
  groupFailures,
  generateReproCommands,
} from './renderer.js';

// JSON
export type { JsonOutputOptions, JsonFormatResult, JsonParseResult, KeyMetrics } from './json.js';

export {
  formatJson,
  printJson,
  parseJson,
  createJsonOutput,
  getDecision,
  getKeyMetrics,
  createMinimalJson,
} from './json.js';

// Schema validation
export {
  validateJsonOutput,
  validateVerificationResult,
  formatValidationErrors,
  JsonOutputSchema,
  VerificationResultSchema,
  ClauseResultSchema,
  CategoryScoreSchema,
  CategoryBreakdownSchema,
} from './schema.js';

export type {
  ValidationResult,
  ClauseResultSchemaType,
  CategoryScoreSchemaType,
  CategoryBreakdownSchemaType,
  VerificationResultSchemaType,
  JsonOutputSchemaType,
} from './schema.js';
