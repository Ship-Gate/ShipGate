/**
 * Corpus Runner - Mock extractor and utilities for AST/ISL invariant testing
 * 
 * Provides infrastructure for testing ISL translator without calling a model.
 * Validates:
 * - Printer determinism
 * - Round-trip parse equality after normalization
 * - Stable fingerprinting for same normalized AST
 */

import { createHash } from 'crypto';

// ============================================================================
// AST TYPES (Subset for corpus testing)
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
  location?: SourceLocation;
  [key: string]: unknown;
}

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

export interface BooleanLiteral extends ASTNode {
  kind: 'BooleanLiteral';
  value: boolean;
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
  value?: ASTNode;
}

export interface StructType extends ASTNode {
  kind: 'StructType';
  fields: Field[];
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

export interface QualifiedName extends ASTNode {
  kind: 'QualifiedName';
  parts: Identifier[];
}

export interface Annotation extends ASTNode {
  kind: 'Annotation';
  name: Identifier;
  value?: Expression;
}

export interface Field extends ASTNode {
  kind: 'Field';
  name: Identifier;
  type: TypeDefinition;
  optional: boolean;
  annotations: Annotation[];
  defaultValue?: Expression;
}

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
  type: string;
  target: Expression;
  parameters: InjectionParam[];
}

export interface InjectionParam extends ASTNode {
  kind: 'InjectionParam';
  name: Identifier;
  value: Expression;
}

export interface DurationLiteral extends ASTNode {
  kind: 'DurationLiteral';
  value: number;
  unit: 'ms' | 'seconds' | 'minutes' | 'hours' | 'days';
}

export type Expression =
  | Identifier
  | QualifiedName
  | StringLiteral
  | NumberLiteral
  | BooleanLiteral
  | DurationLiteral
  | BinaryExpr
  | UnaryExpr
  | CallExpr
  | MemberExpr
  | ListExpr
  | MapExpr;

export interface BinaryExpr extends ASTNode {
  kind: 'BinaryExpr';
  operator: string;
  left: Expression;
  right: Expression;
}

export interface UnaryExpr extends ASTNode {
  kind: 'UnaryExpr';
  operator: string;
  operand: Expression;
}

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

export type Statement = AssignmentStmt | CallStmt;

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

// ============================================================================
// CORPUS ENTRY TYPES
// ============================================================================

export interface ShapeRule {
  /** Required node kinds in the AST */
  requiredKinds?: string[];
  /** Minimum number of entities */
  minEntities?: number;
  /** Maximum number of entities */
  maxEntities?: number;
  /** Minimum number of behaviors */
  minBehaviors?: number;
  /** Maximum number of behaviors */
  maxBehaviors?: number;
  /** Required field names in entities */
  requiredFields?: string[];
  /** Expected domain name pattern (regex) */
  domainNamePattern?: string;
  /** Expected version format */
  versionPattern?: string;
  /** Must have preconditions */
  requirePreconditions?: boolean;
  /** Must have postconditions */
  requirePostconditions?: boolean;
  /** Must have temporal specs */
  requireTemporal?: boolean;
  /** Must have security specs */
  requireSecurity?: boolean;
}

export interface CorpusEntry {
  /** Unique identifier for the entry */
  id: string;
  /** Natural language prompt/description */
  prompt: string;
  /** Category of the prompt */
  category: string;
  /** Expected shape rules for the generated AST */
  expectedShape: ShapeRule;
  /** Tags for filtering */
  tags: string[];
}

// ============================================================================
// MOCK AST EXTRACTOR
// ============================================================================

/**
 * Creates a mock location for AST nodes
 */
function mockLocation(file = '<mock>'): SourceLocation {
  return {
    file,
    line: 1,
    column: 1,
    endLine: 1,
    endColumn: 1,
  };
}

/**
 * Creates an identifier node
 */
export function createIdentifier(name: string): Identifier {
  return {
    kind: 'Identifier',
    name,
    location: mockLocation(),
  };
}

/**
 * Creates a string literal node
 */
export function createStringLiteral(value: string): StringLiteral {
  return {
    kind: 'StringLiteral',
    value,
    location: mockLocation(),
  };
}

/**
 * Creates a number literal node
 */
export function createNumberLiteral(value: number, isFloat = false): NumberLiteral {
  return {
    kind: 'NumberLiteral',
    value,
    isFloat,
    location: mockLocation(),
  };
}

/**
 * Creates a boolean literal node
 */
