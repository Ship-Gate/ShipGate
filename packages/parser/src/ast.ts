// ============================================================================
// ISL (Intent Specification Language) - Abstract Syntax Tree Types
// Re-exported from master contracts with local definitions for standalone use
// ============================================================================

// ============================================================================
// SOURCE LOCATIONS
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

// ============================================================================
// TOP LEVEL
// ============================================================================

export interface Domain extends ASTNode {
  kind: 'Domain';
  name: Identifier;
  version: StringLiteral;
  owner?: StringLiteral;
  imports: Import[];
  types: TypeDeclaration[];
  entities: Entity[];
  behaviors: Behavior[];
  invariants: InvariantBlock[];
  policies: Policy[];
  views: View[];
  scenarios: ScenarioBlock[];
  chaos: ChaosBlock[];
}

export interface Import extends ASTNode {
  kind: 'Import';
  items: ImportItem[];
  from: StringLiteral;
}

export interface ImportItem extends ASTNode {
  kind: 'ImportItem';
  name: Identifier;
  alias?: Identifier;
}

// ============================================================================
// TYPES
// ============================================================================

export interface TypeDeclaration extends ASTNode {
  kind: 'TypeDeclaration';
  name: Identifier;
  definition: TypeDefinition;
  annotations: Annotation[];
}

export type TypeDefinition =
  | PrimitiveType
  | ConstrainedType
  | EnumType
  | StructType
  | UnionType
  | ListType
  | MapType
  | OptionalType
  | ReferenceType;

export interface PrimitiveType extends ASTNode {
  kind: 'PrimitiveType';
  name: 'String' | 'Int' | 'Decimal' | 'Boolean' | 'Timestamp' | 'UUID' | 'Duration';
}

export interface ConstrainedType extends ASTNode {
  kind: 'ConstrainedType';
  base: TypeDefinition;
  constraints: Constraint[];
}

export interface Constraint extends ASTNode {
  kind: 'Constraint';
  name: string;
  value: Expression;
}

export interface EnumType extends ASTNode {
  kind: 'EnumType';
  variants: EnumVariant[];
}

export interface EnumVariant extends ASTNode {
  kind: 'EnumVariant';
  name: Identifier;
  value?: Literal;
}

export interface StructType extends ASTNode {
  kind: 'StructType';
  fields: Field[];
}

export interface Field extends ASTNode {
  kind: 'Field';
  name: Identifier;
  type: TypeDefinition;
  optional: boolean;
  annotations: Annotation[];
  defaultValue?: Expression;
}

export interface UnionType extends ASTNode {
  kind: 'UnionType';
  variants: UnionVariant[];
}

export interface UnionVariant extends ASTNode {
  kind: 'UnionVariant';
  name: Identifier;
  fields: Field[];
}

export interface ListType extends ASTNode {
  kind: 'ListType';
  element: TypeDefinition;
}

export interface MapType extends ASTNode {
  kind: 'MapType';
  key: TypeDefinition;
  value: TypeDefinition;
}

export interface OptionalType extends ASTNode {
  kind: 'OptionalType';
  inner: TypeDefinition;
}

export interface ReferenceType extends ASTNode {
  kind: 'ReferenceType';
  name: QualifiedName;
}

export interface Annotation extends ASTNode {
  kind: 'Annotation';
  name: Identifier;
  value?: Expression;
}

// ============================================================================
// ENTITIES
// ============================================================================

export interface Entity extends ASTNode {
  kind: 'Entity';
  name: Identifier;
  fields: Field[];
  invariants: Expression[];
  lifecycle?: LifecycleSpec;
}

export interface LifecycleSpec extends ASTNode {
  kind: 'LifecycleSpec';
  transitions: LifecycleTransition[];
}

export interface LifecycleTransition extends ASTNode {
  kind: 'LifecycleTransition';
  from: Identifier;
  to: Identifier;
}

// ============================================================================
// BEHAVIORS
// ============================================================================

