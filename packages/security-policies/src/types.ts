// ============================================================================
// Security Policies - Type Definitions
// ============================================================================

/**
 * Source location in ISL spec
 */
export interface SourceLocation {
  file: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

/**
 * AST Node base interface
 */
export interface ASTNode {
  kind: string;
  location: SourceLocation;
}

/**
 * Identifier node
 */
export interface Identifier extends ASTNode {
  kind: 'Identifier';
  name: string;
}

/**
 * String literal node
 */
export interface StringLiteral extends ASTNode {
  kind: 'StringLiteral';
  value: string;
}

/**
 * Field definition
 */
export interface Field extends ASTNode {
  kind: 'Field';
  name: Identifier;
  type: TypeDefinition;
  optional: boolean;
  annotations: Annotation[];
}

/**
 * Annotation on a field or type
 */
export interface Annotation extends ASTNode {
  kind: 'Annotation';
  name: Identifier;
  value?: Expression;
}

/**
 * Type definition
 */
export interface TypeDefinition extends ASTNode {
  kind: string;
}

/**
 * Expression (generic)
 */
export type Expression = ASTNode;

/**
 * Security spec in behavior
 */
export interface SecuritySpec extends ASTNode {
  kind: 'SecuritySpec';
  type: 'requires' | 'rate_limit' | 'fraud_check' | 'webhook_signature';
  details: Expression;
}

/**
 * Log spec for observability
 */
export interface LogSpec extends ASTNode {
  kind: 'LogSpec';
  condition: 'success' | 'error' | 'always';
  level: 'debug' | 'info' | 'warn' | 'error';
  include: Identifier[];
  exclude: Identifier[];
}

/**
 * Observability spec
 */
export interface ObservabilitySpec extends ASTNode {
  kind: 'ObservabilitySpec';
  metrics: unknown[];
  traces: unknown[];
  logs: LogSpec[];
}

/**
 * Input spec for behavior
 */
export interface InputSpec extends ASTNode {
  kind: 'InputSpec';
  fields: Field[];
}

/**
 * Output spec for behavior
 */
export interface OutputSpec extends ASTNode {
  kind: 'OutputSpec';
  success: TypeDefinition;
  errors: ErrorSpec[];
}

/**
 * Error specification
 */
export interface ErrorSpec extends ASTNode {
  kind: 'ErrorSpec';
  name: Identifier;
  when?: StringLiteral;
  retriable: boolean;
  retryAfter?: Expression;
}

/**
 * Behavior definition
 */
export interface Behavior extends ASTNode {
  kind: 'Behavior';
  name: Identifier;
  description?: StringLiteral;
  input: InputSpec;
  output: OutputSpec;
  preconditions: Expression[];
  postconditions: PostconditionBlock[];
  invariants: Expression[];
  temporal: TemporalSpec[];
  security: SecuritySpec[];
  compliance: ComplianceSpec[];
  observability?: ObservabilitySpec;
}

/**
 * Postcondition block
 */
export interface PostconditionBlock extends ASTNode {
  kind: 'PostconditionBlock';
  condition: Identifier | 'success' | 'any_error';
  predicates: Expression[];
}

/**
 * Temporal spec
 */
export interface TemporalSpec extends ASTNode {
  kind: 'TemporalSpec';
  operator: string;
  predicate: Expression;
  duration?: DurationLiteral;
}

/**
 * Duration literal
 */
export interface DurationLiteral extends ASTNode {
  kind: 'DurationLiteral';
  value: number;
  unit: 'ms' | 'seconds' | 'minutes' | 'hours' | 'days';
}

/**
 * Compliance spec
 */
export interface ComplianceSpec extends ASTNode {
  kind: 'ComplianceSpec';
  standard: Identifier;
  requirements: Expression[];
}

/**
 * Domain definition
 */
export interface Domain extends ASTNode {
  kind: 'Domain';
  name: Identifier;
  version: StringLiteral;
  owner?: StringLiteral;
  types: TypeDeclaration[];
  entities: Entity[];
  behaviors: Behavior[];
  invariants: InvariantBlock[];
  policies: ISLPolicy[];
  views: View[];
  scenarios: ScenarioBlock[];
}

/**
 * Type declaration
 */
export interface TypeDeclaration extends ASTNode {
  kind: 'TypeDeclaration';
  name: Identifier;
  definition: TypeDefinition;
  annotations: Annotation[];
}

/**
 * Entity definition
 */
export interface Entity extends ASTNode {
  kind: 'Entity';
  name: Identifier;
  fields: Field[];
  invariants: Expression[];
  lifecycle?: LifecycleSpec;
}

/**
 * Lifecycle spec
 */
export interface LifecycleSpec extends ASTNode {
  kind: 'LifecycleSpec';
  transitions: LifecycleTransition[];
}

/**
 * Lifecycle transition
 */
export interface LifecycleTransition extends ASTNode {
  kind: 'LifecycleTransition';
  from: Identifier;
  to: Identifier;
}

/**
 * Invariant block
 */
export interface InvariantBlock extends ASTNode {
  kind: 'InvariantBlock';
  name: Identifier;
  description?: StringLiteral;
  scope: 'global' | 'transaction';
  predicates: Expression[];
}

/**
 * Policy definition (ISL AST node)
 */
export interface ISLPolicy extends ASTNode {
  kind: 'Policy';
  name: Identifier;
  appliesTo: ISLPolicyTarget;
  rules: ISLPolicyRule[];
}

/**
 * Policy target (ISL AST node)
 */
export interface ISLPolicyTarget extends ASTNode {
  kind: 'PolicyTarget';
  target: 'all' | Identifier[];
}

/**
 * Policy rule (ISL AST node)
 */
export interface ISLPolicyRule extends ASTNode {
  kind: 'PolicyRule';
  condition?: Expression;
  action: Expression;
}

/**
 * View definition
 */
export interface View extends ASTNode {
  kind: 'View';
  name: Identifier;
  forEntity: ReferenceType;
  fields: ViewField[];
}

/**
 * Reference type
 */
export interface ReferenceType extends ASTNode {
  kind: 'ReferenceType';
  name: QualifiedName;
}

/**
 * Qualified name
 */
export interface QualifiedName extends ASTNode {
  kind: 'QualifiedName';
  parts: Identifier[];
}

/**
 * View field
 */
export interface ViewField extends ASTNode {
  kind: 'ViewField';
  name: Identifier;
  type: TypeDefinition;
  computation: Expression;
}

/**
 * Scenario block
 */
export interface ScenarioBlock extends ASTNode {
  kind: 'ScenarioBlock';
  behaviorName: Identifier;
  scenarios: Scenario[];
}

/**
 * Scenario
 */
export interface Scenario extends ASTNode {
  kind: 'Scenario';
  name: StringLiteral;
  given: Statement[];
  when: Statement[];
  then: Expression[];
}

/**
 * Statement
 */
export interface Statement extends ASTNode {
  kind: string;
}

// ============================================================================
// POLICY & LINT TYPES
// ============================================================================

/**
 * Severity levels for findings
 */
export type Severity = 'error' | 'warning' | 'info';

/**
 * Policy categories
 */
export type PolicyCategory = 
  | 'pii-protection'
  | 'secrets-management'
  | 'webhook-security'
  | 'rate-limiting'
  | 'auth-security'
  | 'payment-security'
  | 'data-exposure';

/**
 * A finding from policy or lint check
 */
export interface Finding {
  id: string;
  category: PolicyCategory;
  severity: Severity;
  title: string;
  message: string;
  location: SourceLocation;
  behaviorName?: string;
  fieldName?: string;
  suggestion?: string;
  autofix?: ASTFix;
}

/**
 * AST Fix for auto-correction
 */
export interface ASTFix {
  /** Description of the fix */
  description: string;
  /** Type of fix operation */
  operation: 'add' | 'remove' | 'modify' | 'wrap';
  /** Target node kind to modify */
  targetKind: string;
  /** Location where fix applies */
  location: SourceLocation;
  /** Patch content */
  patch: ASTPatch;
}

/**
 * AST Patch representing the change
 */
export interface ASTPatch {
  /** For 'add' operations: the node to insert */
  insert?: Record<string, unknown>;
  /** For 'remove' operations: pattern to remove */
  removePattern?: string;
  /** For 'modify' operations: replacement node */
  replacement?: Record<string, unknown>;
  /** For 'wrap' operations: wrapper node kind */
  wrapperKind?: string;
  /** Raw text patch if applicable */
  text?: string;
  /** Position hint */
  position?: 'before' | 'after' | 'inside' | 'replace';
}

/**
 * Policy rule interface
 */
export interface PolicyRule {
  id: string;
  name: string;
  category: PolicyCategory;
  severity: Severity;
  description: string;
  check: (context: RuleContext) => Finding[];
}

/**
 * Rule context
 */
export interface RuleContext {
  domain: Domain;
  behavior?: Behavior;
  field?: Field;
  entity?: Entity;
}

/**
 * Lint rule interface
 */
export interface LintRule {
  id: string;
  name: string;
  category: PolicyCategory;
  severity: Severity;
  description: string;
  /** Pattern matchers for behavior names */
  matchPatterns: RegExp[];
  /** Required constraints for matched behaviors */
  requiredConstraints: RequiredConstraint[];
  check: (context: RuleContext) => Finding[];
}

/**
 * Required constraint
 */
export interface RequiredConstraint {
  type: 'rate_limit' | 'auth' | 'webhook_signature' | 'encryption' | 'validation' | 'logging';
  description: string;
  severity: Severity;
}

/**
 * Lint result
 */
export interface LintResult {
  passed: boolean;
  findings: Finding[];
  fixableCount: number;
  summary: {
    errors: number;
    warnings: number;
    infos: number;
  };
  duration: number;
}

/**
 * Policy check result
 */
export interface PolicyCheckResult {
  passed: boolean;
  findings: Finding[];
  score: number;
  checkedPolicies: string[];
  duration: number;
}

/**
 * Combined security check result
 */
export interface SecurityCheckResult {
  passed: boolean;
  policyResult: PolicyCheckResult;
  lintResult: LintResult;
  allFindings: Finding[];
  totalFixable: number;
  duration: number;
}

/**
 * Security policy pack options
 */
export interface SecurityPolicyOptions {
  /** Policies to enable */
  enabledPolicies?: PolicyCategory[];
  /** Minimum severity to report */
  minSeverity?: Severity;
  /** Fail on severity */
  failOnSeverity?: Severity;
  /** Enable auto-fix generation */
  generateAutofixes?: boolean;
  /** Custom rules */
  customRules?: PolicyRule[];
  /** Custom lint rules */
  customLintRules?: LintRule[];
}

/**
 * Default options
 */
export const DEFAULT_SECURITY_OPTIONS: Required<SecurityPolicyOptions> = {
  enabledPolicies: [
    'pii-protection',
    'secrets-management',
    'webhook-security',
    'rate-limiting',
    'auth-security',
    'payment-security',
  ],
  minSeverity: 'info',
  failOnSeverity: 'error',
  generateAutofixes: true,
  customRules: [],
  customLintRules: [],
};

/**
 * Severity priority for comparison
 */
export const SEVERITY_PRIORITY: Record<Severity, number> = {
  error: 3,
  warning: 2,
  info: 1,
};
