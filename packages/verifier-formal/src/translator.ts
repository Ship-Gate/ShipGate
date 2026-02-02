// ============================================================================
// ISL to SMT-LIB Translator
// Main verification orchestration
// ============================================================================

import type * as AST from '../../../master_contracts/ast';
import { encodeSorts } from './encoding/types';
import { encodeExpression } from './encoding/expressions';
import { Z3Solver, Z3Result } from './solver';
import { parseCounterexample } from './counterexample';

// ============================================================================
// TYPES
// ============================================================================

export interface FormalVerifyResult {
  verified: boolean;
  properties: PropertyResult[];
  counterexamples: Counterexample[];
  smtTime: number;
  smtLib?: string; // Include generated SMT-LIB for debugging
}

export interface PropertyResult {
  name: string;
  category: PropertyCategory;
  formula: string;
  result: 'valid' | 'invalid' | 'unknown' | 'timeout';
  counterexample?: Counterexample;
  time: number;
}

export type PropertyCategory =
  | 'precondition-consistency'
  | 'postcondition-reachability'
  | 'invariant-preservation'
  | 'deadlock-freedom'
  | 'specification-completeness'
  | 'type-safety';

export interface Counterexample {
  property: string;
  inputs: Record<string, unknown>;
  state: Record<string, unknown>;
  trace: string[];
  smtModel?: string;
}

export interface VerifyOptions {
  timeout?: number;
  properties?: PropertyCategory[];
  debug?: boolean;
  z3Path?: string;
}

// ============================================================================
// MAIN VERIFICATION FUNCTION
// ============================================================================

/**
 * Verify an ISL domain using SMT-LIB and Z3
 */
export async function verify(
  domain: AST.Domain,
  options: VerifyOptions = {}
): Promise<FormalVerifyResult> {
  const startTime = Date.now();
  const timeout = options.timeout ?? 30000;
  const propertiesToCheck = options.properties ?? [
    'precondition-consistency',
    'postcondition-reachability',
    'invariant-preservation',
    'deadlock-freedom',
    'specification-completeness',
  ];

  const solver = new Z3Solver({ timeout, z3Path: options.z3Path });
  const properties: PropertyResult[] = [];
  const counterexamples: Counterexample[] = [];

  // Generate base SMT-LIB declarations
  const baseSmtLib = generateBaseDeclarations(domain);

  // Check each property category
  for (const category of propertiesToCheck) {
    const categoryProps = await verifyCategory(domain, category, baseSmtLib, solver);
    properties.push(...categoryProps);
    
    for (const prop of categoryProps) {
      if (prop.counterexample) {
        counterexamples.push(prop.counterexample);
      }
    }
  }

  const smtTime = Date.now() - startTime;
  const verified = properties.every(p => p.result === 'valid');

  return {
    verified,
    properties,
    counterexamples,
    smtTime,
    smtLib: options.debug ? baseSmtLib : undefined,
  };
}

// ============================================================================
// BASE DECLARATIONS
// ============================================================================

function generateBaseDeclarations(domain: AST.Domain): string {
  const lines: string[] = [];

  // Header
  lines.push('; ============================================================================');
  lines.push(`; SMT-LIB encoding for domain: ${domain.name.name}`);
  lines.push(`; Version: ${domain.version.value}`);
  lines.push('; ============================================================================');
  lines.push('');
  lines.push('(set-logic ALL)');
  lines.push('(set-option :produce-models true)');
  lines.push('');

  // Encode built-in sorts
  lines.push('; Built-in sorts');
  lines.push('(declare-sort UUID 0)');
  lines.push('(declare-sort Timestamp 0)');
  lines.push('(declare-sort Duration 0)');
  lines.push('');

  // Encode custom types
  lines.push('; Custom types');
  for (const type of domain.types) {
    lines.push(encodeSorts(type));
  }
  lines.push('');

  // Encode enums
  lines.push('; Enums');
  for (const type of domain.types) {
    if (type.definition.kind === 'EnumType') {
      lines.push(encodeEnum(type.name.name, type.definition));
    }
  }
  lines.push('');

  // Encode entities
  lines.push('; Entity sorts and functions');
  for (const entity of domain.entities) {
    lines.push(encodeEntity(entity));
  }
  lines.push('');

  // Encode entity existence predicates
  lines.push('; Entity existence predicates');
  for (const entity of domain.entities) {
    const name = entity.name.name;
    lines.push(`(declare-fun ${name.toLowerCase()}-exists (${name}) Bool)`);
  }
  lines.push('');

  return lines.join('\n');
}

