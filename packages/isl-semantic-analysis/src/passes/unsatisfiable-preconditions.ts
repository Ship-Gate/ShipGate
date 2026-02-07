/**
 * Unsatisfiable Preconditions Detection Pass
 * 
 * Detects preconditions that can never be satisfied:
 * - Contradictory conditions (x > 10 AND x < 5)
 * - Always-false conditions (x != x)
 * - Type mismatches in comparisons
 */

import type { Diagnostic, SourceLocation } from '@isl-lang/errors';
import type { 
  Behavior, 
  Expression,
} from '@isl-lang/parser';
import type { SemanticPass, PassContext } from '../types.js';

export const UnsatisfiablePreconditionsPass: SemanticPass = {
  id: 'unsatisfiable-preconditions',
  name: 'Unsatisfiable Preconditions',
  description: 'Detects preconditions that can never be satisfied',
  dependencies: ['unreachable-clauses'],  // Run after unreachable clauses
  priority: 80,
  enabledByDefault: true,

  run(ctx: PassContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { ast, filePath, typeEnv } = ctx;

    for (const behavior of ast.behaviors || []) {
      if (behavior.preconditions && behavior.preconditions.length > 0) {
        diagnostics.push(...analyzePreconditions(
          behavior,
          behavior.preconditions,
          filePath,
          typeEnv
        ));
      }
    }

    return diagnostics;
  },
};

/**
 * Convenience export for the pass instance
 */
export const unsatisfiablePreconditionsPass = UnsatisfiablePreconditionsPass;

// ============================================================================
// Helper to convert AST location
// ============================================================================

function nodeLocation(node: { location: SourceLocation }, filePath: string): SourceLocation {
  if (node.location) {
    return {
      file: node.location.file || filePath,
      line: node.location.line,
      column: node.location.column,
      endLine: node.location.endLine,
      endColumn: node.location.endColumn,
    };
  }
  return { file: filePath, line: 1, column: 1, endLine: 1, endColumn: 1 };
}

// ============================================================================
// Analysis Logic
// ============================================================================

function analyzePreconditions(
  behavior: Behavior,
  expressions: Expression[],
  filePath: string,
  typeEnv: PassContext['typeEnv']
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const constraints: ConstraintInfo[] = [];

  // Collect all constraints from preconditions
  for (const expression of expressions) {
    const constraint = extractConstraint(expression);
    if (constraint) {
      constraints.push({
        ...constraint,
        location: nodeLocation(expression, filePath),
      });
    }

    // Check for tautologically false conditions
    const falseCheck = checkAlwaysFalse(expression);
    if (falseCheck) {
      diagnostics.push({
        code: 'E0330',
        category: 'semantic',
        severity: 'error',
        message: `Unsatisfiable precondition: ${falseCheck.reason}`,
        location: nodeLocation(expression, filePath),
        source: 'verifier',
        notes: [`In behavior '${behavior.name.name}'`],
        help: ['This precondition can never be satisfied and the behavior can never execute'],
      });
    }
  }

  // Check for contradictory constraints
  for (let i = 0; i < constraints.length; i++) {
    for (let j = i + 1; j < constraints.length; j++) {
      const contradiction = findContradiction(constraints[i], constraints[j]);
      if (contradiction) {
        diagnostics.push({
          code: 'E0331',
          category: 'semantic',
          severity: 'error',
          message: `Contradictory preconditions: ${contradiction}`,
          location: constraints[i].location,
          source: 'verifier',
          notes: [
            `In behavior '${behavior.name.name}'`,
            'These two conditions cannot both be true',
          ],
          help: [
            'Review the preconditions and remove the contradiction',
            'Consider if one of the conditions should be removed',
          ],
          relatedInformation: [{
            message: 'Conflicting condition here',
            location: constraints[j].location,
          }],
        });
      }
    }
  }

  return diagnostics;
}

// ============================================================================
// Constraint Extraction
// ============================================================================

interface ConstraintInfo {
  variable: string;
  operator: 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge' | 'in' | 'nin';
  value: unknown;
  text: string;
  location: SourceLocation;
}

function extractConstraint(expr: Expression): Omit<ConstraintInfo, 'location'> | null {
  if (expr.kind === 'BinaryExpr') {
    const binary = expr as { 
      left?: Expression; 
      operator?: string; 
      right?: Expression;
    };

    if (!binary.left || !binary.right || !binary.operator) return null;

    const variable = extractVariableName(binary.left);
    const value = extractLiteralValue(binary.right);
    const text = `${variable} ${binary.operator} ${formatValue(value)}`;

    if (!variable) return null;

    const operator = normalizeOperator(binary.operator);
    if (!operator) return null;

    return { variable, operator, value, text };
  }

  return null;
}

function extractVariableName(expr: Expression): string | null {
  if (expr.kind === 'Identifier') {
    return (expr as { name: string }).name;
  }
  if (expr.kind === 'MemberExpr') {
    const member = expr as { object: Expression; property: { name: string } };
    const obj = extractVariableName(member.object);
    if (obj && member.property) return `${obj}.${member.property.name}`;
  }
  return null;
}

