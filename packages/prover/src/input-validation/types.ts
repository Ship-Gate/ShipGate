// ============================================================================
// Input Validation Prover - Type Definitions
// ============================================================================

export type ValidationLibrary = 
  | 'zod' 
  | 'joi' 
  | 'yup' 
  | 'class-validator' 
  | 'manual' 
  | 'fastify-schema'
  | null;

export type ConstraintQuality = 'strict' | 'basic' | 'minimal' | 'none';

export type PropertyStatus = 'PROVEN' | 'PARTIAL' | 'FAILED';

/**
 * Evidence for a single endpoint's validation
 */
export interface ValidationEvidence {
  route: string;
  file: string;
  line: number;
  method: string;
  hasValidation: boolean;
  validationLibrary: ValidationLibrary;
  validationLine: number | null;
  validatedFields: string[];
  accessedFields: string[];
  unvalidatedFields: string[];  // accessed but not validated
  validationBeforeLogic: boolean;
  constraintQuality: ConstraintQuality;
}

/**
 * Details about a validation schema
 */
export interface ValidationSchema {
  library: ValidationLibrary;
  line: number;
  fields: ValidationField[];
  isUsed: boolean; // Result of validation is actually used
}

/**
 * Field in a validation schema
 */
export interface ValidationField {
  name: string;
  type: string | null;
  constraints: FieldConstraints;
}

/**
 * Constraints on a field
 */
export interface FieldConstraints {
  required: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  enum?: string[];
  format?: string; // email, url, uuid, etc.
  nested?: ValidationField[];
}

/**
 * Field access in handler code
 */
export interface FieldAccess {
  field: string;
  line: number;
  accessType: 'read' | 'write';
  source: 'body' | 'params' | 'query' | 'headers';
}

/**
 * Endpoint information
 */
export interface EndpointInfo {
  route: string;
  method: string;
  file: string;
  line: number;
  handlerStart: number;
  handlerEnd: number;
  acceptsInput: boolean;
  inputSources: Array<'body' | 'params' | 'query' | 'headers'>;
}

/**
 * Property proof for input validation
 */
export interface InputValidationPropertyProof {
  property: 'input-validation';
  status: PropertyStatus;
  summary: string;
  evidence: ValidationEvidence[];
  findings: Finding[];
  method: 'static-ast-analysis';
  confidence: 'high' | 'medium' | 'low';
  duration_ms: number;
  stats: {
    totalEndpoints: number;
    validatedEndpoints: number;
    partiallyValidatedEndpoints: number;
    unvalidatedEndpoints: number;
    endpointsWithStrictValidation: number;
  };
}

/**
 * Finding from validation analysis
 */
export interface Finding {
  file: string;
  line: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
  route?: string;
}