function encodeEnum(name: string, enumType: AST.EnumType): string {
  const variants = enumType.variants.map((v, i) => 
    `(declare-const ${name}-${v.name.name} Int)\n(assert (= ${name}-${v.name.name} ${i}))`
  ).join('\n');
  return `; Enum ${name}\n${variants}`;
}

function encodeEntity(entity: AST.Entity): string {
  const lines: string[] = [];
  const name = entity.name.name;

  // Declare entity sort
  lines.push(`(declare-sort ${name} 0)`);

  // Declare field accessor functions
  for (const field of entity.fields) {
    const fieldName = field.name.name;
    const fieldType = typeToSmtSort(field.type);
    lines.push(`(declare-fun ${name.toLowerCase()}-${fieldName} (${name}) ${fieldType})`);
  }

  return lines.join('\n');
}

// ============================================================================
// CATEGORY VERIFICATION
// ============================================================================

async function verifyCategory(
  domain: AST.Domain,
  category: PropertyCategory,
  baseSmtLib: string,
  solver: Z3Solver
): Promise<PropertyResult[]> {
  switch (category) {
    case 'precondition-consistency':
      return verifyPreconditionConsistency(domain, baseSmtLib, solver);
    case 'postcondition-reachability':
      return verifyPostconditionReachability(domain, baseSmtLib, solver);
    case 'invariant-preservation':
      return verifyInvariantPreservation(domain, baseSmtLib, solver);
    case 'deadlock-freedom':
      return verifyDeadlockFreedom(domain, baseSmtLib, solver);
    case 'specification-completeness':
      return verifySpecificationCompleteness(domain, baseSmtLib, solver);
    default:
      return [];
  }
}

// ============================================================================
// PRECONDITION CONSISTENCY
// ============================================================================

async function verifyPreconditionConsistency(
  domain: AST.Domain,
  baseSmtLib: string,
  solver: Z3Solver
): Promise<PropertyResult[]> {
  const results: PropertyResult[] = [];

  for (const behavior of domain.behaviors) {
    if (behavior.preconditions.length === 0) continue;

    const propName = `precond-consistent-${behavior.name.name}`;
    const smtLib = buildPreconditionQuery(domain, behavior, baseSmtLib);
    
    const startTime = Date.now();
    const z3Result = await solver.checkSat(smtLib);
    const time = Date.now() - startTime;

    const result: PropertyResult = {
      name: propName,
      category: 'precondition-consistency',
      formula: formatPreconditionFormula(behavior),
      result: z3ResultToVerdict(z3Result, true), // sat means consistent
      time,
    };

    if (z3Result.status === 'unsat') {
      result.counterexample = {
        property: propName,
        inputs: {},
        state: {},
        trace: ['Preconditions are mutually unsatisfiable'],
      };
    }

    results.push(result);
  }

  return results;
}

function buildPreconditionQuery(
  domain: AST.Domain,
  behavior: AST.Behavior,
  baseSmtLib: string
): string {
  const lines: string[] = [baseSmtLib];

  // Declare input variables
  lines.push(`; Input for ${behavior.name.name}`);
  for (const field of behavior.input.fields) {
    const smtType = typeToSmtSort(field.type);
    lines.push(`(declare-const input-${field.name.name} ${smtType})`);
  }
  lines.push('');

  // Assert all preconditions
  lines.push('; Preconditions');
  for (const pre of behavior.preconditions) {
    const encoded = encodeExpression(pre, { prefix: 'input' });
    lines.push(`(assert ${encoded})`);
  }
  lines.push('');

  // Check if preconditions can be satisfied together
  lines.push('(check-sat)');
  lines.push('(get-model)');

  return lines.join('\n');
}

function formatPreconditionFormula(behavior: AST.Behavior): string {
  return `∃ input. ${behavior.preconditions.map(p => formatExpr(p)).join(' ∧ ')}`;
}

// ============================================================================
// POSTCONDITION REACHABILITY
// ============================================================================

async function verifyPostconditionReachability(
  domain: AST.Domain,
  baseSmtLib: string,
  solver: Z3Solver
): Promise<PropertyResult[]> {
  const results: PropertyResult[] = [];

  for (const behavior of domain.behaviors) {
    for (const postBlock of behavior.postconditions) {
      const condName = typeof postBlock.condition === 'string' 
        ? postBlock.condition 
        : postBlock.condition.name;
      
      const propName = `postcond-reachable-${behavior.name.name}-${condName}`;
      const smtLib = buildPostconditionQuery(domain, behavior, postBlock, baseSmtLib);
      
      const startTime = Date.now();
      const z3Result = await solver.checkSat(smtLib);
      const time = Date.now() - startTime;

      const result: PropertyResult = {
        name: propName,
        category: 'postcondition-reachability',
        formula: formatPostconditionFormula(behavior, postBlock),
        result: z3ResultToVerdict(z3Result, true), // sat means reachable
        time,
      };

      if (z3Result.status === 'unsat') {
        result.counterexample = {
          property: propName,
          inputs: {},
          state: {},
          trace: [`Postcondition for ${condName} is unreachable`],
        };
      }

      results.push(result);
    }
  }

  return results;
}

