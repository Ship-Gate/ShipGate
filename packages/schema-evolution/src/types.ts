/**
 * Schema Evolution Types
 */

export interface SchemaVersion {
  version: string;
  hash: string;
  schema: ISLSchema;
  createdAt: string;
  author?: string;
  message?: string;
  parentVersion?: string;
}

export interface ISLSchema {
  domains: DomainSchema[];
  types: TypeSchema[];
  imports?: string[];
}

export interface DomainSchema {
  name: string;
  entities: EntitySchema[];
  behaviors: BehaviorSchema[];
  enums: EnumSchema[];
}

export interface EntitySchema {
  name: string;
  fields: FieldSchema[];
  invariants: string[];
}

export interface FieldSchema {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: unknown;
  constraints: ConstraintSchema[];
  annotations: string[];
}

export interface ConstraintSchema {
  type: string;
  value: unknown;
}

export interface BehaviorSchema {
  name: string;
  input: FieldSchema[];
  output: FieldSchema[];
  errors: ErrorSchema[];
  preconditions: string[];
  postconditions: string[];
}

export interface ErrorSchema {
  code: string;
  message: string;
  fields: FieldSchema[];
}

export interface EnumSchema {
  name: string;
  values: string[];
}

export interface TypeSchema {
  name: string;
  baseType: string;
  constraints: ConstraintSchema[];
}

export interface SchemaChange {
  id: string;
  type: ChangeType;
  path: string;
  breaking: boolean;
  description: string;
  oldValue?: unknown;
  newValue?: unknown;
  migration?: MigrationStep;
}

export type ChangeType =
  | 'DOMAIN_ADDED'
  | 'DOMAIN_REMOVED'
  | 'DOMAIN_RENAMED'
  | 'ENTITY_ADDED'
  | 'ENTITY_REMOVED'
  | 'ENTITY_RENAMED'
  | 'FIELD_ADDED'
  | 'FIELD_REMOVED'
  | 'FIELD_RENAMED'
  | 'FIELD_TYPE_CHANGED'
  | 'FIELD_REQUIRED_CHANGED'
  | 'FIELD_DEFAULT_CHANGED'
  | 'CONSTRAINT_ADDED'
  | 'CONSTRAINT_REMOVED'
  | 'CONSTRAINT_MODIFIED'
  | 'BEHAVIOR_ADDED'
  | 'BEHAVIOR_REMOVED'
  | 'BEHAVIOR_RENAMED'
  | 'INPUT_CHANGED'
  | 'OUTPUT_CHANGED'
  | 'ERROR_ADDED'
  | 'ERROR_REMOVED'
  | 'PRECONDITION_ADDED'
  | 'PRECONDITION_REMOVED'
  | 'POSTCONDITION_ADDED'
  | 'POSTCONDITION_REMOVED'
  | 'INVARIANT_ADDED'
  | 'INVARIANT_REMOVED'
  | 'ENUM_ADDED'
  | 'ENUM_REMOVED'
  | 'ENUM_VALUE_ADDED'
  | 'ENUM_VALUE_REMOVED'
  | 'TYPE_ADDED'
  | 'TYPE_REMOVED'
  | 'TYPE_MODIFIED';

export interface MigrationStep {
  type: MigrationStepType;
  source?: string;
  target?: string;
  transform?: string;
  defaultValue?: unknown;
  condition?: string;
}

export type MigrationStepType =
  | 'COPY'
  | 'RENAME'
  | 'TRANSFORM'
  | 'SET_DEFAULT'
  | 'DROP'
  | 'CREATE'
  | 'CUSTOM';

export interface MigrationPlan {
  fromVersion: string;
  toVersion: string;
  changes: SchemaChange[];
  steps: MigrationStep[];
  isBreaking: boolean;
  suggestedVersion: string;
  warnings: MigrationWarning[];
}

export interface MigrationWarning {
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  change?: SchemaChange;
  suggestion?: string;
}

export interface CompatibilityReport {
  compatible: boolean;
  forwardCompatible: boolean;
  backwardCompatible: boolean;
  breakingChanges: SchemaChange[];
  nonBreakingChanges: SchemaChange[];
  recommendations: string[];
}

export interface EvolutionPolicy {
  allowBreakingChanges: boolean;
  requireMigrationPlan: boolean;
  maxDeprecationPeriod?: number;
  requiredReviewers?: number;
  allowedChangeTypes?: ChangeType[];
  prohibitedChangeTypes?: ChangeType[];
}

export interface VersionHistory {
  versions: SchemaVersion[];
  currentVersion: string;
  deprecatedVersions: string[];
  supportedVersions: string[];
}

export interface DataMigrator {
  version: string;
  up: (data: unknown) => unknown;
  down: (data: unknown) => unknown;
  validate?: (data: unknown) => boolean;
}
