// ============================================================================
// Authoritative ISL to SMT-LIB Translator
// Produces authoritative verdicts with proper degradation
// ============================================================================

import type * as AST from '../../../master_contracts/ast';
import { encodeSorts, typeDefToSmt } from './encoding/types';
import { encodeExpression } from './encoding/expressions';
import { AuthoritativeSolver, AuthoritativeSolverOptions, SolverResult } from './authoritative-solver';
import {
  Verdict,
  UnknownReason,
  aggregateVerdicts,
  formatVerdict,
  createUnknownVerdict,
  createUnsupportedFeatureReason,
} from './verdict';
import { analyzeComplexity, ComplexityLimits, DEFAULT_LIMITS } from './complexity';

// ============================================================================
// TYPES
// ============================================================================

export interface AuthoritativeVerifyResult {
  verified: boolean;
  overallVerdict: 'proved' | 'disproved' | 'unknown';
  properties: AuthoritativePropertyResult[];
  summary: VerificationSummary;
  smtTime: number;
}

export interface AuthoritativePropertyResult {
  name: string;
  category: PropertyCategory;
  formula: string;
  verdict: Verdict;
}

export interface VerificationSummary {
  totalProperties: number;
  provedCount: number;
  disprovedCount: number;
  unknownCount: number;
  unknownReasons: UnknownReason[];
}

export type PropertyCategory =
  | 'precondition-satisfiability'
  | 'postcondition-reachability'
  | 'invariant-preservation'
  | 'type-constraint'
  | 'behavioral-correctness';

export interface AuthoritativeVerifyOptions {
  timeout?: number;
  z3Path?: string;
  complexityLimits?: ComplexityLimits;
  properties?: PropertyCategory[];
  debug?: boolean;
}

// ============================================================================
// MAIN VERIFICATION FUNCTION
// ============================================================================

/**
 * Verify an ISL domain with authoritative verdicts
 */
export async function verifyAuthoritative(
  domain: AST.Domain,
  options: AuthoritativeVerifyOptions = {}
): Promise<AuthoritativeVerifyResult> {
  const startTime = Date.now();
  
  const solver = new AuthoritativeSolver({
    timeout: options.timeout ?? 30000,
    z3Path: options.z3Path,
    complexityLimits: options.complexityLimits ?? DEFAULT_LIMITS,
    debug: options.debug,
  });

  const propertiesToCheck = options.properties ?? [
    'precondition-satisfiability',
    'postcondition-reachability',
    'invariant-preservation',
    'type-constraint',
  ];

  const baseSmtLib = generateBaseDeclarations(domain);
  const properties: AuthoritativePropertyResult[] = [];

  // Check each property category
  for (const category of propertiesToCheck) {
    const categoryProps = await verifyCategory(domain, category, baseSmtLib, solver);
    properties.push(...categoryProps);
  }

  // Aggregate results
  const verdicts = properties.map(p => p.verdict);
  const aggregated = aggregateVerdicts(verdicts);

  const smtTime = Date.now() - startTime;

  return {
    verified: aggregated.overall === 'proved',
    overallVerdict: aggregated.overall,
    properties,
    summary: {
      totalProperties: properties.length,
      provedCount: aggregated.provedCount,
      disprovedCount: aggregated.disprovedCount,
      unknownCount: aggregated.unknownCount,
      unknownReasons: aggregated.unknownReasons,
    },
    smtTime,
  };
}

// ============================================================================
// BASE DECLARATIONS
// ============================================================================

function generateBaseDeclarations(domain: AST.Domain): string {
  const lines: string[] = [];

  lines.push('; ============================================================================');
  lines.push(`; SMT-LIB encoding for domain: ${domain.name.name}`);
  lines.push(`; Generated for authoritative verification`);
  lines.push('; ============================================================================');
  lines.push('');
  lines.push('(set-logic ALL)');
  lines.push('(set-option :produce-models true)');
  lines.push('(set-option :timeout 30000)');
  lines.push('');

  // Built-in sorts
  lines.push('; Built-in sorts');
  lines.push('(declare-sort UUID 0)');
  lines.push('(declare-sort Timestamp 0)');
  lines.push('(declare-sort Duration 0)');
  lines.push('');

  // Custom types
  if (domain.types.length > 0) {
    lines.push('; Custom types');
    for (const type of domain.types) {
      lines.push(encodeSorts(type));
    }
    lines.push('');
  }

  // Entities
  if (domain.entities.length > 0) {
    lines.push('; Entities');
    for (const entity of domain.entities) {
      lines.push(encodeEntity(entity));
    }
    lines.push('');
  }

  return lines.join('\n');
}

