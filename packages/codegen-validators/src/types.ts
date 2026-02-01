// ============================================================================
// Validator Generator Types
// ============================================================================

export type ValidatorLibrary = 'zod' | 'yup' | 'joi' | 'ajv' | 'valibot';

export interface GenerateOptions {
  /** Target validation library */
  library: ValidatorLibrary;
  /** Generate strict or coerce mode */
  strict?: boolean;
  /** Include custom error messages */
  includeMessages?: boolean;
  /** Include transform/preprocess functions */
  includeTransforms?: boolean;
  /** Generate branded types (Zod only) */
  brandedTypes?: boolean;
  /** Export format */
  exportStyle?: 'named' | 'default' | 'barrel';
  /** Split into multiple files */
  splitFiles?: boolean;
}

export interface GeneratedFile {
  path: string;
  content: string;
  exports: string[];
}

export interface ValidatorDefinition {
  name: string;
  schemaCode: string;
  typeCode?: string;
  description?: string;
}

export interface ConstraintMapping {
  islConstraint: string;
  validatorMethod: string;
  args?: unknown[];
}
