// ============================================================================
// Input Validation Prover - Public API
// ============================================================================

export type {
  ValidationLibrary,
  ConstraintQuality,
  PropertyStatus,
  ValidationEvidence,
  ValidationSchema,
  ValidationField,
  FieldConstraints,
  FieldAccess,
  EndpointInfo,
  InputValidationPropertyProof,
  Finding,
} from './types.js';

export {
  detectZodValidation,
  detectJoiValidation,
  detectYupValidation,
  detectClassValidatorValidation,
  detectManualValidation,
  detectFastifyValidation,
  detectValidation,
} from './detectors.js';

export {
  traceFieldAccesses,
  extractFieldNames,
  findValidationLine,
  isValidationBeforeLogic,
  isValidationInCatchBlock,
} from './field-tracer.js';

export {
  checkCompleteness,
  analyzeConstraintQuality,
  isValidationResultUsed,
  generateFindings,
  calculateCoverage,
  acceptsInput,
  extractValidatedFields,
} from './analyzer.js';

export {
  InputValidationProver,
  proveInputValidation,
  proveInputValidationMultiple,
} from './prover.js';