function encodeEntity(entity: AST.Entity): string {
  const lines: string[] = [];
  const name = entity.name.name;

  lines.push(`(declare-sort ${name} 0)`);

  for (const field of entity.fields) {
    const fieldName = field.name.name;
    const fieldType = typeToSmtSort(field.type);
    lines.push(`(declare-fun ${name.toLowerCase()}-${fieldName} (${name}) ${fieldType})`);
  }

  lines.push(`(declare-fun ${name.toLowerCase()}-exists (${name}) Bool)`);

  return lines.join('\n');
}

// ============================================================================
// CATEGORY VERIFICATION
// ============================================================================

async function verifyCategory(
  domain: AST.Domain,
  category: PropertyCategory,
  baseSmtLib: string,
  solver: AuthoritativeSolver
): Promise<AuthoritativePropertyResult[]> {
  switch (category) {
    case 'precondition-satisfiability':
      return verifyPreconditions(domain, baseSmtLib, solver);
    case 'postcondition-reachability':
      return verifyPostconditions(domain, baseSmtLib, solver);
    case 'invariant-preservation':
      return verifyInvariants(domain, baseSmtLib, solver);
    case 'type-constraint':
      return verifyTypeConstraints(domain, baseSmtLib, solver);
    default:
      return [];
  }
}

// ============================================================================
// PRECONDITION VERIFICATION
// ============================================================================

