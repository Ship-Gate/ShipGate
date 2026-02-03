/**
 * Enhanced Consistency Checker Pass
 * 
 * Advanced semantic checks without SMT:
 * - Contradictory preconditions (x >= 8 && x < 8, x == 5 && x != 5)
 * - Unused inputs/outputs in behaviors
 * - Missing required metadata for security/temporal blocks
 */

import type { Diagnostic, SourceLocation } from '@isl-lang/errors';
import type { 
  DomainDeclaration, 
  BehaviorDeclaration, 
  Expression,
  ConditionBlock,
  SecurityBlock,
  TemporalBlock,
} from '@isl-lang/isl-core';
import type { SemanticPass, PassContext } from '../types.js';
import { spanToLocation } from '../types.js';

// ============================================================================
// Error Code Constants
// ============================================================================

const ERRORS = {
  CONTRADICTORY_PRECONDITION: 'E0340',
  INLINE_CONTRADICTION: 'E0341',
  UNUSED_INPUT: 'E0342',
  UNUSED_OUTPUT: 'E0343',
  SECURITY_MISSING_INPUT_REF: 'E0344',
  TEMPORAL_MISSING_DURATION: 'E0345',
  ALWAYS_FALSE_EXPRESSION: 'E0346',
} as const;

// ============================================================================
// Types
// ============================================================================

interface NumericConstraint {
  variable: string;
  operator: '==' | '!=' | '<' | '<=' | '>' | '>=';
  value: number;
  span: SourceSpan;
}

interface SourceSpan {
  start: { line: number; column: number; offset: number };
  end: { line: number; column: number; offset: number };
}

interface BooleanConstraint {
  variable: string;
  operator: '==' | '!=';
  value: boolean;
  span: SourceSpan;
}

interface EqualityConstraint {
  variable: string;
  operator: '==' | '!=';
  stringValue?: string;
  span: SourceSpan;
}

// ============================================================================
// Main Pass
// ============================================================================

export const EnhancedConsistencyCheckerPass: SemanticPass = {
  id: 'enhanced-consistency-checker',
  name: 'Enhanced Consistency Checker',
  description: 'Detects contradictory preconditions, unused symbols, and missing metadata',
  dependencies: [],
  priority: 85,
  enabledByDefault: true,

  run(ctx: PassContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { ast, filePath } = ctx;

    for (const behavior of ast.behaviors || []) {
      // Check for contradictory preconditions
      diagnostics.push(...checkContradictoryPreconditions(behavior, filePath));
      
      // Check for unused inputs/outputs
      diagnostics.push(...checkUnusedBehaviorSymbols(behavior, filePath));
      
      // Check security block metadata
      if (behavior.security) {
        diagnostics.push(...checkSecurityMetadata(behavior, filePath));
      }
      
      // Check temporal block metadata
      if (behavior.temporal) {
        diagnostics.push(...checkTemporalMetadata(behavior, filePath));
      }
    }

    return diagnostics;
  },
};

export const enhancedConsistencyCheckerPass = EnhancedConsistencyCheckerPass;

// ============================================================================
// Contradictory Precondition Detection
// ============================================================================

