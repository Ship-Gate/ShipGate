/**
 * Unreachable Clauses Detection Pass
 * 
 * Detects precondition/postcondition clauses that can never be reached
 * due to earlier contradictory conditions.
 */

import type { Diagnostic, SourceLocation } from '@isl-lang/errors';
import type { 
  Behavior, 
  PostconditionBlock,
  Expression,
} from '@isl-lang/parser';
import type { SemanticPass, PassContext } from '../types.js';

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
      // Check preconditions (Expression[])
      if (behavior.preconditions && behavior.preconditions.length > 0) {
        diagnostics.push(...analyzePreconditions(
          behavior.preconditions,
          behavior,
          filePath
        ));
      }

      // Check postconditions (PostconditionBlock[])
      if (behavior.postconditions && behavior.postconditions.length > 0) {
        diagnostics.push(...analyzePostconditions(
          behavior.postconditions,
          behavior,
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
// Analysis Logic for Preconditions (Expression[])
// ============================================================================

function analyzePreconditions(
  conditions: Expression[],
  behavior: Behavior,
  filePath: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const seenConditions: Array<{ text: string; location: SourceLocation }> = [];

  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];
    const exprText = extractExpressionText(condition);
    
    // Check for duplicate exact conditions
    const prevIndex = seenConditions.findIndex(c => c.text === exprText);
    
    if (prevIndex !== -1) {
      diagnostics.push({
        code: 'E0311',
        category: 'semantic',
        severity: 'warning',
        message: `Duplicate precondition clause: '${exprText}' is already checked`,
        location: nodeLocation(condition, filePath),
        source: 'verifier',
        notes: [`In behavior '${behavior.name.name}'`],
        help: ['Remove the duplicate clause'],
        tags: ['unnecessary'],
        relatedInformation: [{
          message: 'First occurrence here',
          location: seenConditions[prevIndex].location,
        }],
      });
    } else {
      seenConditions.push({ text: exprText, location: nodeLocation(condition, filePath) });
    }
    
    // Check for contradictory conditions using guard analysis
    const guardInfo = extractGuardInfo(condition);
    for (let j = 0; j < i; j++) {
      const prevGuard = extractGuardInfo(conditions[j]);
      if (isContradictory(prevGuard, guardInfo)) {
        diagnostics.push({
          code: 'E0310',
          category: 'semantic',
          severity: 'warning',
          message: `Potential contradiction: '${exprText}' may conflict with earlier condition`,
          location: nodeLocation(condition, filePath),
          source: 'verifier',
          notes: [
            `In behavior '${behavior.name.name}'`,
            'This condition may conflict with an earlier condition',
          ],
          help: [
            'Review the preconditions for contradictory constraints',
          ],
          relatedInformation: [{
            message: 'Potentially conflicting condition here',
            location: nodeLocation(conditions[j], filePath),
          }],
        });
      }
    }
  }

  return diagnostics;
}

// ============================================================================
// Analysis Logic for Postconditions (PostconditionBlock[])
// ============================================================================

function analyzePostconditions(
  blocks: PostconditionBlock[],
  behavior: Behavior,
  filePath: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  
  for (const block of blocks) {
    const predicates = block.predicates || [];
    const seenPredicates: Array<{ text: string; location: SourceLocation }> = [];
    
    for (let i = 0; i < predicates.length; i++) {
      const predicate = predicates[i];
      const exprText = extractExpressionText(predicate);
      
      // Check for duplicate exact conditions within the same block
      const prevIndex = seenPredicates.findIndex(c => c.text === exprText);
      
      if (prevIndex !== -1) {
        diagnostics.push({
          code: 'E0311',
          category: 'semantic',
          severity: 'warning',
          message: `Duplicate postcondition clause: '${exprText}' is already checked`,
          location: nodeLocation(predicate, filePath),
          source: 'verifier',
          notes: [`In behavior '${behavior.name.name}'`],
          help: ['Remove the duplicate clause'],
          tags: ['unnecessary'],
          relatedInformation: [{
            message: 'First occurrence here',
            location: seenPredicates[prevIndex].location,
          }],
        });
      } else {
        seenPredicates.push({ text: exprText, location: nodeLocation(predicate, filePath) });
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
}

function extractGuardInfo(expr: Expression): GuardInfo {
  const text = extractExpressionText(expr);
  
  // Simple comparison pattern: x == value, x != value, x > value, etc.
  if (expr.kind === 'BinaryExpr') {
    const binary = expr as { left?: Expression; operator?: string; right?: Expression };
    return {
      text,
      variable: binary.left ? extractExpressionText(binary.left) : undefined,
      operator: binary.operator,
      value: binary.right ? extractLiteralValue(binary.right) : undefined,
    };
  }

  // Identifier (boolean variable)
  if (expr.kind === 'Identifier') {
    return { text, variable: text, operator: '==', value: true };
  }

  // Unary not: !x or not x
  if (expr.kind === 'UnaryExpr') {
    const unary = expr as { operator?: string; operand?: Expression };
    if ((unary.operator === '!' || unary.operator === 'not') && unary.operand) {
      return {
        text,
        variable: extractExpressionText(unary.operand),
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
    case 'MemberExpr': {
      const member = expr as { object: Expression; property: { name: string } };
      return `${extractExpressionText(member.object)}.${member.property.name}`;
    }
    case 'BinaryExpr': {
      const binary = expr as { left: Expression; operator: string; right: Expression };
      return `${extractExpressionText(binary.left)} ${binary.operator} ${extractExpressionText(binary.right)}`;
    }
    case 'UnaryExpr': {
      const unary = expr as { operator: string; operand: Expression };
      return `${unary.operator}${extractExpressionText(unary.operand)}`;
    }
    case 'CallExpr': {
      const call = expr as { callee: Expression; arguments: Expression[] };
      const args = call.arguments.map(a => extractExpressionText(a)).join(', ');
      return `${extractExpressionText(call.callee)}(${args})`;
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