export function createBooleanLiteral(value: boolean): BooleanLiteral {
  return {
    kind: 'BooleanLiteral',
    value,
    location: mockLocation(),
  };
}

/**
 * Creates a primitive type node
 */
export function createPrimitiveType(name: PrimitiveType['name']): PrimitiveType {
  return {
    kind: 'PrimitiveType',
    name,
    location: mockLocation(),
  };
}

/**
 * Creates a reference type node
 */
export function createReferenceType(name: string): ReferenceType {
  return {
    kind: 'ReferenceType',
    name: {
      kind: 'QualifiedName',
      parts: [createIdentifier(name)],
      location: mockLocation(),
    },
    location: mockLocation(),
  };
}

/**
 * Creates a field node
 */
export function createField(
  name: string,
  type: TypeDefinition,
  options: { optional?: boolean; annotations?: Annotation[] } = {}
): Field {
  return {
    kind: 'Field',
    name: createIdentifier(name),
    type,
    optional: options.optional ?? false,
    annotations: options.annotations ?? [],
    location: mockLocation(),
  };
}

/**
 * Creates an entity node
 */
export function createEntity(
  name: string,
  fields: Field[],
  options: { invariants?: Expression[]; lifecycle?: LifecycleSpec } = {}
): Entity {
  return {
    kind: 'Entity',
    name: createIdentifier(name),
    fields,
    invariants: options.invariants ?? [],
    lifecycle: options.lifecycle,
    location: mockLocation(),
  };
}

/**
 * Creates an input spec
 */
export function createInputSpec(fields: Field[]): InputSpec {
  return {
    kind: 'InputSpec',
    fields,
    location: mockLocation(),
  };
}

/**
 * Creates an output spec
 */
export function createOutputSpec(success: TypeDefinition, errors: ErrorSpec[] = []): OutputSpec {
  return {
    kind: 'OutputSpec',
    success,
    errors,
    location: mockLocation(),
  };
}

/**
 * Creates a behavior node
 */
export function createBehavior(
  name: string,
  options: {
    description?: string;
    input?: InputSpec;
    output?: OutputSpec;
    preconditions?: Expression[];
    postconditions?: PostconditionBlock[];
    invariants?: Expression[];
    temporal?: TemporalSpec[];
    security?: SecuritySpec[];
  } = {}
): Behavior {
  return {
    kind: 'Behavior',
    name: createIdentifier(name),
    description: options.description ? createStringLiteral(options.description) : undefined,
    input: options.input ?? createInputSpec([]),
    output: options.output ?? createOutputSpec(createPrimitiveType('Boolean')),
    preconditions: options.preconditions ?? [],
    postconditions: options.postconditions ?? [],
    invariants: options.invariants ?? [],
    temporal: options.temporal ?? [],
    security: options.security ?? [],
    compliance: [],
    location: mockLocation(),
  };
}

/**
 * Creates a domain node
 */
export function createDomain(
  name: string,
  version: string,
  options: {
    owner?: string;
    imports?: Import[];
    types?: TypeDeclaration[];
    entities?: Entity[];
    behaviors?: Behavior[];
    invariants?: InvariantBlock[];
    policies?: Policy[];
    views?: View[];
    scenarios?: ScenarioBlock[];
    chaos?: ChaosBlock[];
  } = {}
): Domain {
  return {
    kind: 'Domain',
    name: createIdentifier(name),
    version: createStringLiteral(version),
    owner: options.owner ? createStringLiteral(options.owner) : undefined,
    imports: options.imports ?? [],
    types: options.types ?? [],
    entities: options.entities ?? [],
    behaviors: options.behaviors ?? [],
    invariants: options.invariants ?? [],
    policies: options.policies ?? [],
    views: options.views ?? [],
    scenarios: options.scenarios ?? [],
    chaos: options.chaos ?? [],
    location: mockLocation(),
  };
}

/**
 * Mock AST extractor that generates AST fixtures from corpus entries
 * This simulates what a real translator would produce without calling a model
 */
export class MockExtractor {
  /**
   * Extracts/generates an AST fixture based on a corpus entry
   */
  extract(entry: CorpusEntry): Domain {
    const domainName = this.generateDomainName(entry);
    const entities = this.generateEntities(entry);
    const behaviors = this.generateBehaviors(entry);

    return createDomain(domainName, '1.0.0', {
      owner: 'Corpus Test Suite',
      entities,
      behaviors,
    });
  }