function checkContradictoryPreconditions(
  behavior: BehaviorDeclaration,
  filePath: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const preconditions = behavior.preconditions;
  
  if (!preconditions) return diagnostics;

  // Collect all constraints from preconditions
  const numericConstraints: NumericConstraint[] = [];
  const boolConstraints: BooleanConstraint[] = [];
  const eqConstraints: EqualityConstraint[] = [];

  for (const condition of preconditions.conditions || []) {
    // Check each condition's statements
    for (const stmt of condition.statements || []) {
      if (!stmt.expression) continue;
      
      // Check for inline contradictions within a single expression (e.g., x >= 8 and x < 8)
      const inlineContradiction = checkInlineContradiction(stmt.expression);
      if (inlineContradiction) {
        diagnostics.push({
          code: ERRORS.INLINE_CONTRADICTION,
          category: 'semantic',
          severity: 'error',
          message: `Contradictory condition: ${inlineContradiction.reason}`,
          location: spanToLocation(stmt.span, filePath),
          source: 'verifier',
          notes: [`In behavior '${behavior.name.name}'`, 'This condition can never be true'],
          help: ['Review the condition and remove the contradiction'],
        });
        continue;
      }

      // Check for always-false expressions
      const alwaysFalse = checkAlwaysFalse(stmt.expression);
      if (alwaysFalse) {
        diagnostics.push({
          code: ERRORS.ALWAYS_FALSE_EXPRESSION,
          category: 'semantic',
          severity: 'error',
          message: `Always-false expression: ${alwaysFalse.reason}`,
          location: spanToLocation(stmt.span, filePath),
          source: 'verifier',
          notes: [`In behavior '${behavior.name.name}'`],
          help: ['This precondition will never be satisfied'],
        });
        continue;
      }
      
      // Extract constraints for cross-statement analysis
      extractConstraints(stmt.expression, stmt.span, numericConstraints, boolConstraints, eqConstraints);
    }
  }

  // Check for contradictions across separate statements
  diagnostics.push(...checkNumericContradictions(numericConstraints, behavior, filePath));
  diagnostics.push(...checkBooleanContradictions(boolConstraints, behavior, filePath));
  diagnostics.push(...checkEqualityContradictions(eqConstraints, behavior, filePath));

  return diagnostics;
}

/**
 * Check for inline contradictions in a single expression (e.g., x >= 8 and x < 8)
 */
function checkInlineContradiction(expr: Expression): { reason: string } | null {
  // Handle 'and' / '&&' binary expressions
  if (expr.kind === 'BinaryExpression' || expr.kind === 'LogicalExpression') {
    const binary = expr as { left?: Expression; operator?: string; right?: Expression };
    
    if (binary.operator === 'and' || binary.operator === '&&') {
      // Extract constraint from left and right
      const leftConstraint = extractSingleConstraint(binary.left);
      const rightConstraint = extractSingleConstraint(binary.right);
      
      if (leftConstraint && rightConstraint) {
        if (leftConstraint.variable === rightConstraint.variable) {
          const contradiction = findNumericContradiction(leftConstraint, rightConstraint);
          if (contradiction) {
            return { reason: contradiction };
          }
        }
      }
      
      // Recursively check both sides
      const leftCheck = checkInlineContradiction(binary.left!);
      if (leftCheck) return leftCheck;
      
      const rightCheck = checkInlineContradiction(binary.right!);
      if (rightCheck) return rightCheck;
    }
  }
  
  return null;
}

/**
 * Check for always-false expressions (x != x, false, etc.)
 */
function checkAlwaysFalse(expr: Expression): { reason: string } | null {
  // Check for literal false
  if (expr.kind === 'BooleanLiteral' && (expr as { value: boolean }).value === false) {
    return { reason: "Literal 'false' precondition" };
  }

  // Check for x != x patterns
  if (expr.kind === 'ComparisonExpression' || expr.kind === 'BinaryExpression') {
    const binary = expr as { left?: Expression; operator?: string; right?: Expression };
    
    if (binary.operator === '!=' || binary.operator === '!==') {
      const leftVar = extractVariableName(binary.left);
      const rightVar = extractVariableName(binary.right);
      
      if (leftVar && rightVar && leftVar === rightVar) {
        return { reason: `'${leftVar} != ${rightVar}' is always false` };
      }
    }

    // Check for false == true or true == false
    if (binary.operator === '==' || binary.operator === '===') {
      const leftBool = extractBooleanLiteral(binary.left);
      const rightBool = extractBooleanLiteral(binary.right);
      
      if (leftBool !== null && rightBool !== null && leftBool !== rightBool) {
        return { reason: `'${leftBool} == ${rightBool}' is always false` };
      }
    }
  }

  return null;
}

/**
 * Extract a single numeric constraint from an expression
 */
