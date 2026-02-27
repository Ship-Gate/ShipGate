// ============================================================================
// AST Type Definitions for Load Test Generator
// ============================================================================

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

export interface ASTNode {
  kind: string;
  location: SourceLocation;
}

export interface Identifier extends ASTNode {
  kind: 'Identifier';
  name: string;
}

export interface StringLiteral extends ASTNode {
  kind: 'StringLiteral';
  value: string;
}

export interface NumberLiteral extends ASTNode {
  kind: 'NumberLiteral';
  value: number;
  isFloat: boolean;
}

export interface DurationLiteral extends ASTNode {
  kind: 'DurationLiteral';
  value: number;
  unit: 'ms' | 'seconds' | 'minutes' | 'hours' | 'days';
}

export interface Domain extends ASTNode {
  kind: 'Domain';
  name: Identifier;
  version: StringLiteral;
  types: TypeDeclaration[];
  entities: Entity[];
  behaviors: Behavior[];
}

export interface TypeDeclaration extends ASTNode {
  kind: 'TypeDeclaration';
  name: Identifier;
  definition: TypeDefinition;
}

export interface TypeDefinition extends ASTNode {
  kind: string;
}

export interface Entity extends ASTNode {
  kind: 'Entity';
  name: Identifier;
  fields: Field[];
}

export interface Field extends ASTNode {
  kind: 'Field';
  name: Identifier;
  type: TypeDefinition;
  optional: boolean;
  annotations: Annotation[];
}

export interface Annotation extends ASTNode {
  kind: 'Annotation';
  name: Identifier;
}

export interface Behavior extends ASTNode {
  kind: 'Behavior';
  name: Identifier;
  description?: StringLiteral;
  input: InputSpec;
  output: OutputSpec;
  temporal: TemporalSpec[];
  security: SecuritySpec[];
}

export interface InputSpec extends ASTNode {
  kind: 'InputSpec';
  fields: Field[];
}

export interface OutputSpec extends ASTNode {
  kind: 'OutputSpec';
  success: TypeDefinition;
  errors: ErrorSpec[];
}

export interface ErrorSpec extends ASTNode {
  kind: 'ErrorSpec';
  name: Identifier;
}

export interface TemporalSpec extends ASTNode {
  kind: 'TemporalSpec';
  operator: 'eventually' | 'always' | 'within' | 'never';
  predicate: Expression;
  duration?: DurationLiteral;
  percentile?: number;
}

export interface SecuritySpec extends ASTNode {
  kind: 'SecuritySpec';
  type: 'requires' | 'rate_limit' | 'fraud_check';
  details: Expression;
}

export type Expression = ASTNode;

// ============================================================================
// Extracted SLA Data
// ============================================================================

export interface SLAThreshold {
  /** Percentile (50, 95, 99, etc.) */
  percentile: number;
  /** Duration in milliseconds */
  durationMs: number;
}

export interface RateLimit {
  /** Number of requests */
  count: number;
  /** Period in seconds */
  periodSeconds: number;
  /** Scope (per user, per ip, global) */
  scope: 'user' | 'ip' | 'global';
}

export interface BehaviorSLA {
  /** Behavior name */
  name: string;
  /** Response time thresholds */
  thresholds: SLAThreshold[];
  /** Rate limits */
  rateLimits: RateLimit[];
  /** Input field specs for test data generation */
  inputFields: InputFieldSpec[];
  /** Expected success status codes */
  successCodes: number[];
  /** Error rate threshold (percentage) */
  maxErrorRate: number;
}

export interface InputFieldSpec {
  name: string;
  type: string;
  optional: boolean;
  generator: 'email' | 'uuid' | 'string' | 'number' | 'boolean' | 'timestamp';
}
