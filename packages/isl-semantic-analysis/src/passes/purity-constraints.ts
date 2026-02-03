/**
 * Purity & Side-Effect Constraints Pass
 * 
 * Analyzes purity and side effects in ISL specifications:
 * - Marks pure vs impure expressions
 * - Detects state mutations in preconditions (forbidden)
 * - Validates `old()` usage in postconditions only
 * - Identifies non-deterministic calls
 * 
 * @module @isl-lang/semantic-analysis
 */

import type { Diagnostic } from '@isl-lang/errors';
import type {
  DomainDeclaration,
  BehaviorDeclaration,
  Expression,
} from '@isl-lang/isl-core';
import type { SemanticPass, PassContext } from '../types.js';
import { spanToLocation } from '../types.js';

// ============================================================================
// Error Codes
// ============================================================================

const ERRORS = {
  SIDE_EFFECT_IN_PRECONDITION: 'E0400',
  MUTATION_IN_INVARIANT: 'E0401',
  NONDETERMINISTIC_IN_POSTCONDITION: 'E0402',
  COULD_BE_PURE: 'E0403',
  IMPURE_IN_PURE_CONTEXT: 'E0410',
  OLD_OUTSIDE_POSTCONDITION: 'E0411',
  RESULT_OUTSIDE_POSTCONDITION: 'E0412',
  EXTERNAL_CALL_IN_CONSTRAINT: 'E0413',
  ASSIGNMENT_IN_CONSTRAINT: 'E0414',
} as const;

// ============================================================================
// Types
// ============================================================================

type ContextType = 'precondition' | 'postcondition' | 'invariant' | 'temporal' | 'security' | 'other';

interface ImpurityInfo {
  reason: ImpurityReason;
  expression: Expression;
}

type ImpurityReason = 
  | 'mutation'
  | 'external_call'
  | 'nondeterministic'
  | 'io_operation'
  | 'assignment';

interface PurityAnalysisResult {
  pureExpressions: Set<Expression>;
  impureExpressions: Map<Expression, ImpurityInfo>;
  mutations: Set<Expression>;
}

// ============================================================================
// Known impure/mutating functions
// ============================================================================

const MUTATING_METHODS = new Set([
  'push', 'pop', 'shift', 'unshift', 'splice',
  'set', 'delete', 'clear', 'add', 'remove',
  'update', 'insert', 'save', 'persist',
  'write', 'append', 'modify', 'mutate',
  'increment', 'decrement',
]);

const EXTERNAL_CALL_METHODS = new Set([
  'fetch', 'request', 'call', 'invoke',
  'send', 'emit', 'dispatch', 'trigger',
  'notify', 'publish', 'broadcast',
  'log', 'print', 'trace', 'debug',
]);

const NONDETERMINISTIC_METHODS = new Set([
  'random', 'uuid', 'generateId', 'randomInt', 'randomFloat',
  'now', 'currentTime', 'timestamp',
  'today', 'currentDate',
]);

// ============================================================================
// Pass Definition
// ============================================================================

export const PurityConstraintsPass: SemanticPass = {
  id: 'purity-constraints',
  name: 'Purity Constraints',
  description: 'Detects side effects and purity violations in constraints',
  dependencies: ['type-coherence'],
  priority: 85,
  enabledByDefault: true,

  run(ctx: PassContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { ast, filePath } = ctx;

    for (const behavior of ast.behaviors || []) {
      // Check preconditions - must be pure
      diagnostics.push(...checkPreconditions(behavior, filePath));
      
      // Check postconditions - old() and result allowed, but no mutations
      diagnostics.push(...checkPostconditions(behavior, filePath));
      
      // Check invariants - must be pure
      diagnostics.push(...checkInvariants(behavior, filePath));
      
      // Check temporal blocks
      diagnostics.push(...checkTemporalBlock(behavior, filePath));
      
      // Check security blocks
      diagnostics.push(...checkSecurityBlock(behavior, filePath));
    }

    // Check entity invariants
    for (const entity of ast.entities || []) {
      diagnostics.push(...checkEntityInvariants(entity, filePath));
    }

    return diagnostics;
  },
};

export const purityConstraintsPass = PurityConstraintsPass;

// ============================================================================
// Precondition Checks
// ============================================================================