  private generateDomainName(entry: CorpusEntry): string {
    // Generate a domain name based on category and id
    const categoryPart = entry.category
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('');
    return `${categoryPart}Domain`;
  }

  private generateEntities(entry: CorpusEntry): Entity[] {
    const shape = entry.expectedShape;
    const count = shape.minEntities ?? 1;
    const entities: Entity[] = [];

    for (let i = 0; i < count; i++) {
      const fields: Field[] = [
        createField('id', createPrimitiveType('UUID'), {
          annotations: [
            { kind: 'Annotation', name: createIdentifier('immutable'), location: mockLocation() },
            { kind: 'Annotation', name: createIdentifier('unique'), location: mockLocation() },
          ],
        }),
        createField('createdAt', createPrimitiveType('Timestamp')),
        createField('updatedAt', createPrimitiveType('Timestamp')),
      ];

      // Add required fields from shape rules
      if (shape.requiredFields) {
        for (const fieldName of shape.requiredFields) {
          if (!fields.some(f => f.name.name === fieldName)) {
            fields.push(createField(fieldName, createPrimitiveType('String')));
          }
        }
      }

      entities.push(createEntity(`Entity${i + 1}`, fields));
    }

    return entities;
  }

  private generateBehaviors(entry: CorpusEntry): Behavior[] {
    const shape = entry.expectedShape;
    const count = shape.minBehaviors ?? 1;
    const behaviors: Behavior[] = [];

    for (let i = 0; i < count; i++) {
      const options: Parameters<typeof createBehavior>[1] = {
        description: `Behavior ${i + 1} for ${entry.category}`,
        input: createInputSpec([
          createField('data', createPrimitiveType('String')),
        ]),
        output: createOutputSpec(createPrimitiveType('Boolean'), [
          {
            kind: 'ErrorSpec',
            name: createIdentifier('VALIDATION_ERROR'),
            when: createStringLiteral('Invalid input data'),
            retriable: false,
            location: mockLocation(),
          },
        ]),
      };

      if (shape.requirePreconditions) {
        options.preconditions = [
          {
            kind: 'BinaryExpr',
            operator: '>',
            left: {
              kind: 'MemberExpr',
              object: createIdentifier('input'),
              property: createIdentifier('data'),
              location: mockLocation(),
            } as MemberExpr,
            right: createNumberLiteral(0),
            location: mockLocation(),
          },
        ];
      }

      if (shape.requirePostconditions) {
        options.postconditions = [
          {
            kind: 'PostconditionBlock',
            condition: 'success',
            predicates: [createBooleanLiteral(true)],
            location: mockLocation(),
          },
        ];
      }

      if (shape.requireTemporal) {
        options.temporal = [
          {
            kind: 'TemporalSpec',
            operator: 'response',
            predicate: createBooleanLiteral(true),
            duration: {
              kind: 'DurationLiteral',
              value: 500,
              unit: 'ms',
              location: mockLocation(),
            },
            location: mockLocation(),
          },
        ];
      }

      if (shape.requireSecurity) {
        options.security = [
          {
            kind: 'SecuritySpec',
            type: 'rate_limit',
            details: createNumberLiteral(100),
            location: mockLocation(),
          },
        ];
      }

      behaviors.push(createBehavior(`Behavior${i + 1}`, options));
    }

    return behaviors;
  }
}

// ============================================================================
// AST NORMALIZATION
// ============================================================================

/**
 * Removes location information from AST nodes for comparison
 * This enables structural equality testing
 */
export function normalizeAST<T extends ASTNode>(node: T): T {
  if (node === null || node === undefined) {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map(item => normalizeAST(item)) as T;
  }

  if (typeof node !== 'object') {
    return node;
  }

  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(node)) {
    // Skip location information
    if (key === 'location') {
      continue;
    }

    if (value === null || value === undefined) {
      normalized[key] = value;
    } else if (Array.isArray(value)) {
      normalized[key] = value.map(item => 
        typeof item === 'object' && item !== null ? normalizeAST(item as ASTNode) : item
      );
    } else if (typeof value === 'object') {
      normalized[key] = normalizeAST(value as ASTNode);
    } else {
      normalized[key] = value;
    }
  }

  return normalized as T;
}

// ============================================================================
// AST PRINTER (Deterministic Serialization)
// ============================================================================

/**
 * Deterministically prints an AST to a string
 * Ensures same AST always produces identical output
 */