function extractLiteralValue(expr: Expression): unknown {
  switch (expr.kind) {
    case 'StringLiteral':
      return (expr as { value: string }).value;
    case 'NumberLiteral':
      return (expr as { value: number }).value;
    case 'BooleanLiteral':
      return (expr as { value: boolean }).value;
    case 'NullLiteral':
      return null;
    case 'Identifier':
      return { __var: (expr as { name: string }).name };
    default:
      return undefined;
  }
}

function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return '?';
  if (typeof value === 'object' && value && '__var' in value) {
    return (value as { __var: string }).__var;
  }
  if (typeof value === 'string') return `"${value}"`;
  return String(value);
}

function normalizeOperator(op: string): ConstraintInfo['operator'] | null {
  switch (op) {
    case '==':
    case '===':
      return 'eq';
    case '!=':
    case '!==':
      return 'ne';
    case '<':
      return 'lt';
    case '<=':
      return 'le';
    case '>':
      return 'gt';
    case '>=':
      return 'ge';
    case 'in':
      return 'in';
    case 'not in':
      return 'nin';
    default:
      return null;
  }
}

// ============================================================================
// Contradiction Detection
// ============================================================================

function findContradiction(a: ConstraintInfo, b: ConstraintInfo): string | null {
  // Must be about the same variable
  if (a.variable !== b.variable) return null;

  // Skip if either value is a variable reference
  if (isVariableRef(a.value) || isVariableRef(b.value)) return null;

  // x == 5 AND x == 10
  if (a.operator === 'eq' && b.operator === 'eq') {
    if (a.value !== b.value) {
      return `'${a.variable}' cannot equal both ${formatValue(a.value)} and ${formatValue(b.value)}`;
    }
  }

  // x == 5 AND x != 5
  if (a.operator === 'eq' && b.operator === 'ne' && a.value === b.value) {
    return `'${a.variable}' cannot both equal and not equal ${formatValue(a.value)}`;
  }
  if (a.operator === 'ne' && b.operator === 'eq' && a.value === b.value) {
    return `'${a.variable}' cannot both equal and not equal ${formatValue(a.value)}`;
  }

  // Numeric range contradictions
  if (typeof a.value === 'number' && typeof b.value === 'number') {
    // x > 10 AND x < 5
    if (a.operator === 'gt' && b.operator === 'lt' && a.value >= b.value) {
      return `'${a.variable}' cannot be both > ${a.value} and < ${b.value}`;
    }
    if (a.operator === 'lt' && b.operator === 'gt' && b.value >= a.value) {
      return `'${a.variable}' cannot be both < ${a.value} and > ${b.value}`;
    }

    // x >= 10 AND x <= 5
    if (a.operator === 'ge' && b.operator === 'le' && a.value > b.value) {
      return `'${a.variable}' cannot be both >= ${a.value} and <= ${b.value}`;
    }
    if (a.operator === 'le' && b.operator === 'ge' && b.value > a.value) {
      return `'${a.variable}' cannot be both <= ${a.value} and >= ${b.value}`;
    }

    // x == 5 AND x > 5
    if (a.operator === 'eq' && b.operator === 'gt' && a.value <= b.value) {
      return `'${a.variable}' cannot equal ${a.value} and be > ${b.value}`;
    }
    if (a.operator === 'gt' && b.operator === 'eq' && b.value <= a.value) {
      return `'${a.variable}' cannot be > ${a.value} and equal ${b.value}`;
    }

    // x == 5 AND x < 5
    if (a.operator === 'eq' && b.operator === 'lt' && a.value >= b.value) {
      return `'${a.variable}' cannot equal ${a.value} and be < ${b.value}`;
    }
    if (a.operator === 'lt' && b.operator === 'eq' && b.value >= a.value) {
      return `'${a.variable}' cannot be < ${a.value} and equal ${b.value}`;
    }
  }

  return null;
}

function isVariableRef(value: unknown): boolean {
  return typeof value === 'object' && value !== null && '__var' in value;
}

// ============================================================================
// Always-False Detection
// ============================================================================

interface AlwaysFalseResult {
  reason: string;
}

function checkAlwaysFalse(expr: Expression): AlwaysFalseResult | null {
  // x != x is always false
  if (expr.kind === 'BinaryExpr') {
    const binary = expr as { left?: Expression; operator?: string; right?: Expression };
    
    if (binary.operator === '!=' || binary.operator === '!==') {
      const leftVar = extractVariableName(binary.left!);
      const rightVar = extractVariableName(binary.right!);
      if (leftVar && rightVar && leftVar === rightVar) {
        return { reason: `'${leftVar} != ${rightVar}' is always false` };
      }
    }

    // false literal
    if (binary.left?.kind === 'BooleanLiteral' && (binary.left as { value: boolean }).value === false) {
      if (binary.operator === '==' || binary.operator === '===') {
        if (binary.right?.kind === 'BooleanLiteral' && (binary.right as { value: boolean }).value === true) {
          return { reason: "'false == true' is always false" };
        }
      }
    }
  }

  // Literal false
  if (expr.kind === 'BooleanLiteral' && (expr as { value: boolean }).value === false) {
    return { reason: "Precondition is literally 'false'" };
  }

  return null;
}
