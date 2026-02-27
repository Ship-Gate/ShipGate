/**
 * Assumption Enforcement
 *
 * Runtime guards that turn implicit assumptions into enforced guarantees.
 * Violations throw AssumptionViolationError and fail loudly.
 *
 * @see docs/IMPLICIT_ASSUMPTIONS.md
 * @see docs/RUNTIME_GUARANTEES.md
 */

export {
  AssumptionViolationError,
  AssumptionViolationCode,
  isAssumptionViolationError,
  type AssumptionViolationCodeType,
  type AssumptionViolationContext,
} from './errors.js';

export {
  assertWorkspacePath,
  assertPipelineInput,
  assertValidAst,
  assertWritableOutDir,
  assertSerializableState,
  assertImplementationAccessible,
  assertRequiredPackages,
  assertNoSkippedSteps,
  assertPipelineAssumptions,
} from './guards.js';