function checkPreconditions(behavior: BehaviorDeclaration, filePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const preconditions = behavior.preconditions;

  if (!preconditions) return diagnostics;

  for (const condition of preconditions.conditions || []) {
    const stmts = condition.statements || [];
    for (const stmt of stmts) {
      if (stmt.expression) {
        diagnostics.push(...checkExpressionPurity(
          stmt.expression,
          'precondition',
          behavior.name.name,
          filePath
        ));
      }
    }

    // Also check guard expressions
    if ((condition as { guard?: Expression }).guard) {
      diagnostics.push(...checkExpressionPurity(
        (condition as { guard: Expression }).guard,
        'precondition',
        behavior.name.name,
        filePath
      ));
    }
  }

  return diagnostics;
}

// ============================================================================
// Postcondition Checks
// ============================================================================

function checkPostconditions(behavior: BehaviorDeclaration, filePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const postconditions = behavior.postconditions;

  if (!postconditions) return diagnostics;

  for (const condition of postconditions.conditions || []) {
    const stmts = condition.statements || [];
    for (const stmt of stmts) {
      if (stmt.expression) {
        // In postconditions, old() and result are allowed, but mutations are not
        diagnostics.push(...checkExpressionPurity(
          stmt.expression,
          'postcondition',
          behavior.name.name,
          filePath
        ));
      }
    }
  }

  return diagnostics;
}

// ============================================================================
// Invariant Checks
// ============================================================================

function checkInvariants(behavior: BehaviorDeclaration, filePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const invariants = behavior.invariants;

  if (!invariants) return diagnostics;

  for (const invariant of invariants) {
    const expr = (invariant as { expression?: Expression }).expression || invariant;
    if (expr && typeof expr === 'object' && 'kind' in expr) {
      diagnostics.push(...checkExpressionPurity(
        expr as Expression,
        'invariant',
        behavior.name.name,
        filePath
      ));
    }
  }

  return diagnostics;
}

function checkEntityInvariants(entity: { name: { name: string }; invariants?: unknown[] }, filePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const invariant of entity.invariants || []) {
    const expr = (invariant as { expression?: Expression }).expression || invariant;
    if (expr && typeof expr === 'object' && 'kind' in expr) {
      diagnostics.push(...checkExpressionPurity(
        expr as Expression,
        'invariant',
        entity.name.name,
        filePath
      ));
    }
  }

  return diagnostics;
}

// ============================================================================
// Temporal/Security Block Checks
// ============================================================================

function checkTemporalBlock(behavior: BehaviorDeclaration, filePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const temporal = behavior.temporal;

  if (!temporal) return diagnostics;

  const reqs = (temporal as { requirements?: Array<{ condition?: Expression }> }).requirements || [];
  for (const req of reqs) {
    if (req.condition) {
      diagnostics.push(...checkExpressionPurity(
        req.condition,
        'temporal',
        behavior.name.name,
        filePath
      ));
    }
  }

  return diagnostics;
}

function checkSecurityBlock(behavior: BehaviorDeclaration, filePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const security = behavior.security;

  if (!security) return diagnostics;

  const reqs = (security as { requirements?: Array<{ expression?: Expression }> }).requirements || [];
  for (const req of reqs) {
    if (req.expression) {
      diagnostics.push(...checkExpressionPurity(
        req.expression,
        'security',
        behavior.name.name,
        filePath
      ));
    }
  }

  return diagnostics;
}

// ============================================================================
// Expression Purity Analysis
// ============================================================================

function checkExpressionPurity(
  expr: Expression,
  context: ContextType,
  parentName: string,
  filePath: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  walkExpression(expr, (node, path) => {
    const diag = analyzeNodePurity(node, context, parentName, filePath, path);
    if (diag) {
      diagnostics.push(diag);
    }
  });

  return diagnostics;
}