function buildPostconditionQuery(
  domain: AST.Domain,
  behavior: AST.Behavior,
  postBlock: AST.PostconditionBlock,
  baseSmtLib: string
): string {
  const lines: string[] = [baseSmtLib];

  // Declare input variables
  lines.push(`; Input for ${behavior.name.name}`);
  for (const field of behavior.input.fields) {
    const smtType = typeToSmtSort(field.type);
    lines.push(`(declare-const input-${field.name.name} ${smtType})`);
  }
  lines.push('');

  // Declare result variable
  lines.push('; Result');
  const resultType = typeToSmtSort(behavior.output.success);
  lines.push(`(declare-const result ${resultType})`);
  lines.push('');

  // Declare old state functions
  lines.push('; Old state');
  for (const entity of domain.entities) {
    const name = entity.name.name;
    lines.push(`(declare-fun old-${name.toLowerCase()}-exists (${name}) Bool)`);
    for (const field of entity.fields) {
      const fieldType = typeToSmtSort(field.type);
      lines.push(`(declare-fun old-${name.toLowerCase()}-${field.name.name} (${name}) ${fieldType})`);
    }
  }
  lines.push('');

  // Assert postconditions
  lines.push('; Postconditions');
  for (const pred of postBlock.predicates) {
    const encoded = encodeExpression(pred, { prefix: 'input', hasOld: true });
    lines.push(`(assert ${encoded})`);
  }
  lines.push('');

  lines.push('(check-sat)');
  lines.push('(get-model)');

  return lines.join('\n');
}

function formatPostconditionFormula(behavior: AST.Behavior, block: AST.PostconditionBlock): string {
  const condName = typeof block.condition === 'string' ? block.condition : block.condition.name;
  return `${condName} ⟹ ${block.predicates.map(p => formatExpr(p)).join(' ∧ ')}`;
}

// ============================================================================
// INVARIANT PRESERVATION
// ============================================================================

async function verifyInvariantPreservation(
  domain: AST.Domain,
  baseSmtLib: string,
  solver: Z3Solver
): Promise<PropertyResult[]> {
  const results: PropertyResult[] = [];

  // Check entity invariants
  for (const entity of domain.entities) {
    for (let i = 0; i < entity.invariants.length; i++) {
      const inv = entity.invariants[i];
      const propName = `invariant-${entity.name.name}-${i}`;
      const smtLib = buildInvariantQuery(domain, entity, inv, baseSmtLib);
      
      const startTime = Date.now();
      const z3Result = await solver.checkSat(smtLib);
      const time = Date.now() - startTime;

      // unsat means invariant is preserved (no counterexample found)
      const result: PropertyResult = {
        name: propName,
        category: 'invariant-preservation',
        formula: `∀ e: ${entity.name.name}. ${formatExpr(inv)}`,
        result: z3ResultToVerdict(z3Result, false), // unsat means valid
        time,
      };

      if (z3Result.status === 'sat' && z3Result.model) {
        result.counterexample = parseCounterexample(z3Result.model, propName);
      }

      results.push(result);
    }
  }

  // Check global invariants
  for (const invBlock of domain.invariants) {
    for (let i = 0; i < invBlock.predicates.length; i++) {
      const pred = invBlock.predicates[i];
      const propName = `global-invariant-${invBlock.name.name}-${i}`;
      const smtLib = buildGlobalInvariantQuery(domain, pred, baseSmtLib);
      
      const startTime = Date.now();
      const z3Result = await solver.checkSat(smtLib);
      const time = Date.now() - startTime;

      const result: PropertyResult = {
        name: propName,
        category: 'invariant-preservation',
        formula: formatExpr(pred),
        result: z3ResultToVerdict(z3Result, false),
        time,
      };

      if (z3Result.status === 'sat' && z3Result.model) {
        result.counterexample = parseCounterexample(z3Result.model, propName);
      }

      results.push(result);
    }
  }

  return results;
}

