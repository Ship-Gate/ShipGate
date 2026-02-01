/**
 * ISL Clarification Engine
 * 
 * Takes open questions + answers and produces an updated AST.
 */

// Types
export type {
  QuestionType,
  AnswerValue,
  DurationValue,
  OpenQuestion,
  AnswerConstraints,
  Answer,
  AppliedClarification,
  UnresolvedQuestion,
  ClarifySpecInput,
  ClarifySpecOutput,
} from './clarifyTypes.js';

export {
  isDurationValue,
  isBooleanAnswer,
  isNumericAnswer,
  VALID_DURATION_UNITS,
} from './clarifyTypes.js';

// Normalization
export {
  normalizeAnswer,
  normalizeAnswers,
  parseBoolean,
  parseDuration,
  parseNumeric,
  validateAnswer,
  type NormalizedAnswer,
  type NormalizationError,
  type NormalizeResult,
} from './normalizeAnswers.js';

// Rules
export {
  applyRule,
  applyRateLimit,
  applySessionExpiry,
  applyAuditLogging,
  applyIdempotency,
  getTargetBehaviors,
  deepCloneDomain,
} from './clarifyRules.js';

// Main function
export {
  clarifySpec,
  createQuestion,
  createAnswer,
  wasApplied,
  isUnresolved,
  appliedCount,
  unresolvedCount,
} from './clarify.js';
