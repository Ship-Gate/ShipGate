/**
 * Redundant Conditions Detection Pass
 * 
 * Detects redundant or duplicate conditions:
 * - Tautological conditions (always true)
 * - Subsumed conditions (already covered by another)
 * - Duplicate preconditions/postconditions
 * - Redundant boolean checks
 * 
 * @module @isl-lang/semantic-analysis
 */

import type { Diagnostic } from '@isl-lang/errors';
import type {
  BehaviorDeclaration,
  ConditionBlock,
  Expression,
} from '@isl-lang/isl-core';
import type { SemanticPass, PassContext } from '../types.js';
import { spanToLocation } from '../types.js';

// ============================================================================
// Pass Definition
// ============================================================================

export const RedundantConditionsPass: SemanticPass = {
  id: 'redundant-conditions',
  name: 'Redundant Conditions',
  description: 'Detects redundant, duplicate, or subsumed conditions',
  dependencies: [],
  priority: 50,
  enabledByDefault: true,

  run(ctx: PassContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { ast, filePath } = ctx;

    for (const behavior of ast.behaviors || []) {
      // Check preconditions
      if (behavior.preconditions) {
        diagnostics.push(...checkConditionBlock(
          behavior.preconditions,
          behavior,
          'precondition',
          filePath
        ));
      }

      // Check postconditions
      if (behavior.postconditions) {
        diagnostics.push(...checkConditionBlock(
          behavior.postconditions,
          behavior,
          'postcondition',
          filePath
        ));
      }

      // Check invariants
      if (behavior.invariants) {
        const invBlock = behavior.invariants as ConditionBlock;
        if (invBlock.conditions) {
          diagnostics.push(...checkConditionBlock(
            invBlock,
            behavior,
            'invariant',
            filePath
          ));
        }
      }
    }

    return diagnostics;
  },
};

/**
 * Convenience export for the pass instance
 */
export const redundantConditionsPass = RedundantConditionsPass;

// ============================================================================
// Condition Block Analysis
// ============================================================================

function checkConditionBlock(
  block: ConditionBlock,
  behavior: BehaviorDeclaration,
  blockType: 'precondition' | 'postcondition' | 'invariant',
  filePath: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const conditions = block.conditions || [];
  const seenConditions = new Map<string, number>();

  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];
    
    if (!condition.expression) continue;

    // Check for tautological conditions
    const tautology = checkTautology(condition.expression);
    if (tautology) {
      diagnostics.push({
        code: 'E0350',
        category: 'semantic',
        severity: 'warning',
        message: `Tautological ${blockType}: ${tautology.reason}`,
        location: spanToLocation(condition.span, filePath),
        source: 'verifier',
        notes: [
          `In behavior '${behavior.name.name}'`,
          'This condition is always true and has no effect',
        ],
        help: ['Remove the redundant condition'],
        tags: ['unnecessary'],
      });
    }

    // Check for exact duplicates
    const conditionText = normalizeExpression(condition.expression);
    const prevIndex = seenConditions.get(conditionText);
    
    if (prevIndex !== undefined) {
      diagnostics.push({
        code: 'E0351',
        category: 'semantic',
        severity: 'warning',
        message: `Duplicate ${blockType} condition`,
        location: spanToLocation(condition.span, filePath),
        source: 'verifier',
        notes: [
          `In behavior '${behavior.name.name}'`,
          'This condition is already specified',
        ],
        help: ['Remove the duplicate condition'],
        tags: ['unnecessary'],
        relatedInformation: [{
          message: 'Original condition here',
          location: spanToLocation(conditions[prevIndex].span, filePath),
        }],
      });
    } else {
      seenConditions.set(conditionText, i);
    }

    // Check for subsumed conditions
    for (let j = 0; j < i; j++) {
      const prevCondition = conditions[j];
      if (!prevCondition.expression) continue;

      const subsumption = checkSubsumption(
        prevCondition.expression,
        condition.expression
      );

      if (subsumption) {
        diagnostics.push({
          code: 'E0352',
          category: 'semantic',
          severity: 'warning',
          message: `Subsumed ${blockType}: ${subsumption.reason}`,
          location: spanToLocation(condition.span, filePath),
          source: 'verifier',
          notes: [
            `In behavior '${behavior.name.name}'`,
            'This condition is already implied by a previous condition',
          ],
          help: [
            'Remove the redundant condition',
            'Or restructure to make the intent clearer',
          ],
          tags: ['unnecessary'],
          relatedInformation: [{
            message: 'Subsuming condition here',
            location: spanToLocation(prevCondition.span, filePath),
          }],
        });
      }
    }

    // Check for redundant boolean comparisons
    const redundantBool = checkRedundantBooleanComparison(condition.expression);
    if (redundantBool) {
      diagnostics.push({
        code: 'E0353',
        category: 'semantic',
        severity: 'hint',
        message: `Redundant boolean comparison: ${redundantBool.reason}`,
        location: spanToLocation(condition.span, filePath),
        source: 'verifier',
        notes: [
          `In behavior '${behavior.name.name}'`,
          'Boolean values can be used directly without comparison',
        ],
        help: [redundantBool.suggestion],
        fix: redundantBool.fix ? {
          title: redundantBool.fix.title,
          edits: [],
          isPreferred: true,
        } : undefined,
      });
    }
  }

  return diagnostics;
}