function buildInvariantQuery(
  domain: AST.Domain,
  entity: AST.Entity,
  invariant: AST.Expression,
  baseSmtLib: string
): string {
  const lines: string[] = [baseSmtLib];
  const name = entity.name.name;

  // Declare an entity instance
  lines.push(`; Entity instance for invariant check`);
  lines.push(`(declare-const e ${name})`);
  lines.push(`(assert (${name.toLowerCase()}-exists e))`);
  lines.push('');

  // Assert negation of invariant (looking for counterexample)
  lines.push('; Negated invariant (looking for counterexample)');
  const encoded = encodeExpression(invariant, { entityVar: 'e', entityName: name });
  lines.push(`(assert (not ${encoded}))`);
  lines.push('');

  lines.push('(check-sat)');
  lines.push('(get-model)');

  return lines.join('\n');
}

function buildGlobalInvariantQuery(
  domain: AST.Domain,
  invariant: AST.Expression,
  baseSmtLib: string
): string {
  const lines: string[] = [baseSmtLib];

  // Assert negation of invariant
  lines.push('; Negated global invariant');
  const encoded = encodeExpression(invariant, {});
  lines.push(`(assert (not ${encoded}))`);
  lines.push('');

  lines.push('(check-sat)');
  lines.push('(get-model)');

  return lines.join('\n');
}

// ============================================================================
// DEADLOCK FREEDOM
// ============================================================================

async function verifyDeadlockFreedom(
  domain: AST.Domain,
  baseSmtLib: string,
  solver: Z3Solver
): Promise<PropertyResult[]> {
  const results: PropertyResult[] = [];

  for (const entity of domain.entities) {
    if (!entity.lifecycle) continue;

    const propName = `deadlock-free-${entity.name.name}`;
    const smtLib = buildDeadlockQuery(domain, entity, baseSmtLib);
    
    const startTime = Date.now();
    const z3Result = await solver.checkSat(smtLib);
    const time = Date.now() - startTime;

    const result: PropertyResult = {
      name: propName,
      category: 'deadlock-freedom',
      formula: `∀ state ∈ non-terminal. ∃ transition`,
      result: z3ResultToVerdict(z3Result, false), // unsat means no deadlock
      time,
    };

    if (z3Result.status === 'sat' && z3Result.model) {
      result.counterexample = parseCounterexample(z3Result.model, propName);
      result.counterexample.trace = ['Found state with no outgoing transitions'];
    }

    results.push(result);
  }

  return results;
}

function buildDeadlockQuery(
  domain: AST.Domain,
  entity: AST.Entity,
  baseSmtLib: string
): string {
  const lines: string[] = [baseSmtLib];
  const name = entity.name.name;

  if (!entity.lifecycle) {
    return baseSmtLib + '\n(check-sat)';
  }

  // Collect states
  const fromStates = new Set<string>();
  const toStates = new Set<string>();
  
  for (const t of entity.lifecycle.transitions) {
    fromStates.add(t.from.name);
    toStates.add(t.to.name);
  }

  // Terminal states are only in 'to', never in 'from'
  const terminalStates = [...toStates].filter(s => !fromStates.has(s));
  const nonTerminalStates = [...fromStates];

  // Declare state variable
  lines.push(`; State encoding for ${name}`);
  nonTerminalStates.forEach((state, i) => {
    lines.push(`(declare-const state-${state} Int)`);
    lines.push(`(assert (= state-${state} ${i}))`);
  });
  terminalStates.forEach((state, i) => {
    lines.push(`(declare-const state-${state} Int)`);
    lines.push(`(assert (= state-${state} ${nonTerminalStates.length + i}))`);
  });
  lines.push('');

  // Declare current state
  lines.push('(declare-const current-state Int)');
  lines.push('');

  // Assert current state is non-terminal but has no outgoing transitions
  lines.push('; Looking for non-terminal state with no outgoing transitions');
  const nonTerminalConstraint = nonTerminalStates
    .map(s => `(= current-state state-${s})`)
    .join(' ');
  if (nonTerminalStates.length > 0) {
    lines.push(`(assert (or ${nonTerminalConstraint}))`);
  }

  // For a deadlock, assert that no transition is possible
  // This is a simplified check - real implementation would be more sophisticated
  lines.push('');
  lines.push('(check-sat)');
  lines.push('(get-model)');

  return lines.join('\n');
}

// ============================================================================
// SPECIFICATION COMPLETENESS
// ============================================================================