function extractSingleConstraint(expr: Expression | undefined): NumericConstraint | null {
  if (!expr) return null;
  
  if (expr.kind === 'ComparisonExpression' || expr.kind === 'BinaryExpression') {
    const binary = expr as { left?: Expression; operator?: string; right?: Expression };
    
    if (!binary.left || !binary.right || !binary.operator) return null;
    
    const op = normalizeComparisonOp(binary.operator);
    if (!op) return null;
    
    // variable op number
    const leftVar = extractVariableName(binary.left);
    const rightNum = extractNumberValue(binary.right);
    
    if (leftVar && rightNum !== null) {
      return {
        variable: leftVar,
        operator: op,
        value: rightNum,
        span: expr.span || { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
      };
    }
    
    // number op variable (flip the operator)
    const leftNum = extractNumberValue(binary.left);
    const rightVar = extractVariableName(binary.right);
    
    if (leftNum !== null && rightVar) {
      return {
        variable: rightVar,
        operator: flipOperator(op),
        value: leftNum,
        span: expr.span || { start: { line: 0, column: 0, offset: 0 }, end: { line: 0, column: 0, offset: 0 } },
      };
    }
  }
  
  return null;
}

function normalizeComparisonOp(op: string): NumericConstraint['operator'] | null {
  switch (op) {
    case '==':
    case '===':
      return '==';
    case '!=':
    case '!==':
      return '!=';
    case '<':
      return '<';
    case '<=':
      return '<=';
    case '>':
      return '>';
    case '>=':
      return '>=';
    default:
      return null;
  }
}

function flipOperator(op: NumericConstraint['operator']): NumericConstraint['operator'] {
  switch (op) {
    case '<': return '>';
    case '<=': return '>=';
    case '>': return '<';
    case '>=': return '<=';
    default: return op;
  }
}

/**
 * Find numeric contradictions between two constraints on the same variable
 */
function findNumericContradiction(a: NumericConstraint, b: NumericConstraint): string | null {
  // x >= 8 and x < 8
  if (a.operator === '>=' && b.operator === '<' && a.value >= b.value) {
    return `'${a.variable} >= ${a.value}' contradicts '${a.variable} < ${b.value}'`;
  }
  if (b.operator === '>=' && a.operator === '<' && b.value >= a.value) {
    return `'${b.variable} >= ${b.value}' contradicts '${b.variable} < ${a.value}'`;
  }
  
  // x > 8 and x <= 8
  if (a.operator === '>' && b.operator === '<=' && a.value >= b.value) {
    return `'${a.variable} > ${a.value}' contradicts '${a.variable} <= ${b.value}'`;
  }
  if (b.operator === '>' && a.operator === '<=' && b.value >= a.value) {
    return `'${b.variable} > ${b.value}' contradicts '${b.variable} <= ${a.value}'`;
  }
  
  // x > 8 and x < 8
  if (a.operator === '>' && b.operator === '<' && a.value >= b.value) {
    return `'${a.variable} > ${a.value}' contradicts '${a.variable} < ${b.value}'`;
  }
  if (b.operator === '>' && a.operator === '<' && b.value >= a.value) {
    return `'${b.variable} > ${b.value}' contradicts '${b.variable} < ${a.value}'`;
  }
  
  // x >= 8 and x <= 7
  if (a.operator === '>=' && b.operator === '<=' && a.value > b.value) {
    return `'${a.variable} >= ${a.value}' contradicts '${a.variable} <= ${b.value}'`;
  }
  if (b.operator === '>=' && a.operator === '<=' && b.value > a.value) {
    return `'${b.variable} >= ${b.value}' contradicts '${b.variable} <= ${a.value}'`;
  }
  
  // x == 5 and x == 6
  if (a.operator === '==' && b.operator === '==' && a.value !== b.value) {
    return `'${a.variable} == ${a.value}' contradicts '${a.variable} == ${b.value}'`;
  }
  
  // x == 5 and x != 5
  if (a.operator === '==' && b.operator === '!=' && a.value === b.value) {
    return `'${a.variable} == ${a.value}' contradicts '${a.variable} != ${b.value}'`;
  }
  if (b.operator === '==' && a.operator === '!=' && b.value === a.value) {
    return `'${b.variable} == ${b.value}' contradicts '${b.variable} != ${a.value}'`;
  }
  
  // x == 5 and x > 5
  if (a.operator === '==' && b.operator === '>' && a.value <= b.value) {
    return `'${a.variable} == ${a.value}' contradicts '${a.variable} > ${b.value}'`;
  }
  if (b.operator === '==' && a.operator === '>' && b.value <= a.value) {
    return `'${b.variable} == ${b.value}' contradicts '${b.variable} > ${a.value}'`;
  }
  
  // x == 5 and x < 5
  if (a.operator === '==' && b.operator === '<' && a.value >= b.value) {
    return `'${a.variable} == ${a.value}' contradicts '${a.variable} < ${b.value}'`;
  }
  if (b.operator === '==' && a.operator === '<' && b.value >= a.value) {
    return `'${b.variable} == ${b.value}' contradicts '${b.variable} < ${a.value}'`;
  }
  
  return null;
}

/**
 * Extract constraints from an expression tree
 */
function extractConstraints(
  expr: Expression,
  span: SourceSpan,
  numeric: NumericConstraint[],
  boolean: BooleanConstraint[],
  equality: EqualityConstraint[]
): void {
  if (expr.kind === 'ComparisonExpression' || expr.kind === 'BinaryExpression') {
    const binary = expr as { left?: Expression; operator?: string; right?: Expression };
    
    if (!binary.left || !binary.right || !binary.operator) return;
    
    const op = normalizeComparisonOp(binary.operator);
    if (!op) return;
    
    // Numeric constraints
    const leftVar = extractVariableName(binary.left);
    const rightNum = extractNumberValue(binary.right);
    
    if (leftVar && rightNum !== null) {
      numeric.push({ variable: leftVar, operator: op, value: rightNum, span });
      return;
    }
    
    const leftNum = extractNumberValue(binary.left);
    const rightVar = extractVariableName(binary.right);
    
    if (leftNum !== null && rightVar) {
      numeric.push({ variable: rightVar, operator: flipOperator(op), value: leftNum, span });
      return;
    }
    
    // Boolean constraints
    const rightBool = extractBooleanLiteral(binary.right);
    if (leftVar && rightBool !== null) {
      boolean.push({ variable: leftVar, operator: op as '==' | '!=', value: rightBool, span });
      return;
    }
    
    // String equality constraints
    const rightStr = extractStringValue(binary.right);
    if (leftVar && rightStr !== undefined && (op === '==' || op === '!=')) {
      equality.push({ variable: leftVar, operator: op, stringValue: rightStr, span });
    }
  }
  
  // Recursively process logical conjunctions
  if (expr.kind === 'BinaryExpression' || expr.kind === 'LogicalExpression') {
    const binary = expr as { left?: Expression; operator?: string; right?: Expression };
    if (binary.operator === 'and' || binary.operator === '&&') {
      if (binary.left) extractConstraints(binary.left, span, numeric, boolean, equality);
      if (binary.right) extractConstraints(binary.right, span, numeric, boolean, equality);
    }
  }
}

function checkNumericContradictions(
  constraints: NumericConstraint[],
  behavior: BehaviorDeclaration,
  filePath: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  
  // Group by variable
  const byVariable = new Map<string, NumericConstraint[]>();
  for (const c of constraints) {
    if (!byVariable.has(c.variable)) {
      byVariable.set(c.variable, []);
    }
    byVariable.get(c.variable)!.push(c);
  }
  
  // Check each variable's constraints for contradictions
  for (const [variable, varConstraints] of byVariable) {
    for (let i = 0; i < varConstraints.length; i++) {
      for (let j = i + 1; j < varConstraints.length; j++) {
        const contradiction = findNumericContradiction(varConstraints[i], varConstraints[j]);
        if (contradiction) {
          diagnostics.push({
            code: ERRORS.CONTRADICTORY_PRECONDITION,
            category: 'semantic',
            severity: 'error',
            message: `Contradictory preconditions: ${contradiction}`,
            location: spanToLocation(varConstraints[i].span, filePath),
            source: 'verifier',
            notes: [
              `In behavior '${behavior.name.name}'`,
              'These two conditions cannot both be true',
            ],
            help: ['Review the preconditions and remove the contradiction'],
            relatedInformation: [{
              message: 'Conflicting condition',
              location: spanToLocation(varConstraints[j].span, filePath),
            }],
          });
        }
      }
    }
  }
  
  return diagnostics;
}

function checkBooleanContradictions(
  constraints: BooleanConstraint[],
  behavior: BehaviorDeclaration,
  filePath: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  
  const byVariable = new Map<string, BooleanConstraint[]>();
  for (const c of constraints) {
    if (!byVariable.has(c.variable)) {
      byVariable.set(c.variable, []);
    }
    byVariable.get(c.variable)!.push(c);
  }
  
  for (const [variable, varConstraints] of byVariable) {
    for (let i = 0; i < varConstraints.length; i++) {
      for (let j = i + 1; j < varConstraints.length; j++) {
        const a = varConstraints[i];
        const b = varConstraints[j];
        
        // x == true and x == false
        if (a.operator === '==' && b.operator === '==' && a.value !== b.value) {
          diagnostics.push({
            code: ERRORS.CONTRADICTORY_PRECONDITION,
            category: 'semantic',
            severity: 'error',
            message: `Contradictory preconditions: '${variable} == ${a.value}' and '${variable} == ${b.value}'`,
            location: spanToLocation(a.span, filePath),
            source: 'verifier',
            notes: [`In behavior '${behavior.name.name}'`],
            help: ['A boolean cannot be both true and false'],
          });
        }
        
        // x == true and x != true
        if (a.operator === '==' && b.operator === '!=' && a.value === b.value) {
          diagnostics.push({
            code: ERRORS.CONTRADICTORY_PRECONDITION,
            category: 'semantic',
            severity: 'error',
            message: `Contradictory preconditions: '${variable} == ${a.value}' and '${variable} != ${b.value}'`,
            location: spanToLocation(a.span, filePath),
            source: 'verifier',
            notes: [`In behavior '${behavior.name.name}'`],
            help: ['Remove the conflicting condition'],
          });
        }
      }
    }
  }
  
  return diagnostics;
}

function checkEqualityContradictions(
  constraints: EqualityConstraint[],
  behavior: BehaviorDeclaration,
  filePath: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  
  const byVariable = new Map<string, EqualityConstraint[]>();
  for (const c of constraints) {
    if (!byVariable.has(c.variable)) {
      byVariable.set(c.variable, []);
    }
    byVariable.get(c.variable)!.push(c);
  }
  
  for (const [variable, varConstraints] of byVariable) {
    for (let i = 0; i < varConstraints.length; i++) {
      for (let j = i + 1; j < varConstraints.length; j++) {
        const a = varConstraints[i];
        const b = varConstraints[j];
        
        if (a.stringValue !== undefined && b.stringValue !== undefined) {
          // x == "foo" and x == "bar"
          if (a.operator === '==' && b.operator === '==' && a.stringValue !== b.stringValue) {
            diagnostics.push({
              code: ERRORS.CONTRADICTORY_PRECONDITION,
              category: 'semantic',
              severity: 'error',
              message: `Contradictory preconditions: '${variable}' cannot equal both "${a.stringValue}" and "${b.stringValue}"`,
              location: spanToLocation(a.span, filePath),
              source: 'verifier',
              notes: [`In behavior '${behavior.name.name}'`],
              help: ['Remove one of the equality constraints'],
            });
          }
          
          // x == "foo" and x != "foo"
          if (a.operator === '==' && b.operator === '!=' && a.stringValue === b.stringValue) {
            diagnostics.push({
              code: ERRORS.CONTRADICTORY_PRECONDITION,
              category: 'semantic',
              severity: 'error',
              message: `Contradictory preconditions: '${variable}' cannot both equal and not equal "${a.stringValue}"`,
              location: spanToLocation(a.span, filePath),
              source: 'verifier',
              notes: [`In behavior '${behavior.name.name}'`],
              help: ['Remove the conflicting condition'],
            });
          }
        }
      }
    }
  }
  
  return diagnostics;
}

// ============================================================================
// Unused Input/Output Detection
// ============================================================================

function checkUnusedBehaviorSymbols(
  behavior: BehaviorDeclaration,
  filePath: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  
  // Collect all identifiers used in the behavior body
  const usedIdentifiers = new Set<string>();
  
  // Collect from preconditions
  collectIdentifiersFromBlock(behavior.preconditions, usedIdentifiers);
  
  // Collect from postconditions
  collectIdentifiersFromBlock(behavior.postconditions, usedIdentifiers);
  
  // Collect from invariants
  for (const inv of behavior.invariants || []) {
    collectIdentifiersFromExpression(inv.expression || inv, usedIdentifiers);
  }
  
  // Collect from temporal block
  if (behavior.temporal) {
    collectIdentifiersFromTemporal(behavior.temporal, usedIdentifiers);
  }
  
  // Collect from security block
  if (behavior.security) {
    collectIdentifiersFromSecurity(behavior.security, usedIdentifiers);
  }
  
  // Check inputs
  const inputBlock = behavior.input;
  if (inputBlock && inputBlock.fields) {
    for (const field of inputBlock.fields) {
      const name = field.name?.name;
      if (!name) continue;
      
      // Check if the input is used:
      // - as 'name' directly
      // - as 'input.name'
      // - via any member expression containing 'name'
      const isUsed = usedIdentifiers.has(name) || 
                     usedIdentifiers.has(`input.${name}`) ||
                     Array.from(usedIdentifiers).some(id => id.endsWith(`.${name}`));
      
      if (!isUsed) {
        // Skip common implicit inputs
        if (isCommonImplicitInput(name)) continue;
        
        diagnostics.push({
          code: ERRORS.UNUSED_INPUT,
          category: 'semantic',
          severity: 'warning',
          message: `Input parameter '${name}' is declared but never used in behavior '${behavior.name.name}'`,
          location: spanToLocation(field.span, filePath),
          source: 'verifier',
          tags: ['unnecessary'],
          help: [
            'Remove the unused parameter',
            'Or use it in a precondition, postcondition, or security block',
          ],
        });
      }
    }
  }
  
  // Check outputs - they should be referenced in postconditions
  const outputBlock = behavior.output;
  if (outputBlock) {
    // For struct-type success output, check each field
    const successType = outputBlock.success;
    if (successType && successType.kind === 'StructType' && successType.fields) {
      for (const field of successType.fields) {
        const name = field.name?.name;
        if (name && !usedIdentifiers.has(name) && !usedIdentifiers.has(`result.${name}`)) {
          diagnostics.push({
            code: ERRORS.UNUSED_OUTPUT,
            category: 'semantic',
            severity: 'warning',
            message: `Output field '${name}' is declared but never constrained in postconditions of '${behavior.name.name}'`,
            location: spanToLocation(field.span || outputBlock.span, filePath),
            source: 'verifier',
            notes: ['Output fields should typically be constrained in postconditions'],
            help: [
              'Add a postcondition that defines the output value',
              'Or remove the output field if not needed',
            ],
          });
        }
      }
    }
  }
  
  return diagnostics;
}

function isCommonImplicitInput(name: string): boolean {
  // These are commonly used implicitly (via method calls, system context, etc.)
  const implicit = new Set([
    'context', 'ctx', 'request', 'req', 'ip', 'ip_address', 'user_agent',
    'timestamp', 'correlation_id', 'trace_id', 'session_id',
  ]);
  return implicit.has(name);
}

// ============================================================================
// Security/Temporal Metadata Validation
// ============================================================================

function checkSecurityMetadata(
  behavior: BehaviorDeclaration,
  filePath: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const security = behavior.security!;
  
  // Collect declared inputs
  const inputNames = new Set<string>();
  if (behavior.input?.fields) {
    for (const field of behavior.input.fields) {
      if (field.name?.name) {
        inputNames.add(field.name.name);
      }
    }
  }
  
  // Check rate_limit references
  for (const req of security.requirements || []) {
    if (req.type === 'rate_limit' || req.type === 'rate-limit') {
      // Rate limits often reference "per <field>" - extract and validate
      const referencedVars = extractReferencedVariables(req.expression);
      
      for (const varName of referencedVars) {
        // Skip common built-ins
        if (isRateLimitBuiltin(varName)) continue;
        
        if (!inputNames.has(varName)) {
          diagnostics.push({
            code: ERRORS.SECURITY_MISSING_INPUT_REF,
            category: 'semantic',
            severity: 'warning',
            message: `Security rate_limit references '${varName}' which is not a declared input`,
            location: spanToLocation(req.span || security.span, filePath),
            source: 'verifier',
            notes: [`In behavior '${behavior.name.name}'`, `Declared inputs: ${Array.from(inputNames).join(', ') || '(none)'}`],
            help: [
              `Add '${varName}' to the input block`,
              'Or use a different field for rate limiting',
            ],
          });
        }
      }
    }
  }
  
  return diagnostics;
}

function isRateLimitBuiltin(name: string): boolean {
  // Common built-in rate limit keys
  const builtins = new Set([
    'ip', 'ip_address', 'user', 'user_id', 'session', 'session_id',
    'api_key', 'token', 'client', 'client_id', 'hour', 'minute', 'second',
  ]);
  return builtins.has(name);
}

function checkTemporalMetadata(
  behavior: BehaviorDeclaration,
  filePath: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const temporal = behavior.temporal!;
  
  for (const req of temporal.requirements || []) {
    // "within" requirements need a duration
    if (req.type === 'within' && !req.duration) {
      diagnostics.push({
        code: ERRORS.TEMPORAL_MISSING_DURATION,
        category: 'semantic',
        severity: 'error',
        message: `Temporal 'within' requirement is missing a duration`,
        location: spanToLocation(req.span || temporal.span, filePath),
        source: 'verifier',
        notes: [`In behavior '${behavior.name.name}'`],
        help: [
          "Specify a duration like 'within 500ms' or 'within 2s'",
        ],
      });
    }
    
    // Check that temporal conditions reference meaningful things
    if (req.condition) {
      const vars = extractReferencedVariables(req.condition);
      
      // Warn if temporal condition doesn't reference any behavior context
      if (vars.size === 0 && !isSimpleCondition(req.condition)) {
        diagnostics.push({
          code: ERRORS.TEMPORAL_MISSING_DURATION,
          category: 'semantic',
          severity: 'hint',
          message: `Temporal condition doesn't reference any behavior variables`,
          location: spanToLocation(req.span || temporal.span, filePath),
          source: 'verifier',
          notes: [`In behavior '${behavior.name.name}'`],
          help: ['Temporal conditions typically constrain response time or state changes'],
        });
      }
    }
  }
  
  return diagnostics;
}

function isSimpleCondition(expr: Expression): boolean {
  // Simple conditions like "response returned" are valid
  if (expr.kind === 'Identifier') return true;
  if (expr.kind === 'MemberExpression') return true;
  if (expr.kind === 'CallExpression') return true;
  return false;
}

// ============================================================================
// Utility Functions
// ============================================================================

function extractVariableName(expr: Expression | undefined): string | null {
  if (!expr) return null;
  
  if (expr.kind === 'Identifier') {
    return (expr as { name: string }).name;
  }
  
  if (expr.kind === 'MemberExpression') {
    const member = expr as { object?: Expression; property?: { name?: string } };
    const obj = extractVariableName(member.object);
    const prop = member.property?.name;
    if (obj && prop) return `${obj}.${prop}`;
    return prop || obj;
  }
  
  return null;
}

function extractNumberValue(expr: Expression | undefined): number | null {
  if (!expr) return null;
  
  if (expr.kind === 'NumberLiteral') {
    return (expr as { value: number }).value;
  }
  
  return null;
}

function extractBooleanLiteral(expr: Expression | undefined): boolean | null {
  if (!expr) return null;
  
  if (expr.kind === 'BooleanLiteral') {
    return (expr as { value: boolean }).value;
  }
  
  return null;
}

function extractStringValue(expr: Expression | undefined): string | undefined {
  if (!expr) return undefined;
  
  if (expr.kind === 'StringLiteral') {
    return (expr as { value: string }).value;
  }
  
  return undefined;
}

function collectIdentifiersFromBlock(block: ConditionBlock | undefined, identifiers: Set<string>): void {
  if (!block) return;
  
  for (const condition of block.conditions || []) {
    for (const stmt of condition.statements || []) {
      collectIdentifiersFromExpression(stmt.expression, identifiers);
    }
  }
}

function collectIdentifiersFromExpression(expr: Expression | undefined, identifiers: Set<string>): void {
  if (!expr) return;
  
  walkExpression(expr, (node) => {
    if (node.kind === 'Identifier') {
      identifiers.add((node as { name: string }).name);
    }
    if (node.kind === 'MemberExpression') {
      const member = node as { object?: Expression; property?: Expression | { name?: string } };
      const objName = extractVariableName(member.object);
      
      // Property can be an Identifier or a simple object with name
      let propName: string | null = null;
      if (member.property) {
        if (typeof member.property === 'object' && 'kind' in member.property && member.property.kind === 'Identifier') {
          propName = (member.property as { name: string }).name;
        } else if (typeof member.property === 'object' && 'name' in member.property) {
          propName = member.property.name || null;
        }
      }
      
      if (objName) identifiers.add(objName);
      if (propName) identifiers.add(propName);
      if (objName && propName) identifiers.add(`${objName}.${propName}`);
    }
  });
}

function collectIdentifiersFromTemporal(temporal: TemporalBlock, identifiers: Set<string>): void {
  for (const req of temporal.requirements || []) {
    if (req.condition) {
      collectIdentifiersFromExpression(req.condition, identifiers);
    }
  }
}

function collectIdentifiersFromSecurity(security: SecurityBlock, identifiers: Set<string>): void {
  for (const req of security.requirements || []) {
    if (req.expression) {
      collectIdentifiersFromExpression(req.expression, identifiers);
    }
  }
}

function extractReferencedVariables(expr: Expression | undefined): Set<string> {
  const vars = new Set<string>();
  if (!expr) return vars;
  
  walkExpression(expr, (node) => {
    if (node.kind === 'Identifier') {
      const name = (node as { name: string }).name;
      // Skip keywords and common built-ins
      if (!isKeyword(name)) {
        vars.add(name);
      }
    }
  });
  
  return vars;
}

function isKeyword(name: string): boolean {
  const keywords = new Set([
    'true', 'false', 'null', 'undefined', 'per', 'within', 'response',
    'returned', 'and', 'or', 'not', 'if', 'then', 'else',
  ]);
  return keywords.has(name);
}

function walkExpression(expr: Expression | undefined, visitor: (node: Expression) => void): void {
  if (!expr || typeof expr !== 'object') return;
  
  visitor(expr);
  
  // Walk children based on expression kind
  const e = expr as Record<string, unknown>;
  
  if (e.left) walkExpression(e.left as Expression, visitor);
  if (e.right) walkExpression(e.right as Expression, visitor);
  if (e.object) walkExpression(e.object as Expression, visitor);
  if (e.property && typeof e.property === 'object') walkExpression(e.property as Expression, visitor);
  if (e.operand) walkExpression(e.operand as Expression, visitor);
  if (e.condition) walkExpression(e.condition as Expression, visitor);
  if (e.expression) walkExpression(e.expression as Expression, visitor);
  if (e.callee) walkExpression(e.callee as Expression, visitor);
  
  if (Array.isArray(e.arguments)) {
    for (const arg of e.arguments) {
      walkExpression(arg as Expression, visitor);
    }
  }
  
  if (Array.isArray(e.elements)) {
    for (const el of e.elements) {
      walkExpression(el as Expression, visitor);
    }
  }
}

// ============================================================================
// Exports for Testing
// ============================================================================

export const _internals = {
  checkInlineContradiction,
  checkAlwaysFalse,
  extractSingleConstraint,
  findNumericContradiction,
  extractConstraints,
  checkUnusedBehaviorSymbols,
  checkSecurityMetadata,
  checkTemporalMetadata,
  extractVariableName,
  extractNumberValue,
  extractBooleanLiteral,
  ERRORS,
};