export interface Behavior extends ASTNode {
  kind: 'Behavior';
  name: Identifier;
  description?: StringLiteral;
  actors?: ActorSpec[];
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

export interface ActorSpec extends ASTNode {
  kind: 'ActorSpec';
  name: Identifier;
  constraints: Expression[];
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
  when?: StringLiteral;
  retriable: boolean;
  retryAfter?: Expression;
  returns?: TypeDefinition;
}

export interface PostconditionBlock extends ASTNode {
  kind: 'PostconditionBlock';
  condition: Identifier | 'success' | 'any_error';
  predicates: Expression[];
}

export interface TemporalSpec extends ASTNode {
  kind: 'TemporalSpec';
  operator: 'eventually' | 'always' | 'within' | 'never' | 'immediately' | 'response';
  predicate: Expression;
  duration?: DurationLiteral;
  percentile?: number;
}

export interface SecuritySpec extends ASTNode {
  kind: 'SecuritySpec';
  type: 'requires' | 'rate_limit' | 'fraud_check';
  details: Expression;
}

export interface ComplianceSpec extends ASTNode {
  kind: 'ComplianceSpec';
  standard: Identifier;
  requirements: Expression[];
}

export interface ObservabilitySpec extends ASTNode {
  kind: 'ObservabilitySpec';
  metrics: MetricSpec[];
  traces: TraceSpec[];
  logs: LogSpec[];
}

export interface MetricSpec extends ASTNode {
  kind: 'MetricSpec';
  name: Identifier;
  type: 'counter' | 'gauge' | 'histogram';
  labels: Identifier[];
}

export interface TraceSpec extends ASTNode {
  kind: 'TraceSpec';
  name: StringLiteral;
}

export interface LogSpec extends ASTNode {
  kind: 'LogSpec';
  condition: 'success' | 'error' | 'always';
  level: 'debug' | 'info' | 'warn' | 'error';
  include: Identifier[];
  exclude: Identifier[];
}

// ============================================================================
// INVARIANTS & POLICIES
// ============================================================================

export interface InvariantBlock extends ASTNode {
  kind: 'InvariantBlock';
  name: Identifier;
  description?: StringLiteral;
  scope: 'global' | 'transaction';
  predicates: Expression[];
}

export interface Policy extends ASTNode {
  kind: 'Policy';
  name: Identifier;
  appliesTo: PolicyTarget;
  rules: PolicyRule[];
}

export interface PolicyTarget extends ASTNode {
  kind: 'PolicyTarget';
  target: 'all' | Identifier[];
}

export interface PolicyRule extends ASTNode {
  kind: 'PolicyRule';
  condition?: Expression;
  action: Expression;
}

// ============================================================================
// VIEWS
// ============================================================================

export interface View extends ASTNode {
  kind: 'View';
  name: Identifier;
  forEntity: ReferenceType;
  fields: ViewField[];
  consistency: ConsistencySpec;
  cache?: CacheSpec;
}

export interface ViewField extends ASTNode {
  kind: 'ViewField';
  name: Identifier;
  type: TypeDefinition;
  computation: Expression;
}

export interface ConsistencySpec extends ASTNode {
  kind: 'ConsistencySpec';
  mode: 'strong' | 'eventual';
  maxDelay?: DurationLiteral;
  strongFields?: Identifier[];
}

export interface CacheSpec extends ASTNode {
  kind: 'CacheSpec';
  ttl: DurationLiteral;
  invalidateOn: Expression[];
}

// ============================================================================
// SCENARIOS & CHAOS
// ============================================================================

export interface ScenarioBlock extends ASTNode {
  kind: 'ScenarioBlock';
  behaviorName: Identifier;
  scenarios: Scenario[];
}

export interface Scenario extends ASTNode {
  kind: 'Scenario';
  name: StringLiteral;
  given: Statement[];
  when: Statement[];
  then: Expression[];
}

export interface ChaosBlock extends ASTNode {
  kind: 'ChaosBlock';
  behaviorName: Identifier;
  scenarios: ChaosScenario[];
}

export interface ChaosScenario extends ASTNode {
  kind: 'ChaosScenario';
  name: StringLiteral;
  inject: Injection[];
  when: Statement[];
  then: Expression[];
}

export interface Injection extends ASTNode {
  kind: 'Injection';
  type: InjectionType;
  target: Expression;
  parameters: InjectionParam[];
}

export type InjectionType =
  | 'database_failure'
  | 'network_latency'
  | 'network_partition'
  | 'service_unavailable'
  | 'cpu_pressure'
  | 'memory_pressure'
  | 'clock_skew'
  | 'concurrent_requests';

export interface InjectionParam extends ASTNode {
  kind: 'InjectionParam';
  name: Identifier;
  value: Expression;
}

// ============================================================================
// EXPRESSIONS
// ============================================================================

export type Expression =
  | Identifier
  | QualifiedName
  | Literal
  | StringLiteral
  | NumberLiteral
  | BooleanLiteral
  | NullLiteral
  | DurationLiteral
  | RegexLiteral
  | BinaryExpr
  | UnaryExpr
  | CallExpr
  | MemberExpr
  | IndexExpr
  | QuantifierExpr
  | ConditionalExpr
  | OldExpr
  | ResultExpr
  | InputExpr
  | LambdaExpr
  | ListExpr
  | MapExpr;

export interface Identifier extends ASTNode {
  kind: 'Identifier';
  name: string;
}

export interface QualifiedName extends ASTNode {
  kind: 'QualifiedName';
  parts: Identifier[];
}

export interface Literal extends ASTNode {
  kind: 'Literal';
  litKind: 'string' | 'number' | 'boolean' | 'null' | 'duration' | 'regex';
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

export interface BooleanLiteral extends ASTNode {
  kind: 'BooleanLiteral';
  value: boolean;
}

export interface NullLiteral extends ASTNode {
  kind: 'NullLiteral';
}

export interface DurationLiteral extends ASTNode {
  kind: 'DurationLiteral';
  value: number;
  unit: 'ms' | 'seconds' | 'minutes' | 'hours' | 'days';
}

export interface RegexLiteral extends ASTNode {
  kind: 'RegexLiteral';
  pattern: string;
  flags: string;
}

export interface BinaryExpr extends ASTNode {
  kind: 'BinaryExpr';
  operator: BinaryOperator;
  left: Expression;
  right: Expression;
}

export type BinaryOperator =
  | '==' | '!=' | '<' | '>' | '<=' | '>='
  | '+' | '-' | '*' | '/' | '%'
  | 'and' | 'or' | 'implies' | 'iff'
  | 'in';

export interface UnaryExpr extends ASTNode {
  kind: 'UnaryExpr';
  operator: UnaryOperator;
  operand: Expression;
}

export type UnaryOperator = 'not' | '-';

export interface CallExpr extends ASTNode {
  kind: 'CallExpr';
  callee: Expression;
  arguments: Expression[];
}

export interface MemberExpr extends ASTNode {
  kind: 'MemberExpr';
  object: Expression;
  property: Identifier;
}

export interface IndexExpr extends ASTNode {
  kind: 'IndexExpr';
  object: Expression;
  index: Expression;
}

export interface QuantifierExpr extends ASTNode {
  kind: 'QuantifierExpr';
  quantifier: 'all' | 'any' | 'none' | 'count' | 'sum' | 'filter';
  variable: Identifier;
  collection: Expression;
  predicate: Expression;
}

export interface ConditionalExpr extends ASTNode {
  kind: 'ConditionalExpr';
  condition: Expression;
  thenBranch: Expression;
  elseBranch: Expression;
}

export interface OldExpr extends ASTNode {
  kind: 'OldExpr';
  expression: Expression;
}

export interface ResultExpr extends ASTNode {
  kind: 'ResultExpr';
  property?: Identifier;
}

export interface InputExpr extends ASTNode {
  kind: 'InputExpr';
  property: Identifier;
}

export interface LambdaExpr extends ASTNode {
  kind: 'LambdaExpr';
  params: Identifier[];
  body: Expression;
}

export interface ListExpr extends ASTNode {
  kind: 'ListExpr';
  elements: Expression[];
}

export interface MapExpr extends ASTNode {
  kind: 'MapExpr';
  entries: MapEntry[];
}

export interface MapEntry extends ASTNode {
  kind: 'MapEntry';
  key: Expression;
  value: Expression;
}

// ============================================================================
// STATEMENTS (for scenarios)
// ============================================================================

export type Statement =
  | AssignmentStmt
  | CallStmt
  | LoopStmt;

export interface AssignmentStmt extends ASTNode {
  kind: 'AssignmentStmt';
  target: Identifier;
  value: Expression;
}

export interface CallStmt extends ASTNode {
  kind: 'CallStmt';
  target?: Identifier;
  call: CallExpr;
}

export interface LoopStmt extends ASTNode {
  kind: 'LoopStmt';
  count: Expression;
  variable?: Identifier;
  body: Statement[];
}

// ============================================================================
// COMPOSITION
// ============================================================================

export interface Composition extends ASTNode {
  kind: 'Composition';
  name: Identifier;
  steps: CompositionStep[];
  compensations: Compensation[];
  timeout?: DurationLiteral;
  onFailure: 'compensate_reverse' | 'compensate_forward' | 'abort';
}

export interface CompositionStep extends ASTNode {
  kind: 'CompositionStep';
  order: number;
  behavior: ReferenceType;
}

export interface Compensation extends ASTNode {
  kind: 'Compensation';
  step: ReferenceType;
  compensatingBehavior: ReferenceType | 'no_action';
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function createLocation(
  file: string,
  line: number,
  column: number,
  endLine: number,
  endColumn: number
): SourceLocation {
  return { file, line, column, endLine, endColumn };
}

export function mergeLocations(start: SourceLocation, end: SourceLocation): SourceLocation {
  return {
    file: start.file,
    line: start.line,
    column: start.column,
    endLine: end.endLine,
    endColumn: end.endColumn,
  };
}
