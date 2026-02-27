// ============================================================================
// UI Generator Types
// ============================================================================

import type * as AST from '@isl-lang/isl-core';

export interface GenerateUIOptions {
  /** Domain AST to generate UI from */
  domain: AST.DomainDeclaration;
  /** Base API URL for fetch calls */
  baseUrl?: string;
  /** Whether to include React Router wiring */
  includeRouting?: boolean;
  /** Whether to split output into multiple files */
  splitFiles?: boolean;
}

export interface GeneratedUIFile {
  path: string;
  content: string;
}

export interface EntityUIModel {
  name: string;
  fields: FieldUIModel[];
  displayName: string;
  pluralName: string;
}

export interface FieldUIModel {
  name: string;
  label: string;
  type: FieldInputType;
  tsType: string;
  optional: boolean;
  sensitive: boolean;
  immutable: boolean;
  hidden: boolean;
  validation: ValidationRule[];
}

export type FieldInputType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'checkbox'
  | 'select'
  | 'date'
  | 'datetime'
  | 'uuid'
  | 'textarea';

export interface ValidationRule {
  type: ValidationType;
  value?: number | string | boolean;
  message: string;
  /** Target field name (used for behavior-level rules extracted from preconditions) */
  field?: string;
}

export type ValidationType =
  | 'required'
  | 'minLength'
  | 'maxLength'
  | 'min'
  | 'max'
  | 'pattern'
  | 'email'
  | 'matches'
  | 'custom';

export interface BehaviorUIModel {
  name: string;
  displayName: string;
  httpMethod: string;
  apiPath: string;
  inputFields: FieldUIModel[];
  outputType: string;
  errors: ErrorUIModel[];
  validation: ValidationRule[];
}

export interface ErrorUIModel {
  name: string;
  message: string;
  retriable: boolean;
}

export interface DomainUIModel {
  name: string;
  entities: EntityUIModel[];
  behaviors: BehaviorUIModel[];
  enums: EnumUIModel[];
}

export interface EnumUIModel {
  name: string;
  values: string[];
}