// ============================================================================
// Tautology Detection
// ============================================================================

interface TautologyResult {
  reason: string;
}

function checkTautology(expr: Expression): TautologyResult | null {
  // true literal
  if (expr.kind === 'BooleanLiteral') {
    const value = (expr as { value: boolean }).value;
    if (value === true) {
      return { reason: "'true' is always true" };
    }
  }

  // x == x
  if (expr.kind === 'ComparisonExpression' || expr.kind === 'BinaryExpression') {
    const binary = expr as { left?: Expression; operator?: string; right?: Expression };
    
    if (binary.operator === '==' || binary.operator === '===') {
      const leftText = extractExpressionText(binary.left!);
      const rightText = extractExpressionText(binary.right!);
      if (leftText && leftText === rightText) {
        return { reason: `'${leftText} == ${rightText}' is always true` };
      }
    }

    // x >= x
    if (binary.operator === '>=' || binary.operator === '<=') {
      const leftText = extractExpressionText(binary.left!);
      const rightText = extractExpressionText(binary.right!);
      if (leftText && leftText === rightText) {
        return { reason: `'${leftText} ${binary.operator} ${rightText}' is always true` };
      }
    }
  }

  // x OR true
  if (expr.kind === 'LogicalExpression') {
    const logical = expr as { left?: Expression; operator?: string; right?: Expression };
    
    if (logical.operator === '||' || logical.operator === 'or') {
      if (logical.left?.kind === 'BooleanLiteral') {
        const value = (logical.left as { value: boolean }).value;
        if (value === true) {
          return { reason: "'true || x' is always true" };
        }
      }
      if (logical.right?.kind === 'BooleanLiteral') {
        const value = (logical.right as { value: boolean }).value;
        if (value === true) {
          return { reason: "'x || true' is always true" };
        }
      }
    }
  }

  // NOT false
  if (expr.kind === 'UnaryExpression') {
    const unary = expr as { operator?: string; operand?: Expression };
    
    if (unary.operator === '!' || unary.operator === 'not') {
      if (unary.operand?.kind === 'BooleanLiteral') {
        const value = (unary.operand as { value: boolean }).value;
        if (value === false) {
          return { reason: "'!false' is always true" };
        }
      }
    }
  }

  return null;
}

// ============================================================================
// Subsumption Detection
// ============================================================================

interface SubsumptionResult {
  reason: string;
}