async function verifyPreconditions(
  domain: AST.Domain,
  baseSmtLib: string,
  solver: AuthoritativeSolver
): Promise<AuthoritativePropertyResult[]> {
  const results: AuthoritativePropertyResult[] = [];

  for (const behavior of domain.behaviors) {
    if (behavior.preconditions.length === 0) continue;

    const propName = `precond-sat-${behavior.name.name}`;
    const formula = formatPreconditionFormula(behavior);
    
    try {
      const smtLib = buildPreconditionQuery(domain, behavior, baseSmtLib);
      const solverResult = await solver.verify(smtLib);

      // For precondition satisfiability: SAT means satisfiable (good)
      // We need to invert the logic: we want to prove preconditions CAN be satisfied
      const verdict = invertVerdictForSatisfiability(solverResult.verdict);

      results.push({
        name: propName,
        category: 'precondition-satisfiability',
        formula,
        verdict,
      });
    } catch (error) {
      results.push({
        name: propName,
        category: 'precondition-satisfiability',
        formula,
        verdict: createUnknownVerdict(
          createUnsupportedFeatureReason(
            error instanceof Error ? error.message : 'translation-error'
          ),
          0
        ),
      });
    }
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
  lines.push('; Preconditions (checking if satisfiable)');
  for (const pre of behavior.preconditions) {
    const encoded = encodeExpression(pre, { prefix: 'input' });
    lines.push(`(assert ${encoded})`);
  }
  lines.push('');

  lines.push('(check-sat)');
  lines.push('(get-model)');

  return lines.join('\n');
}

// ============================================================================
// POSTCONDITION VERIFICATION
// ============================================================================

async function verifyPostconditions(
  domain: AST.Domain,
  baseSmtLib: string,
  solver: AuthoritativeSolver
): Promise<AuthoritativePropertyResult[]> {
  const results: AuthoritativePropertyResult[] = [];

  for (const behavior of domain.behaviors) {
    for (const postBlock of behavior.postconditions) {
      const condName = typeof postBlock.condition === 'string'
        ? postBlock.condition
        : postBlock.condition.name;

      const propName = `postcond-reach-${behavior.name.name}-${condName}`;
      const formula = formatPostconditionFormula(behavior, postBlock);

      try {
        const smtLib = buildPostconditionQuery(domain, behavior, postBlock, baseSmtLib);
        const solverResult = await solver.verify(smtLib);

        // For reachability: SAT means reachable (good)
        const verdict = invertVerdictForSatisfiability(solverResult.verdict);

        results.push({
          name: propName,
          category: 'postcondition-reachability',
          formula,
          verdict,
        });
      } catch (error) {
        results.push({
          name: propName,
          category: 'postcondition-reachability',
          formula,
          verdict: createUnknownVerdict(
            createUnsupportedFeatureReason(
              error instanceof Error ? error.message : 'translation-error'
            ),
            0
          ),
        });
      }
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

  // Input variables
  lines.push(`; Input for ${behavior.name.name}`);
  for (const field of behavior.input.fields) {
    const smtType = typeToSmtSort(field.type);
    lines.push(`(declare-const input-${field.name.name} ${smtType})`);
  }
  lines.push('');

  // Result variable
  lines.push('; Result');
  const resultType = typeToSmtSort(behavior.output.success);
  lines.push(`(declare-const result ${resultType})`);
  lines.push('');

  // Old state
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

  // Postconditions
  lines.push('; Postconditions (checking if reachable)');
  for (const pred of postBlock.predicates) {
    const encoded = encodeExpression(pred, { prefix: 'input', hasOld: true });
    lines.push(`(assert ${encoded})`);
  }
  lines.push('');

  lines.push('(check-sat)');
  lines.push('(get-model)');

  return lines.join('\n');
}

// ============================================================================
// INVARIANT VERIFICATION
// ============================================================================

async function verifyInvariants(
  domain: AST.Domain,
  baseSmtLib: string,
  solver: AuthoritativeSolver
): Promise<AuthoritativePropertyResult[]> {
  const results: AuthoritativePropertyResult[] = [];

  // Entity invariants
  for (const entity of domain.entities) {
    for (let i = 0; i < entity.invariants.length; i++) {
      const inv = entity.invariants[i];
      const propName = `inv-${entity.name.name}-${i}`;
      const formula = `∀ e: ${entity.name.name}. ${formatExpr(inv)}`;

      try {
        const smtLib = buildInvariantQuery(domain, entity, inv, baseSmtLib);
        const solverResult = await solver.verify(smtLib);

        // For invariants: UNSAT of negation means invariant holds
        // The query already negates the invariant, so verdict is direct
        results.push({
          name: propName,
          category: 'invariant-preservation',
          formula,
          verdict: solverResult.verdict,
        });
      } catch (error) {
        results.push({
          name: propName,
          category: 'invariant-preservation',
          formula,
          verdict: createUnknownVerdict(
            createUnsupportedFeatureReason(
              error instanceof Error ? error.message : 'translation-error'
            ),
            0
          ),
        });
      }
    }
  }

  // Global invariants
  for (const invBlock of domain.invariants) {
    for (let i = 0; i < invBlock.predicates.length; i++) {
      const pred = invBlock.predicates[i];
      const propName = `global-inv-${invBlock.name.name}-${i}`;
      const formula = formatExpr(pred);

      try {
        const smtLib = buildGlobalInvariantQuery(domain, pred, baseSmtLib);
        const solverResult = await solver.verify(smtLib);

        results.push({
          name: propName,
          category: 'invariant-preservation',
          formula,
          verdict: solverResult.verdict,
        });
      } catch (error) {
        results.push({
          name: propName,
          category: 'invariant-preservation',
          formula,
          verdict: createUnknownVerdict(
            createUnsupportedFeatureReason(
              error instanceof Error ? error.message : 'translation-error'
            ),
            0
          ),
        });
      }
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

  lines.push(`; Invariant check for ${name}`);
  lines.push(`(declare-const e ${name})`);
  lines.push(`(assert (${name.toLowerCase()}-exists e))`);
  lines.push('');

  // Negate invariant to find counterexample
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

  lines.push('; Negated global invariant');
  const encoded = encodeExpression(invariant, {});
  lines.push(`(assert (not ${encoded}))`);
  lines.push('');

  lines.push('(check-sat)');
  lines.push('(get-model)');

  return lines.join('\n');
}

// ============================================================================
// TYPE CONSTRAINT VERIFICATION
// ============================================================================

async function verifyTypeConstraints(
  domain: AST.Domain,
  baseSmtLib: string,
  solver: AuthoritativeSolver
): Promise<AuthoritativePropertyResult[]> {
  const results: AuthoritativePropertyResult[] = [];

  for (const type of domain.types) {
    if (type.definition.kind !== 'ConstrainedType') continue;

    const propName = `type-valid-${type.name.name}`;
    const formula = `∃ x: ${type.name.name}. valid(x)`;

    try {
      const smtLib = buildTypeConstraintQuery(type, baseSmtLib);
      const solverResult = await solver.verify(smtLib);

      // SAT means there exists a valid value
      const verdict = invertVerdictForSatisfiability(solverResult.verdict);

      results.push({
        name: propName,
        category: 'type-constraint',
        formula,
        verdict,
      });
    } catch (error) {
      results.push({
        name: propName,
        category: 'type-constraint',
        formula,
        verdict: createUnknownVerdict(
          createUnsupportedFeatureReason(
            error instanceof Error ? error.message : 'translation-error'
          ),
          0
        ),
      });
    }
  }

  return results;
}

function buildTypeConstraintQuery(
  type: AST.TypeDeclaration,
  baseSmtLib: string
): string {
  const lines: string[] = [baseSmtLib];

  lines.push(`; Type constraint check for ${type.name.name}`);
  lines.push(encodeSorts(type));
  lines.push('');

  const smtSort = typeToSmtSort(type.definition);
  lines.push(`(declare-const x ${smtSort})`);
  lines.push(`(assert (${type.name.name}-valid x))`);
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
      return typeToSmtSort(type.inner);
    case 'ConstrainedType':
      return typeToSmtSort(type.base);
    case 'EnumType':
      return 'Int';
    case 'StructType':
      return 'Int';
    case 'UnionType':
      return 'Int';
    default:
      return 'Int';
  }
}

function primitiveToSmtSort(name: string): string {
  switch (name) {
    case 'String': return 'String';
    case 'Int': return 'Int';
    case 'Decimal': return 'Real';
    case 'Boolean': return 'Bool';
    case 'Timestamp': return 'Int';
    case 'UUID': return 'String';
    case 'Duration': return 'Int';
    default: return 'Int';
  }
}

/**
 * Invert verdict for satisfiability checks
 * For satisfiability: SAT = proved (exists), UNSAT = disproved (impossible)
 */
function invertVerdictForSatisfiability(verdict: Verdict): Verdict {
  if (verdict.kind === 'proved') {
    // Original UNSAT means no model exists - for satisfiability this is disproved
    return {
      kind: 'disproved',
      confidence: 'authoritative',
      counterexample: {
        inputs: {},
        state: {},
        trace: ['No satisfying assignment exists'],
      },
      solverTime: verdict.solverTime,
      smtQuery: verdict.smtQuery,
    };
  }
  
  if (verdict.kind === 'disproved') {
    // Original SAT means model exists - for satisfiability this is proved
    return {
      kind: 'proved',
      confidence: 'authoritative',
      solverTime: verdict.solverTime,
      smtQuery: verdict.smtQuery,
    };
  }
  
  // Unknown stays unknown
  return verdict;
}

function formatPreconditionFormula(behavior: AST.Behavior): string {
  return `∃ input. ${behavior.preconditions.map(p => formatExpr(p)).join(' ∧ ')}`;
}

function formatPostconditionFormula(behavior: AST.Behavior, block: AST.PostconditionBlock): string {
  const condName = typeof block.condition === 'string' ? block.condition : block.condition.name;
  return `${condName} ⟹ ${block.predicates.map(p => formatExpr(p)).join(' ∧ ')}`;
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

// ============================================================================
// REPORTING
// ============================================================================

export function formatVerificationResult(result: AuthoritativeVerifyResult): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('                       AUTHORITATIVE VERIFICATION RESULT                        ');
  lines.push('═══════════════════════════════════════════════════════════════════════════════');
  lines.push('');

  // Overall verdict
  const overallSymbol = result.overallVerdict === 'proved' ? '✓' :
                        result.overallVerdict === 'disproved' ? '✗' : '?';
  lines.push(`Overall: ${overallSymbol} ${result.overallVerdict.toUpperCase()}`);
  lines.push('');

  // Summary
  lines.push('Summary:');
  lines.push(`  Total Properties: ${result.summary.totalProperties}`);
  lines.push(`  ✓ Proved:    ${result.summary.provedCount}`);
  lines.push(`  ✗ Disproved: ${result.summary.disprovedCount}`);
  lines.push(`  ? Unknown:   ${result.summary.unknownCount}`);
  lines.push(`  Time: ${result.smtTime}ms`);
  lines.push('');

  // Properties
  if (result.properties.length > 0) {
    lines.push('Properties:');
    for (const prop of result.properties) {
      lines.push(`  ${formatVerdict(prop.verdict)} - ${prop.name}`);
      if (prop.verdict.kind === 'unknown') {
        lines.push(`      Reason: ${prop.verdict.reason.suggestion}`);
      }
    }
    lines.push('');
  }

  // Unknown reasons
  if (result.summary.unknownReasons.length > 0) {
    lines.push('Unknown Reasons:');
    const reasonCounts = new Map<string, number>();
    for (const reason of result.summary.unknownReasons) {
      const key = reason.type;
      reasonCounts.set(key, (reasonCounts.get(key) || 0) + 1);
    }
    for (const [type, count] of reasonCounts) {
      lines.push(`  ${type}: ${count} occurrence(s)`);
    }
  }

  lines.push('═══════════════════════════════════════════════════════════════════════════════');

  return lines.join('\n');
}