async function verifySpecificationCompleteness(
  domain: AST.Domain,
  baseSmtLib: string,
  solver: Z3Solver
): Promise<PropertyResult[]> {
  const results: PropertyResult[] = [];

  for (const behavior of domain.behaviors) {
    const propName = `spec-complete-${behavior.name.name}`;
    const smtLib = buildCompletenessQuery(domain, behavior, baseSmtLib);
    
    const startTime = Date.now();
    const z3Result = await solver.checkSat(smtLib);
    const time = Date.now() - startTime;

    // unsat means every input leads to success or a defined error
    const result: PropertyResult = {
      name: propName,
      category: 'specification-completeness',
      formula: `∀ input. success ∨ ${behavior.output.errors.map(e => e.name.name).join(' ∨ ')}`,
      result: z3ResultToVerdict(z3Result, false),
      time,
    };

    if (z3Result.status === 'sat' && z3Result.model) {
      result.counterexample = parseCounterexample(z3Result.model, propName);
      result.counterexample.trace = ['Found input that leads to undefined behavior'];
    }

    results.push(result);
  }

  return results;
}

function buildCompletenessQuery(
  domain: AST.Domain,
  behavior: AST.Behavior,
  baseSmtLib: string
): string {
  const lines: string[] = [baseSmtLib];

  // Declare input variables
  lines.push(`; Input for ${behavior.name.name}`);
  for (const field of behavior.input.fields) {
    const smtType = typeToSmtSort(field.type);
    lines.push(`(declare-const input-${field.name.name} ${smtType})`);
  }
  lines.push('');

  // Declare outcome flags
  lines.push('; Outcome flags');
  lines.push('(declare-const outcome-success Bool)');
  for (const error of behavior.output.errors) {
    lines.push(`(declare-const outcome-${error.name.name} Bool)`);
  }
  lines.push('');

  // Assert that none of the outcomes is true (looking for uncovered case)
  lines.push('; Looking for input with no defined outcome');
  const allOutcomes = ['outcome-success', ...behavior.output.errors.map(e => `outcome-${e.name.name}`)];
  lines.push(`(assert (not (or ${allOutcomes.join(' ')})))`);
  lines.push('');

  lines.push('(check-sat)');
  lines.push('(get-model)');

  return lines.join('\n');
}

// ============================================================================
// HELPERS
// ============================================================================

function typeToSmtSort(type: AST.TypeDefinition): string {
  switch (type.kind) {
    case 'PrimitiveType':
      return primitiveToSmtSort(type.name);
    case 'ReferenceType':
      return type.name.parts.map(p => p.name).join('_');
    case 'ListType':
      return `(Array Int ${typeToSmtSort(type.element)})`;
    case 'MapType':
      return `(Array ${typeToSmtSort(type.key)} ${typeToSmtSort(type.value)})`;
    case 'OptionalType':
      return typeToSmtSort(type.inner); // Simplified
    case 'ConstrainedType':
      return typeToSmtSort(type.base);
    case 'EnumType':
      return 'Int';
    case 'StructType':
      return 'Int'; // Simplified - would need proper encoding
    case 'UnionType':
      return 'Int'; // Simplified
    default:
      return 'Int';
  }
}

function primitiveToSmtSort(name: string): string {
  switch (name) {
    case 'String':
      return 'String';
    case 'Int':
      return 'Int';
    case 'Decimal':
      return 'Real';
    case 'Boolean':
      return 'Bool';
    case 'Timestamp':
      return 'Timestamp';
    case 'UUID':
      return 'UUID';
    case 'Duration':
      return 'Duration';
    default:
      return 'Int';
  }
}

function z3ResultToVerdict(result: Z3Result, satMeansValid: boolean): PropertyResult['result'] {
  if (result.status === 'timeout') return 'timeout';
  if (result.status === 'unknown') return 'unknown';
  
  if (satMeansValid) {
    return result.status === 'sat' ? 'valid' : 'invalid';
  } else {
    return result.status === 'unsat' ? 'valid' : 'invalid';
  }
}

function formatExpr(expr: AST.Expression): string {
  switch (expr.kind) {
    case 'Identifier':
      return expr.name;
    case 'QualifiedName':
      return expr.parts.map(p => p.name).join('.');
    case 'BinaryExpr':
      return `(${formatExpr(expr.left)} ${expr.operator} ${formatExpr(expr.right)})`;
    case 'UnaryExpr':
      return `(${expr.operator} ${formatExpr(expr.operand)})`;
    case 'CallExpr':
      return `${formatExpr(expr.callee)}(${expr.arguments.map(formatExpr).join(', ')})`;
    case 'MemberExpr':
      return `${formatExpr(expr.object)}.${expr.property.name}`;
    case 'NumberLiteral':
      return String(expr.value);
    case 'BooleanLiteral':
      return String(expr.value);
    case 'StringLiteral':
      return `"${expr.value}"`;
    default:
      return '...';
  }
}