function checkSubsumption(
  stronger: Expression,
  weaker: Expression
): SubsumptionResult | null {
  // Extract constraint info from both expressions
  const strongerConstraint = extractConstraintInfo(stronger);
  const weakerConstraint = extractConstraintInfo(weaker);

  if (!strongerConstraint || !weakerConstraint) return null;
  if (strongerConstraint.variable !== weakerConstraint.variable) return null;

  // Check if stronger implies weaker
  // x > 10 implies x > 5
  if (strongerConstraint.operator === 'gt' && weakerConstraint.operator === 'gt') {
    const s = strongerConstraint.value;
    const w = weakerConstraint.value;
    if (typeof s === 'number' && typeof w === 'number' && s > w) {
      return { 
        reason: `'${strongerConstraint.variable} > ${s}' already implies '${weakerConstraint.variable} > ${w}'` 
      };
    }
  }

  // x >= 10 implies x >= 5
  if (strongerConstraint.operator === 'ge' && weakerConstraint.operator === 'ge') {
    const s = strongerConstraint.value;
    const w = weakerConstraint.value;
    if (typeof s === 'number' && typeof w === 'number' && s >= w) {
      return { 
        reason: `'${strongerConstraint.variable} >= ${s}' already implies '${weakerConstraint.variable} >= ${w}'` 
      };
    }
  }

  // x > 10 implies x >= 10
  if (strongerConstraint.operator === 'gt' && weakerConstraint.operator === 'ge') {
    const s = strongerConstraint.value;
    const w = weakerConstraint.value;
    if (typeof s === 'number' && typeof w === 'number' && s >= w) {
      return { 
        reason: `'${strongerConstraint.variable} > ${s}' already implies '${weakerConstraint.variable} >= ${w}'` 
      };
    }
  }

  // x < 5 implies x < 10
  if (strongerConstraint.operator === 'lt' && weakerConstraint.operator === 'lt') {
    const s = strongerConstraint.value;
    const w = weakerConstraint.value;
    if (typeof s === 'number' && typeof w === 'number' && s < w) {
      return { 
        reason: `'${strongerConstraint.variable} < ${s}' already implies '${weakerConstraint.variable} < ${w}'` 
      };
    }
  }

  // x <= 5 implies x <= 10
  if (strongerConstraint.operator === 'le' && weakerConstraint.operator === 'le') {
    const s = strongerConstraint.value;
    const w = weakerConstraint.value;
    if (typeof s === 'number' && typeof w === 'number' && s <= w) {
      return { 
        reason: `'${strongerConstraint.variable} <= ${s}' already implies '${weakerConstraint.variable} <= ${w}'` 
      };
    }
  }

  // x == 5 implies x >= 5 and x <= 5
  if (strongerConstraint.operator === 'eq') {
    const s = strongerConstraint.value;
    const w = weakerConstraint.value;
    
    if (typeof s === 'number' && typeof w === 'number') {
      if (weakerConstraint.operator === 'ge' && s >= w) {
        return { 
          reason: `'${strongerConstraint.variable} == ${s}' already implies '${weakerConstraint.variable} >= ${w}'` 
        };
      }
      if (weakerConstraint.operator === 'le' && s <= w) {
        return { 
          reason: `'${strongerConstraint.variable} == ${s}' already implies '${weakerConstraint.variable} <= ${w}'` 
        };
      }
      if (weakerConstraint.operator === 'gt' && s > w) {
        return { 
          reason: `'${strongerConstraint.variable} == ${s}' already implies '${weakerConstraint.variable} > ${w}'` 
        };
      }
      if (weakerConstraint.operator === 'lt' && s < w) {
        return { 
          reason: `'${strongerConstraint.variable} == ${s}' already implies '${weakerConstraint.variable} < ${w}'` 
        };
      }
    }
  }

  return null;
}

// ============================================================================
// Redundant Boolean Comparison
// ============================================================================

interface RedundantBoolResult {
  reason: string;
  suggestion: string;
  fix?: {
    title: string;
    replacement: string;
  };
}

