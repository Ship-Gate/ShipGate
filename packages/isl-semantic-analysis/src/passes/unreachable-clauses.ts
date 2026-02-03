/**
 * Unreachable Clauses Detection Pass
 * 
 * Detects precondition/postcondition clauses that can never be reached
 * due to earlier contradictory conditions.
 */

import type { Diagnostic } from '@isl-lang/errors';
import type { 
  BehaviorDeclaration, 
  ConditionBlock, 
  Expression,
  GuardedCondition,
} from '@isl-lang/isl-core';
import type { SemanticPass, PassContext } from '../types.js';
import { spanToLocation } from '../types.js';

export const UnreachableClausesPass: SemanticPass = {
  id: 'unreachable-clauses',
  name: 'Unreachable Clauses',
  description: 'Detects precondition/postcondition clauses that can never be reached',
  dependencies: [],
  priority: 100,
  enabledByDefault: true,

  run(ctx: PassContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { ast, filePath } = ctx;

    // Analyze each behavior
    for (const behavior of ast.behaviors || []) {
      // Check preconditions
      if (behavior.preconditions) {
        diagnostics.push(...analyzeConditionBlock(
          behavior.preconditions,
          behavior,
          'precondition',
          filePath
        ));
      }

      // Check postconditions
      if (behavior.postconditions) {
        diagnostics.push(...analyzeConditionBlock(
          behavior.postconditions,
          behavior,
          'postcondition',
          filePath
        ));
      }
    }

    return diagnostics;
  },
};

/**
 * Convenience export for the pass instance
 */
export const unreachableClausesPass = UnreachableClausesPass;

// ============================================================================
// Analysis Logic
// ============================================================================

function analyzeConditionBlock(
  block: ConditionBlock,
  behavior: BehaviorDeclaration,
  blockType: 'precondition' | 'postcondition',
  filePath: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const seenGuards: GuardInfo[] = [];

  // Track guarded conditions
  const conditions = block.conditions || [];
  
  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];
    
    // Check if this is a guarded condition with 'when' clause
    if (isGuardedCondition(condition) && condition.guard) {
      const guardInfo = extractGuardInfo(condition.guard);
      
      // Check for contradictions with previous guards
      for (const prev of seenGuards) {
        if (isContradictory(prev, guardInfo)) {
          diagnostics.push({
            code: 'E0310',
            category: 'semantic',
            severity: 'warning',
            message: `Unreachable ${blockType} clause: guard '${guardInfo.text}' contradicts earlier guard '${prev.text}'`,
            location: spanToLocation(condition.span, filePath),
            source: 'verifier',
            notes: [
              `In behavior '${behavior.name.name}'`,
              'This clause will never execute because the guard condition conflicts with an earlier guard',
            ],
            help: [
              'Remove the unreachable clause or fix the guard conditions',
              'Consider using more specific guards that don\'t overlap',
            ],
            relatedInformation: [{
              message: 'Conflicting guard defined here',
              location: prev.location,
            }],
          });
        }
      }

      seenGuards.push({
        ...guardInfo,
        location: spanToLocation(condition.guard.span, filePath),
      });
    }

    // Check for duplicate exact conditions
    if (condition.expression) {
      const exprText = extractExpressionText(condition.expression);
      const prevIndex = conditions.slice(0, i).findIndex(c => 
        c.expression && extractExpressionText(c.expression) === exprText
      );
      
      if (prevIndex !== -1) {
        diagnostics.push({
          code: 'E0311',
          category: 'semantic',
          severity: 'warning',
          message: `Duplicate ${blockType} clause: '${exprText}' is already checked`,
          location: spanToLocation(condition.span, filePath),
          source: 'verifier',
          notes: [`In behavior '${behavior.name.name}'`],
          help: ['Remove the duplicate clause'],
          tags: ['unnecessary'],
          relatedInformation: [{
            message: 'First occurrence here',
            location: spanToLocation(conditions[prevIndex].span, filePath),
          }],
        });
      }
    }
  }

  return diagnostics;
}

// ============================================================================
// Guard Analysis
// ============================================================================

interface GuardInfo {
  text: string;
  variable?: string;
  operator?: string;
  value?: unknown;
  location: ReturnType<typeof spanToLocation>;
}

function isGuardedCondition(condition: unknown): condition is GuardedCondition {
  return typeof condition === 'object' && 
         condition !== null && 
         'guard' in condition;
}

function extractGuardInfo(guard: Expression): Omit<GuardInfo, 'location'> {
  const text = extractExpressionText(guard);
  
  // Simple comparison pattern: x == value, x != value, x > value, etc.
  if (guard.kind === 'ComparisonExpression' || guard.kind === 'BinaryExpression') {
    const expr = guard as { left?: Expression; operator?: string; right?: Expression };
    return {
      text,
      variable: expr.left ? extractExpressionText(expr.left) : undefined,
      operator: expr.operator,
      value: expr.right ? extractLiteralValue(expr.right) : undefined,
    };
  }

  // Identifier (boolean variable)
  if (guard.kind === 'Identifier') {
    return { text, variable: text, operator: '==', value: true };
  }

  // Unary not: !x
  if (guard.kind === 'UnaryExpression') {
    const expr = guard as { operator?: string; operand?: Expression };
    if (expr.operator === '!' && expr.operand) {
      return {
        text,
        variable: extractExpressionText(expr.operand),
        operator: '==',
        value: false,
      };
    }
  }

  return { text };
}

function isContradictory(a: GuardInfo, b: GuardInfo): boolean {
  // Must be about the same variable
  if (!a.variable || !b.variable || a.variable !== b.variable) {
    return false;
  }

  // Check for direct contradictions
  // x == true vs x == false
  if (a.operator === '==' && b.operator === '==') {
    if (a.value !== undefined && b.value !== undefined && a.value !== b.value) {
      return true;
    }
  }

  // x == value vs x != value
  if (a.operator === '==' && b.operator === '!=' && a.value === b.value) {
    return true;
  }
  if (a.operator === '!=' && b.operator === '==' && a.value === b.value) {
    return true;
  }

  // x > value vs x < value (when values don't allow overlap)
  if (a.operator === '>' && b.operator === '<') {
    if (typeof a.value === 'number' && typeof b.value === 'number') {
      if (a.value >= b.value) return true;
    }
  }

  return false;
}

function extractExpressionText(expr: Expression): string {
  switch (expr.kind) {
    case 'Identifier':
      return (expr as { name: string }).name;
    case 'StringLiteral':
      return `"${(expr as { value: string }).value}"`;
    case 'NumberLiteral':
      return String((expr as { value: number }).value);
    case 'BooleanLiteral':
      return String((expr as { value: boolean }).value);
    case 'MemberExpression': {
      const member = expr as { object: Expression; property: Expression };
      return `${extractExpressionText(member.object)}.${extractExpressionText(member.property)}`;
    }
    case 'BinaryExpression':
    case 'ComparisonExpression': {
      const binary = expr as { left: Expression; operator: string; right: Expression };
      return `${extractExpressionText(binary.left)} ${binary.operator} ${extractExpressionText(binary.right)}`;
    }
    default:
      return '[complex expression]';
  }
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
    default:
      return undefined;
  }
}
