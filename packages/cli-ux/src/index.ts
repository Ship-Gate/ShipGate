/**
 * @isl-lang/cli-ux
 *
 * CLI UX components for ISL verification output.
 *
 * Features:
 * - Pretty renderer with summary banner, failures, fixes, and repro commands
 * - JSON mode with stable, schema-validated output
 * - Verification table output with TRUE/FALSE/UNKNOWN verdicts
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
 *
 * // Verification table output
 * import { renderVerify, printVerifyJson, getVerifyExitCode } from '@isl-lang/cli-ux';
 * const tableOutput = renderVerify(verifyResult);
 * process.exit(getVerifyExitCode(verifyResult));
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

// ─────────────────────────────────────────────────────────────────────────────
// Verification Table Types (isl verify command)
// ─────────────────────────────────────────────────────────────────────────────

export type {
  ClauseVerdict,
  OverallVerdict,
  VerifyClauseType,
  TraceSliceRef,
  AdapterSnapshotRef,
  NoEvidenceRef,
  EvidenceRef,
  UnknownReason,
  SourceLocation,
  VerifyClauseResult,
  VerifySummary,
  VerifyResult,
  VerifyJsonOutput,
  VerifyRenderOptions,
} from './verify-types.js';

export { DEFAULT_VERIFY_RENDER_OPTIONS } from './verify-types.js';

// Verification Table Renderer
export {
  renderVerify,
  printVerify,
  renderVerifyHeader,
  renderVerifyTable,
  renderVerifyDetails,
  renderVerifySummary,
  getVerifyExitCode,
} from './verify-renderer.js';

// Verification JSON
export type {
  VerifyJsonOptions,
  VerifyJsonFormatResult,
  VerifyJsonParseResult,
  VerifyKeyMetrics,
} from './verify-json.js';

export {
  formatVerifyJson,
  printVerifyJson,
  parseVerifyJson,
  createVerifyJsonOutput,
  getVerifyKeyMetrics,
  createMinimalVerifyJson,
} from './verify-json.js';

// Verification Schema
export {
  validateVerifyJsonOutput,
  validateVerifyResult,
  formatVerifyValidationErrors,
  VerifyJsonOutputSchema,
  VerifyResultSchema,
  VerifyClauseResultSchema,
  VerifySummarySchema,
  EvidenceRefSchema,
  ClauseVerdictSchema,
  OverallVerdictSchema,
} from './verify-schema.js';

export type {
  VerifyValidationResult,
  ClauseVerdictSchemaType,
  OverallVerdictSchemaType,
  EvidenceRefSchemaType,
  VerifyClauseResultSchemaType,
  VerifySummarySchemaType,
  VerifyResultSchemaType,
  VerifyJsonOutputSchemaType,
} from './verify-schema.js';
