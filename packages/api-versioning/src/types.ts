/**
 * API Versioning Types
 */

// ============================================================================
// Domain Types (simplified ISL representation)
// ============================================================================

export interface Domain {
  name: string;
  version: string;
  entities: Entity[];
  behaviors: Behavior[];
  types: TypeDeclaration[];
}

export interface Entity {
  name: string;
  fields: Field[];
}

export interface Field {
  name: string;
  type: string;
  optional?: boolean;
  constraints?: Constraint[];
}

export interface Behavior {
  name: string;
  input: Field[];
  output?: OutputDef;
  errors?: ErrorDef[];
  preconditions?: string[];
  postconditions?: string[];
}

export interface OutputDef {
  type: string;
  fields?: Field[];
}

export interface ErrorDef {
  name: string;
  message?: string;
}

export interface TypeDeclaration {
  name: string;
  baseType: string;
  constraints?: Constraint[];
}

export interface Constraint {
  name: string;
  value: unknown;
}

// ============================================================================
// Diff Types
// ============================================================================

export interface DomainDiff {
  from: string;
  to: string;
  breaking: Change[];
  nonBreaking: Change[];
  compatible: boolean;
}

export type ChangeType =
  | 'field_added'
  | 'field_removed'
  | 'field_renamed'
  | 'field_type_changed'
  | 'field_required_changed'
  | 'type_changed'
  | 'type_added'
  | 'type_removed'
  | 'constraint_added'
  | 'constraint_removed'
  | 'constraint_changed'
  | 'behavior_added'
  | 'behavior_removed'
  | 'behavior_renamed'
  | 'error_added'
  | 'error_removed'
  | 'precondition_added'
  | 'precondition_removed'
  | 'postcondition_added'
  | 'postcondition_removed'
  | 'entity_added'
  | 'entity_removed';

export type ChangeSeverity = 'high' | 'medium' | 'low';

export interface Change {
  type: ChangeType;
  path: string;
  description: string;
  severity?: ChangeSeverity;
  from?: unknown;
  to?: unknown;
  affectedEndpoints?: string[];
  migration?: string;
}

// ============================================================================
// Versioning Strategy Types
// ============================================================================

export type VersionStrategy = 'url' | 'header' | 'query';

export interface VersionConfig {
  strategy: VersionStrategy;
  versions: Record<string, string>;
  default: string;
  sunset?: Record<string, Date>;
  transformers?: Record<string, VersionTransformer>;
}

export interface UrlStrategyConfig extends VersionConfig {
  strategy: 'url';
  prefix?: string;
}

export interface HeaderStrategyConfig extends VersionConfig {
  strategy: 'header';
  header?: string;
  mediaType?: string;
}

export interface QueryStrategyConfig extends VersionConfig {
  strategy: 'query';
  param?: string;
}

export type StrategyConfig = UrlStrategyConfig | HeaderStrategyConfig | QueryStrategyConfig;

// ============================================================================
// Transformer Types
// ============================================================================

export interface VersionTransformer {
  request?: RequestTransformer;
  response?: ResponseTransformer;
}

export type RequestTransformer = (req: TransformableRequest) => TransformableRequest;
export type ResponseTransformer = (res: TransformableResponse) => TransformableResponse;

export interface TransformableRequest {
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface TransformableResponse {
  body?: Record<string, unknown>;
  status?: number;
  headers?: Record<string, string>;
}

// ============================================================================
// Middleware Types
// ============================================================================

export interface VersioningMiddlewareConfig {
  strategy: VersionStrategy;
  header?: string;
  param?: string;
  prefix?: string;
  versions: Record<string, string>;
  default: string;
  sunset?: Record<string, Date>;
  transformers?: Record<string, VersionTransformer>;
  deprecationUrl?: string;
}

export interface VersionContext {
  version: string;
  domain: string;
  isSunset: boolean;
  sunsetDate?: Date;
}

// ============================================================================
// Compatibility Report Types
// ============================================================================

export interface CompatibilityReport {
  from: string;
  to: string;
  summary: ReportSummary;
  breakingChanges: ReportChange[];
  nonBreakingChanges: ReportChange[];
  migrationPath: MigrationStep[];
  markdown: string;
}

export interface ReportSummary {
  breakingCount: number;
  nonBreakingCount: number;
  isBackwardCompatible: boolean;
}

export interface ReportChange {
  title: string;
  severity: ChangeSeverity;
  description: string;
  affectedEndpoints: string[];
  migration?: string;
}

export interface MigrationStep {
  order: number;
  description: string;
  details?: string;
}

// ============================================================================
// Generated Transformer Types
// ============================================================================

export interface GeneratedTransformers {
  request: string;
  response: string;
  requestFn: RequestTransformer;
  responseFn: ResponseTransformer;
}