function checkRedundantBooleanComparison(expr: Expression): RedundantBoolResult | null {
  if (expr.kind !== 'ComparisonExpression' && expr.kind !== 'BinaryExpression') {
    return null;
  }

  const binary = expr as { left?: Expression; operator?: string; right?: Expression };
  
  // x == true -> x
  if (binary.operator === '==' || binary.operator === '===') {
    if (binary.right?.kind === 'BooleanLiteral') {
      const value = (binary.right as { value: boolean }).value;
      const leftText = extractExpressionText(binary.left!);
      
      if (value === true && leftText) {
        return {
          reason: `'${leftText} == true' can be simplified`,
          suggestion: `Use '${leftText}' directly instead of '${leftText} == true'`,
          fix: {
            title: `Simplify to '${leftText}'`,
            replacement: leftText,
          },
        };
      }
      
      // x == false -> !x
      if (value === false && leftText) {
        return {
          reason: `'${leftText} == false' can be simplified`,
          suggestion: `Use '!${leftText}' or 'not ${leftText}' instead`,
          fix: {
            title: `Simplify to '!${leftText}'`,
            replacement: `!${leftText}`,
          },
        };
      }
    }

    // true == x -> x
    if (binary.left?.kind === 'BooleanLiteral') {
      const value = (binary.left as { value: boolean }).value;
      const rightText = extractExpressionText(binary.right!);
      
      if (value === true && rightText) {
        return {
          reason: `'true == ${rightText}' can be simplified`,
          suggestion: `Use '${rightText}' directly`,
          fix: {
            title: `Simplify to '${rightText}'`,
            replacement: rightText,
          },
        };
      }
    }
  }

  // x != false -> x
  if (binary.operator === '!=' || binary.operator === '!==') {
    if (binary.right?.kind === 'BooleanLiteral') {
      const value = (binary.right as { value: boolean }).value;
      const leftText = extractExpressionText(binary.left!);
      
      if (value === false && leftText) {
        return {
          reason: `'${leftText} != false' can be simplified`,
          suggestion: `Use '${leftText}' directly`,
          fix: {
            title: `Simplify to '${leftText}'`,
            replacement: leftText,
          },
        };
      }
      
      // x != true -> !x
      if (value === true && leftText) {
        return {
          reason: `'${leftText} != true' can be simplified`,
          suggestion: `Use '!${leftText}' or 'not ${leftText}' instead`,
          fix: {
            title: `Simplify to '!${leftText}'`,
            replacement: `!${leftText}`,
          },
        };
      }
    }
  }

  return null;
}

// ============================================================================
// Helper Functions
// ============================================================================

interface ConstraintInfo {
  variable: string;
  operator: 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge';
  value: unknown;
}

function extractConstraintInfo(expr: Expression): ConstraintInfo | null {
  if (expr.kind !== 'ComparisonExpression' && expr.kind !== 'BinaryExpression') {
    return null;
  }

  const binary = expr as { left?: Expression; operator?: string; right?: Expression };
  if (!binary.left || !binary.right || !binary.operator) return null;

  const variable = extractExpressionText(binary.left);
  if (!variable) return null;

  const value = extractLiteralValue(binary.right);
  const operator = normalizeOperator(binary.operator);
  if (!operator) return null;

  return { variable, operator, value };
}

function extractExpressionText(expr: Expression): string | null {
  switch (expr.kind) {
    case 'Identifier':
      return (expr as { name: string }).name;
    case 'MemberExpression': {
      const member = expr as { object: Expression; property: Expression };
      const obj = extractExpressionText(member.object);
      const prop = extractExpressionText(member.property);
      if (obj && prop) return `${obj}.${prop}`;
      return null;
    }
    default:
      return null;
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
    default:
      return null;
  }
}

function normalizeExpression(expr: Expression): string {
  // Create a normalized string representation for comparison
  switch (expr.kind) {
    case 'Identifier':
      return `id:${(expr as { name: string }).name}`;
    case 'StringLiteral':
      return `str:${(expr as { value: string }).value}`;
    case 'NumberLiteral':
      return `num:${(expr as { value: number }).value}`;
    case 'BooleanLiteral':
      return `bool:${(expr as { value: boolean }).value}`;
    case 'MemberExpression': {
      const member = expr as { object: Expression; property: Expression };
      return `member:${normalizeExpression(member.object)}.${normalizeExpression(member.property)}`;
    }
    case 'BinaryExpression':
    case 'ComparisonExpression': {
      const binary = expr as { left: Expression; operator: string; right: Expression };
      return `bin:${normalizeExpression(binary.left)}${binary.operator}${normalizeExpression(binary.right)}`;
    }
    case 'LogicalExpression': {
      const logical = expr as { left: Expression; operator: string; right: Expression };
      return `log:${normalizeExpression(logical.left)}${logical.operator}${normalizeExpression(logical.right)}`;
    }
    case 'UnaryExpression': {
      const unary = expr as { operator: string; operand: Expression };
      return `un:${unary.operator}${normalizeExpression(unary.operand)}`;
    }
    case 'CallExpression': {
      const call = expr as { callee: Expression; arguments: Expression[] };
      const args = call.arguments.map(a => normalizeExpression(a)).join(',');
      return `call:${normalizeExpression(call.callee)}(${args})`;
    }
    default:
      return `unknown:${expr.kind}`;
  }
}
