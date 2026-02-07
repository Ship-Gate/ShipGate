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

import type { Diagnostic, SourceLocation } from '@isl-lang/errors';
import type {
  Behavior,
  PostconditionBlock,
  Expression,
} from '@isl-lang/parser';
import type { SemanticPass, PassContext } from '../types.js';

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
      // Check preconditions (Expression[])
      if (behavior.preconditions && behavior.preconditions.length > 0) {
        diagnostics.push(...checkExpressionList(
          behavior.preconditions,
          behavior,
          'precondition',
          filePath
        ));
      }

      // Check postconditions (PostconditionBlock[])
      if (behavior.postconditions && behavior.postconditions.length > 0) {
        diagnostics.push(...checkPostconditionBlocks(
          behavior.postconditions,
          behavior,
          filePath
        ));
      }

      // Check invariants (Expression[])
      if (behavior.invariants && behavior.invariants.length > 0) {
        diagnostics.push(...checkExpressionList(
          behavior.invariants,
          behavior,
          'invariant',
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
export const redundantConditionsPass = RedundantConditionsPass;

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
// Expression List Analysis (for preconditions and invariants)
// ============================================================================

function checkExpressionList(
  expressions: Expression[],
  behavior: Behavior,
  blockType: 'precondition' | 'postcondition' | 'invariant',
  filePath: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const seenConditions = new Map<string, { index: number; location: SourceLocation }>();

  for (let i = 0; i < expressions.length; i++) {
    const expression = expressions[i];

    // Check for tautological conditions
    const tautology = checkTautology(expression);
    if (tautology) {
      diagnostics.push({
        code: 'E0350',
        category: 'semantic',
        severity: 'warning',
        message: `Tautological ${blockType}: ${tautology.reason}`,
        location: nodeLocation(expression, filePath),
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
    const conditionText = normalizeExpression(expression);
    const prev = seenConditions.get(conditionText);
    
    if (prev !== undefined) {
      diagnostics.push({
        code: 'E0351',
        category: 'semantic',
        severity: 'warning',
        message: `Duplicate ${blockType} condition`,
        location: nodeLocation(expression, filePath),
        source: 'verifier',
        notes: [
          `In behavior '${behavior.name.name}'`,
          'This condition is already specified',
        ],
        help: ['Remove the duplicate condition'],
        tags: ['unnecessary'],
        relatedInformation: [{
          message: 'Original condition here',
          location: prev.location,
        }],
      });
    } else {
      seenConditions.set(conditionText, { index: i, location: nodeLocation(expression, filePath) });
    }

    // Check for subsumed conditions
    for (let j = 0; j < i; j++) {
      const prevExpression = expressions[j];

      const subsumption = checkSubsumption(prevExpression, expression);

      if (subsumption) {
        diagnostics.push({
          code: 'E0352',
          category: 'semantic',
          severity: 'warning',
          message: `Subsumed ${blockType}: ${subsumption.reason}`,
          location: nodeLocation(expression, filePath),
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
            location: nodeLocation(prevExpression, filePath),
          }],
        });
      }
    }

    // Check for redundant boolean comparisons
    const redundantBool = checkRedundantBooleanComparison(expression);
    if (redundantBool) {
      diagnostics.push({
        code: 'E0353',
        category: 'semantic',
        severity: 'hint',
        message: `Redundant boolean comparison: ${redundantBool.reason}`,
        location: nodeLocation(expression, filePath),
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
// Postcondition Blocks Analysis
// ============================================================================

function checkPostconditionBlocks(
  blocks: PostconditionBlock[],
  behavior: Behavior,
  filePath: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const block of blocks) {
    const predicates = block.predicates || [];
    diagnostics.push(...checkExpressionList(predicates, behavior, 'postcondition', filePath));
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
  if (expr.kind === 'BinaryExpr') {
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
    
    // x OR true
    if (binary.operator === '||' || binary.operator === 'or') {
      if (binary.left?.kind === 'BooleanLiteral') {
        const value = (binary.left as { value: boolean }).value;
        if (value === true) {
          return { reason: "'true || x' is always true" };
        }
      }
      if (binary.right?.kind === 'BooleanLiteral') {
        const value = (binary.right as { value: boolean }).value;
        if (value === true) {
          return { reason: "'x || true' is always true" };
        }
      }
    }
  }

  // NOT false
  if (expr.kind === 'UnaryExpr') {
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
  if (expr.kind !== 'BinaryExpr') {
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
  if (expr.kind !== 'BinaryExpr') {
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
    case 'MemberExpr': {
      const member = expr as { object: Expression; property: { name: string } };
      const obj = extractExpressionText(member.object);
      if (obj && member.property) return `${obj}.${member.property.name}`;
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
    case 'MemberExpr': {
      const member = expr as { object: Expression; property: { name: string } };
      return `member:${normalizeExpression(member.object)}.${member.property.name}`;
    }
    case 'BinaryExpr': {
      const binary = expr as { left: Expression; operator: string; right: Expression };
      return `bin:${normalizeExpression(binary.left)}${binary.operator}${normalizeExpression(binary.right)}`;
    }
    case 'UnaryExpr': {
      const unary = expr as { operator: string; operand: Expression };
      return `un:${unary.operator}${normalizeExpression(unary.operand)}`;
    }
    case 'CallExpr': {
      const call = expr as { callee: Expression; arguments: Expression[] };
      const args = call.arguments.map(a => normalizeExpression(a)).join(',');
      return `call:${normalizeExpression(call.callee)}(${args})`;
    }
    case 'QuantifierExpr': {
      const quant = expr as { quantifier: string; variable: { name: string }; collection: Expression; predicate: Expression };
      return `quant:${quant.quantifier}(${quant.variable.name} in ${normalizeExpression(quant.collection)}):${normalizeExpression(quant.predicate)}`;
    }
    default:
      return `unknown:${expr.kind}`;
  }
}