export function printAST(node: ASTNode, indent = 0): string {
  const prefix = '  '.repeat(indent);
  const lines: string[] = [];

  if (!node || typeof node !== 'object') {
    return String(node);
  }

  lines.push(`${prefix}${node.kind} {`);

  // Sort keys for deterministic output
  const keys = Object.keys(node)
    .filter(k => k !== 'kind' && k !== 'location')
    .sort();

  for (const key of keys) {
    const value = node[key];

    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${prefix}  ${key}: []`);
      } else {
        lines.push(`${prefix}  ${key}: [`);
        for (const item of value) {
          if (typeof item === 'object' && item !== null && 'kind' in item) {
            lines.push(printAST(item as ASTNode, indent + 2));
          } else {
            lines.push(`${prefix}    ${JSON.stringify(item)}`);
          }
        }
        lines.push(`${prefix}  ]`);
      }
    } else if (typeof value === 'object' && 'kind' in value) {
      lines.push(`${prefix}  ${key}:`);
      lines.push(printAST(value as ASTNode, indent + 2));
    } else if (typeof value === 'object') {
      lines.push(`${prefix}  ${key}: ${JSON.stringify(value)}`);
    } else {
      lines.push(`${prefix}  ${key}: ${JSON.stringify(value)}`);
    }
  }

  lines.push(`${prefix}}`);

  return lines.join('\n');
}

/**
 * Compact printer for debugging
 */
export function printASTCompact(node: ASTNode): string {
  const normalized = normalizeAST(node);
  return JSON.stringify(normalized, null, 0);
}

// ============================================================================
// AST FINGERPRINTING
// ============================================================================

/**
 * Recursively sorts object keys for deterministic serialization
 */
function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sortObjectKeys(item));
  }
  
  if (typeof obj === 'object') {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  
  return obj;
}

/**
 * Generates a stable fingerprint (hash) for an AST
 * Same normalized AST always produces the same fingerprint
 */
export function fingerprintAST(node: ASTNode): string {
  const normalized = normalizeAST(node);
  const sorted = sortObjectKeys(normalized);
  const serialized = JSON.stringify(sorted);
  return createHash('sha256').update(serialized).digest('hex');
}

/**
 * Generates a short fingerprint (first 16 chars)
 */
export function shortFingerprint(node: ASTNode): string {
  return fingerprintAST(node).substring(0, 16);
}

// ============================================================================
// SHAPE VALIDATION
// ============================================================================

/**
 * Validates that an AST matches expected shape rules
 */
export function validateShape(ast: Domain, rules: ShapeRule): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required kinds
  if (rules.requiredKinds) {
    const kinds = collectKinds(ast);
    for (const required of rules.requiredKinds) {
      if (!kinds.has(required)) {
        errors.push(`Missing required kind: ${required}`);
      }
    }
  }

  // Check entity count
  const entityCount = ast.entities.length;
  if (rules.minEntities !== undefined && entityCount < rules.minEntities) {
    errors.push(`Expected at least ${rules.minEntities} entities, found ${entityCount}`);
  }
  if (rules.maxEntities !== undefined && entityCount > rules.maxEntities) {
    errors.push(`Expected at most ${rules.maxEntities} entities, found ${entityCount}`);
  }

  // Check behavior count
  const behaviorCount = ast.behaviors.length;
  if (rules.minBehaviors !== undefined && behaviorCount < rules.minBehaviors) {
    errors.push(`Expected at least ${rules.minBehaviors} behaviors, found ${behaviorCount}`);
  }
  if (rules.maxBehaviors !== undefined && behaviorCount > rules.maxBehaviors) {
    errors.push(`Expected at most ${rules.maxBehaviors} behaviors, found ${behaviorCount}`);
  }

  // Check required fields
  if (rules.requiredFields) {
    const allFields = new Set<string>();
    for (const entity of ast.entities) {
      for (const field of entity.fields) {
        allFields.add(field.name.name);
      }
    }
    for (const required of rules.requiredFields) {
      if (!allFields.has(required)) {
        warnings.push(`Missing recommended field: ${required}`);
      }
    }
  }

  // Check domain name pattern
  if (rules.domainNamePattern) {
    const pattern = new RegExp(rules.domainNamePattern);
    if (!pattern.test(ast.name.name)) {
      errors.push(`Domain name '${ast.name.name}' does not match pattern '${rules.domainNamePattern}'`);
    }
  }

  // Check version pattern
  if (rules.versionPattern) {
    const pattern = new RegExp(rules.versionPattern);
    if (!pattern.test(ast.version.value)) {
      errors.push(`Version '${ast.version.value}' does not match pattern '${rules.versionPattern}'`);
    }
  }

  // Check preconditions requirement
  if (rules.requirePreconditions) {
    const hasPreconditions = ast.behaviors.some(b => b.preconditions.length > 0);
    if (!hasPreconditions) {
      errors.push('Expected at least one behavior with preconditions');
    }
  }

  // Check postconditions requirement
  if (rules.requirePostconditions) {
    const hasPostconditions = ast.behaviors.some(b => b.postconditions.length > 0);
    if (!hasPostconditions) {
      errors.push('Expected at least one behavior with postconditions');
    }
  }

  // Check temporal specs requirement
  if (rules.requireTemporal) {
    const hasTemporal = ast.behaviors.some(b => b.temporal.length > 0);
    if (!hasTemporal) {
      errors.push('Expected at least one behavior with temporal specs');
    }
  }

  // Check security specs requirement
  if (rules.requireSecurity) {
    const hasSecurity = ast.behaviors.some(b => b.security.length > 0);
    if (!hasSecurity) {
      errors.push('Expected at least one behavior with security specs');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Collects all node kinds from an AST
 */
function collectKinds(node: ASTNode, kinds = new Set<string>()): Set<string> {
  if (!node || typeof node !== 'object') {
    return kinds;
  }

  if ('kind' in node) {
    kinds.add(node.kind as string);
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'object' && item !== null) {
          collectKinds(item as ASTNode, kinds);
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      collectKinds(value as ASTNode, kinds);
    }
  }

  return kinds;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// CORPUS RUNNER
// ============================================================================

export interface CorpusRunResult {
  entry: CorpusEntry;
  ast: Domain;
  fingerprint: string;
  printOutput: string;
  validation: ValidationResult;
  printerDeterministic: boolean;
  fingerprintStable: boolean;
}

/**
 * Runs corpus tests against a mock extractor
 */
export class CorpusRunner {
  private extractor: MockExtractor;

  constructor() {
    this.extractor = new MockExtractor();
  }

  /**
   * Runs a single corpus entry
   */
  run(entry: CorpusEntry): CorpusRunResult {
    const ast = this.extractor.extract(entry);
    const fingerprint = fingerprintAST(ast);
    const printOutput = printAST(ast);

    // Test printer determinism by printing multiple times
    const printOutputs = [printOutput];
    for (let i = 0; i < 3; i++) {
      printOutputs.push(printAST(ast));
    }
    const printerDeterministic = printOutputs.every(p => p === printOutput);

    // Test fingerprint stability by generating multiple times
    const fingerprints = [fingerprint];
    for (let i = 0; i < 3; i++) {
      fingerprints.push(fingerprintAST(ast));
    }
    const fingerprintStable = fingerprints.every(f => f === fingerprint);

    // Validate shape
    const validation = validateShape(ast, entry.expectedShape);

    return {
      entry,
      ast,
      fingerprint,
      printOutput,
      validation,
      printerDeterministic,
      fingerprintStable,
    };
  }

  /**
   * Runs all corpus entries
   */
  runAll(entries: CorpusEntry[]): CorpusRunResult[] {
    return entries.map(entry => this.run(entry));
  }

  /**
   * Gets summary statistics from run results
   */
  getSummary(results: CorpusRunResult[]): CorpusSummary {
    const total = results.length;
    const passed = results.filter(r => 
      r.validation.valid && r.printerDeterministic && r.fingerprintStable
    ).length;
    const failed = total - passed;

    const validationErrors = results
      .filter(r => !r.validation.valid)
      .map(r => ({ id: r.entry.id, errors: r.validation.errors }));

    const deterministicFailures = results
      .filter(r => !r.printerDeterministic)
      .map(r => r.entry.id);

    const fingerprintFailures = results
      .filter(r => !r.fingerprintStable)
      .map(r => r.entry.id);

    return {
      total,
      passed,
      failed,
      passRate: total > 0 ? (passed / total) * 100 : 0,
      validationErrors,
      deterministicFailures,
      fingerprintFailures,
    };
  }
}

export interface CorpusSummary {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  validationErrors: Array<{ id: string; errors: string[] }>;
  deterministicFailures: string[];
  fingerprintFailures: string[];
}

// ============================================================================
// EXPORTS
// ============================================================================

export const mockExtractor = new MockExtractor();
export const corpusRunner = new CorpusRunner();