function analyzeNodePurity(
  node: Expression,
  context: ContextType,
  parentName: string,
  filePath: string,
  _path: string[]
): Diagnostic | null {
  const nodeKind = (node as { kind: string }).kind;
  
  // Check for old() in wrong context
  if (nodeKind === 'OldExpr' || nodeKind === 'OldExpression') {
    if (context === 'precondition') {
      return {
        code: ERRORS.OLD_OUTSIDE_POSTCONDITION,
        category: 'semantic',
        severity: 'error',
        message: `'old()' cannot be used in preconditions`,
        location: getNodeLocation(node, filePath),
        source: 'verifier',
        notes: [
          `In ${context} of '${parentName}'`,
          'old() captures pre-execution state and is only valid in postconditions',
        ],
        help: [
          'In preconditions, reference values directly without old()',
          'Move the check to a postcondition if you need to compare old vs new values',
        ],
      };
    }
    if (context === 'invariant') {
      return {
        code: ERRORS.OLD_OUTSIDE_POSTCONDITION,
        category: 'semantic',
        severity: 'error',
        message: `'old()' cannot be used in invariants`,
        location: getNodeLocation(node, filePath),
        source: 'verifier',
        notes: [
          `In invariant of '${parentName}'`,
          'Invariants describe properties that are always true',
        ],
        help: [
          'Use postconditions for comparing old vs new values',
        ],
      };
    }
  }

  // Check for result in wrong context
  if (nodeKind === 'ResultExpr' || nodeKind === 'ResultExpression') {
    if (context === 'precondition') {
      return {
        code: ERRORS.RESULT_OUTSIDE_POSTCONDITION,
        category: 'semantic',
        severity: 'error',
        message: `'result' cannot be referenced in preconditions`,
        location: getNodeLocation(node, filePath),
        source: 'verifier',
        notes: [
          `In precondition of '${parentName}'`,
          'result refers to the return value, which does not exist before execution',
        ],
        help: [
          'Preconditions are checked BEFORE execution',
          'Use input fields instead',
        ],
      };
    }
  }

  // Check for mutating method calls
  if (nodeKind === 'CallExpr' || nodeKind === 'CallExpression') {
    const methodName = getMethodName(node);
    
    if (methodName && MUTATING_METHODS.has(methodName)) {
      if (context === 'precondition') {
        return {
          code: ERRORS.SIDE_EFFECT_IN_PRECONDITION,
          category: 'semantic',
          severity: 'error',
          message: `Mutating method '${methodName}()' cannot be called in preconditions`,
          location: getNodeLocation(node, filePath),
          source: 'verifier',
          notes: [
            `In precondition of '${parentName}'`,
            'Preconditions must be pure (no side effects)',
          ],
          help: [
            'Remove the mutation from the precondition',
            'Use a read-only check instead',
          ],
        };
      }
      if (context === 'invariant') {
        return {
          code: ERRORS.MUTATION_IN_INVARIANT,
          category: 'semantic',
          severity: 'error',
          message: `Mutating method '${methodName}()' cannot be called in invariants`,
          location: getNodeLocation(node, filePath),
          source: 'verifier',
          notes: [
            `In invariant of '${parentName}'`,
            'Invariants must be pure observation only',
          ],
          help: [
            'Remove the mutation',
            'Invariants should only read and compare values',
          ],
        };
      }
      if (context === 'postcondition') {
        return {
          code: ERRORS.SIDE_EFFECT_IN_PRECONDITION,
          category: 'semantic',
          severity: 'error',
          message: `Mutating method '${methodName}()' cannot be called in postconditions`,
          location: getNodeLocation(node, filePath),
          source: 'verifier',
          notes: [
            `In postcondition of '${parentName}'`,
            'Postconditions describe outcomes, not actions',
          ],
          help: [
            'Postconditions should verify the result of mutations, not perform them',
          ],
        };
      }
    }

    if (methodName && EXTERNAL_CALL_METHODS.has(methodName)) {
      if (context !== 'other') {
        return {
          code: ERRORS.EXTERNAL_CALL_IN_CONSTRAINT,
          category: 'semantic',
          severity: 'error',
          message: `External call '${methodName}()' cannot be used in ${context}s`,
          location: getNodeLocation(node, filePath),
          source: 'verifier',
          notes: [
            `In ${context} of '${parentName}'`,
            'Constraints must not make external calls',
          ],
          help: [
            'Move external calls to the behavior implementation',
            'Use input parameters to pass pre-fetched data',
          ],
        };
      }
    }

    if (methodName && NONDETERMINISTIC_METHODS.has(methodName)) {
      if (context === 'postcondition') {
        return {
          code: ERRORS.NONDETERMINISTIC_IN_POSTCONDITION,
          category: 'semantic',
          severity: 'warning',
          message: `Non-deterministic call '${methodName}()' in postcondition may cause verification issues`,
          location: getNodeLocation(node, filePath),
          source: 'verifier',
          notes: [
            `In postcondition of '${parentName}'`,
            'Non-deterministic values make postconditions hard to verify',
          ],
          help: [
            'Capture the value in the result instead',
            'Or use old() to reference the pre-execution value if applicable',
          ],
        };
      }
      if (context === 'precondition' || context === 'invariant') {
        return {
          code: ERRORS.NONDETERMINISTIC_IN_POSTCONDITION,
          category: 'semantic',
          severity: 'warning',
          message: `Non-deterministic call '${methodName}()' in ${context} may cause unpredictable behavior`,
          location: getNodeLocation(node, filePath),
          source: 'verifier',
          notes: [
            `In ${context} of '${parentName}'`,
            'Each evaluation may yield different results',
          ],
          help: [
            'Pass the value as an input parameter instead',
          ],
        };
      }
    }
  }

  // Check for assignment expressions
  if (nodeKind === 'AssignmentExpression' || nodeKind === 'AssignmentExpr') {
    if (context !== 'other') {
      return {
        code: ERRORS.ASSIGNMENT_IN_CONSTRAINT,
        category: 'semantic',
        severity: 'error',
        message: `Assignment cannot be used in ${context}s`,
        location: getNodeLocation(node, filePath),
        source: 'verifier',
        notes: [
          `In ${context} of '${parentName}'`,
          'Constraints must be pure expressions',
        ],
        help: [
          'Use comparison (==) instead of assignment (=)',
          'Constraints describe properties, not actions',
        ],
      };
    }
  }

  return null;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getMethodName(node: Expression): string | null {
  const call = node as {
    callee?: {
      kind?: string;
      name?: string;
      property?: { name?: string };
    };
  };

  if (call.callee?.kind === 'Identifier') {
    return call.callee.name || null;
  }

  if (call.callee?.kind === 'MemberExpression' || call.callee?.kind === 'MemberExpr') {
    return call.callee.property?.name || null;
  }

  return null;
}

function getNodeLocation(node: Expression, filePath: string) {
  const nodeWithSpan = node as { span?: { start: { line: number; column: number; offset?: number }; end: { line: number; column: number; offset?: number } } };
  if (nodeWithSpan.span) {
    const span = {
      start: { 
        line: nodeWithSpan.span.start.line, 
        column: nodeWithSpan.span.start.column, 
        offset: nodeWithSpan.span.start.offset ?? 0 
      },
      end: { 
        line: nodeWithSpan.span.end.line, 
        column: nodeWithSpan.span.end.column, 
        offset: nodeWithSpan.span.end.offset ?? 0 
      },
    };
    return spanToLocation(span, filePath);
  }
  return {
    file: filePath,
    line: 1,
    column: 1,
    endLine: 1,
    endColumn: 1,
  };
}

function walkExpression(
  expr: Expression,
  visitor: (node: Expression, path: string[]) => void,
  path: string[] = []
): void {
  if (!expr || typeof expr !== 'object') return;

  visitor(expr, path);

  const e = expr as unknown as Record<string, unknown>;

  // Walk all expression properties
  const expressionProps = [
    'left', 'right', 'operand', 'object', 'property',
    'callee', 'condition', 'thenBranch', 'elseBranch',
    'expression', 'value', 'test', 'consequent', 'alternate',
    'body', 'predicate', 'collection', 'init', 'update',
  ];

  for (const prop of expressionProps) {
    if (e[prop] && typeof e[prop] === 'object') {
      walkExpression(e[prop] as Expression, visitor, [...path, prop]);
    }
  }

  // Walk arrays
  const arrayProps = ['arguments', 'elements', 'entries', 'params', 'cases'];
  for (const prop of arrayProps) {
    if (Array.isArray(e[prop])) {
      for (let i = 0; i < (e[prop] as unknown[]).length; i++) {
        const item = (e[prop] as unknown[])[i];
        if (item && typeof item === 'object') {
          walkExpression(item as Expression, visitor, [...path, prop, String(i)]);
        }
      }
    }
  }
}

// ============================================================================
// Exports for Testing
// ============================================================================

export const _internals = {
  checkExpressionPurity,
  analyzeNodePurity,
  getMethodName,
  walkExpression,
  MUTATING_METHODS,
  EXTERNAL_CALL_METHODS,
  NONDETERMINISTIC_METHODS,
  ERRORS,
};
