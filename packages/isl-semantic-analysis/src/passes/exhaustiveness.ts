/**
 * Exhaustiveness & Pattern Coverage Pass
 * 
 * Checks that pattern matching and conditional logic is exhaustive:
 * - Enum variant coverage in guards/conditions
 * - Union type handling
 * - Error handler completeness
 * - Default/else branch requirements
 * 
 * @module @isl-lang/semantic-analysis
 */

import type { Diagnostic } from '@isl-lang/errors';
import type {
  DomainDeclaration,
  BehaviorDeclaration,
  Expression,
} from '@isl-lang/isl-core';
import type { SemanticPass, PassContext, TypeEnvironment } from '../types.js';
import { spanToLocation } from '../types.js';

// ============================================================================
// Error Codes
// ============================================================================

const ERRORS = {
  NON_EXHAUSTIVE_PATTERN: 'E0700',
  MISSING_ENUM_VARIANT: 'E0701',
  REDUNDANT_PATTERN: 'E0702',
  UNREACHABLE_DEFAULT: 'E0703',
  SUGGEST_EXHAUSTIVE: 'E0704',
  MISSING_ERROR_HANDLER: 'E0705',
  OVERLAPPING_GUARDS: 'E0706',
} as const;

// ============================================================================
// Types
// ============================================================================

interface PatternInfo {
  pattern: string;
  expression: Expression;
  enumType?: string;
}

interface EnumInfo {
  name: string;
  variants: string[];
}

// ============================================================================
// Pass Definition
// ============================================================================

export const ExhaustivenessPass: SemanticPass = {
  id: 'exhaustiveness',
  name: 'Exhaustiveness',
  description: 'Checks pattern matching exhaustiveness and coverage',
  dependencies: ['type-coherence'],
  priority: 70,
  enabledByDefault: true,

  run(ctx: PassContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { ast, filePath, typeEnv } = ctx;

    // Collect enum definitions
    const enums = collectEnums(ast);

    for (const behavior of ast.behaviors || []) {
      // Check precondition guard coverage
      diagnostics.push(...checkPreconditionExhaustiveness(behavior, enums, filePath));
      
      // Check postcondition coverage for all error cases
      diagnostics.push(...checkPostconditionErrorCoverage(behavior, filePath));
      
      // Check condition blocks for enum exhaustiveness
      diagnostics.push(...checkConditionBlockExhaustiveness(behavior, enums, filePath, typeEnv));
    }

    return diagnostics;
  },
};

export const exhaustivenessPass = ExhaustivenessPass;

// ============================================================================
// Enum Collection
// ============================================================================

function collectEnums(ast: DomainDeclaration): Map<string, EnumInfo> {
  const enums = new Map<string, EnumInfo>();

  for (const enumDecl of ast.enums || []) {
    const name = enumDecl.name?.name || '';
    const variants: string[] = [];

    // Handle various enum declaration shapes
    const decl = enumDecl as unknown as {
      variants?: Array<{ name?: string | { name?: string } }>;
      values?: Array<{ name?: string | { name?: string } }>;
      members?: Array<{ name?: string | { name?: string } }>;
    };

    const variantList = decl.variants || decl.values || decl.members || [];
    for (const v of variantList) {
      const variantName = typeof v.name === 'string' ? v.name : v.name?.name;
      if (variantName) {
        variants.push(variantName);
      }
    }

    if (name && variants.length > 0) {
      enums.set(name, { name, variants });
    }
  }

  return enums;
}

// ============================================================================
// Precondition Exhaustiveness
// ============================================================================

function checkPreconditionExhaustiveness(
  behavior: BehaviorDeclaration,
  enums: Map<string, EnumInfo>,
  filePath: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const preconditions = behavior.preconditions;

  if (!preconditions) return diagnostics;

  // Group guards by variable
  const guardsByVariable = new Map<string, PatternInfo[]>();

  for (const condition of preconditions.conditions || []) {
    const guard = (condition as { guard?: Expression }).guard;
    if (guard) {
      const pattern = analyzeGuardPattern(guard, enums);
      if (pattern) {
        const existing = guardsByVariable.get(pattern.variable) || [];
        existing.push({
          pattern: pattern.value,
          expression: guard,
          enumType: pattern.enumType,
        });
        guardsByVariable.set(pattern.variable, existing);
      }
    }
  }

  // Check each variable's coverage
  for (const [variable, patterns] of guardsByVariable) {
    const firstPattern = patterns[0];
    if (firstPattern?.enumType) {
      const enumInfo = enums.get(firstPattern.enumType);
      if (enumInfo) {
        const coveredVariants = new Set(patterns.map(p => p.pattern));
        const missingVariants = enumInfo.variants.filter(v => !coveredVariants.has(v));

        if (missingVariants.length > 0) {
          diagnostics.push({
            code: ERRORS.MISSING_ENUM_VARIANT,
            category: 'semantic',
            severity: 'warning',
            message: `Non-exhaustive guard on '${variable}': missing ${missingVariants.map(v => `'${v}'`).join(', ')}`,
            location: getNodeLocation(firstPattern.expression, filePath),
            source: 'verifier',
            notes: [
              `In preconditions of behavior '${behavior.name.name}'`,
              `Enum '${firstPattern.enumType}' has variants: ${enumInfo.variants.join(', ')}`,
            ],
            help: [
              `Add guards for: ${missingVariants.join(', ')}`,
              'Or add a default case to handle remaining variants',
            ],
          });
        }

        // Check for redundant patterns
        const seen = new Set<string>();
        for (const pattern of patterns) {
          if (seen.has(pattern.pattern)) {
            diagnostics.push({
              code: ERRORS.REDUNDANT_PATTERN,
              category: 'semantic',
              severity: 'warning',
              message: `Redundant guard: '${pattern.pattern}' is already covered`,
              location: getNodeLocation(pattern.expression, filePath),
              source: 'verifier',
              tags: ['unnecessary'],
              help: ['Remove the duplicate guard'],
            });
          }
          seen.add(pattern.pattern);
        }
      }
    }
  }

  return diagnostics;
}

// ============================================================================
// Postcondition Error Coverage
// ============================================================================

function checkPostconditionErrorCoverage(
  behavior: BehaviorDeclaration,
  filePath: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  
  // Get declared errors from output
  const output = behavior.output;
  if (!output) return diagnostics;

  const declaredErrors: string[] = [];
  
  // Handle various output shapes
  const outputNode = output as unknown as {
    errors?: Array<{ name?: string | { name?: string } }>;
    failure?: Array<{ name?: string | { name?: string } }>;
  };

  const errorList = outputNode.errors || outputNode.failure || [];
  for (const err of errorList) {
    const name = typeof err.name === 'string' ? err.name : err.name?.name;
    if (name) {
      declaredErrors.push(name);
    }
  }

  if (declaredErrors.length === 0) return diagnostics;

  // Check which error cases are covered in postconditions
  const postconditions = behavior.postconditions;
  if (!postconditions) {
    // No postconditions at all
    diagnostics.push({
      code: ERRORS.MISSING_ERROR_HANDLER,
      category: 'semantic',
      severity: 'warning',
      message: `No postconditions defined for declared errors: ${declaredErrors.join(', ')}`,
      location: spanToLocation(behavior.span, filePath),
      source: 'verifier',
      notes: [
        `Behavior '${behavior.name.name}' declares errors but has no postconditions`,
      ],
      help: [
        'Add postconditions for each error case',
        'Example: when error.name == "NotFound" { ... }',
      ],
    });
    return diagnostics;
  }

  // Find which error cases are covered
  const coveredErrors = new Set<string>();

  for (const condition of postconditions.conditions || []) {
    const guard = (condition as { guard?: Expression }).guard;
    const conditionType = (condition as { type?: string; condition?: string }).type 
      || (condition as { condition?: string }).condition;

    // Check for 'when error' or 'when ErrorName' patterns
    if (conditionType) {
      for (const err of declaredErrors) {
        if (conditionType === err || conditionType.includes(err)) {
          coveredErrors.add(err);
        }
      }
    }

    // Check guard for error comparison
    if (guard) {
      const errorName = extractErrorName(guard);
      if (errorName && declaredErrors.includes(errorName)) {
        coveredErrors.add(errorName);
      }
    }

    // Check for 'any_error' or 'error' catch-all
    if (conditionType === 'any_error' || conditionType === 'error') {
      // This covers all errors
      for (const err of declaredErrors) {
        coveredErrors.add(err);
      }
    }
  }

  // Report missing error handlers
  const missingErrors = declaredErrors.filter(e => !coveredErrors.has(e));
  if (missingErrors.length > 0) {
    diagnostics.push({
      code: ERRORS.MISSING_ERROR_HANDLER,
      category: 'semantic',
      severity: 'warning',
      message: `Missing postconditions for error cases: ${missingErrors.join(', ')}`,
      location: spanToLocation(postconditions.span || behavior.span, filePath),
      source: 'verifier',
      notes: [
        `In behavior '${behavior.name.name}'`,
        'Each declared error should have a corresponding postcondition',
      ],
      help: missingErrors.map(e => `Add: when ${e} { ... }`),
    });
  }

  return diagnostics;
}

// ============================================================================
// Condition Block Exhaustiveness
// ============================================================================

function checkConditionBlockExhaustiveness(
  behavior: BehaviorDeclaration,
  enums: Map<string, EnumInfo>,
  filePath: string,
  typeEnv: TypeEnvironment
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Check for conditional expressions in the behavior
  const checkBlock = (block: { conditions?: unknown[] } | null | undefined) => {
    if (!block) return;

    for (const condition of block.conditions || []) {
      const cond = condition as { expression?: Expression };
      if (cond.expression) {
        diagnostics.push(...checkConditionalExhaustiveness(
          cond.expression,
          enums,
          behavior.name.name,
          filePath,
          typeEnv
        ));
      }
    }
  };

  checkBlock(behavior.preconditions);
  checkBlock(behavior.postconditions);

  return diagnostics;
}

function checkConditionalExhaustiveness(
  expr: Expression,
  enums: Map<string, EnumInfo>,
  behaviorName: string,
  filePath: string,
  _typeEnv: TypeEnvironment
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const exprKind = (expr as { kind: string }).kind;

  // Check for ternary/conditional expressions
  if (exprKind === 'ConditionalExpr' || exprKind === 'ConditionalExpression') {
    const cond = expr as { condition?: Expression };
    if (cond.condition) {
      const enumCheck = analyzeEnumComparison(cond.condition, enums);
      if (enumCheck) {
        // Single comparison is not exhaustive for multi-variant enums
        const enumInfo = enums.get(enumCheck.enumType);
        if (enumInfo && enumInfo.variants.length > 2) {
          diagnostics.push({
            code: ERRORS.SUGGEST_EXHAUSTIVE,
            category: 'semantic',
            severity: 'hint',
            message: `Consider exhaustive match for enum '${enumCheck.enumType}' instead of ternary`,
            location: getNodeLocation(expr, filePath),
            source: 'verifier',
            notes: [
              `In behavior '${behaviorName}'`,
              `Enum has ${enumInfo.variants.length} variants: ${enumInfo.variants.join(', ')}`,
            ],
            help: [
              'Use separate when clauses for each variant',
              'Or ensure the else branch handles all remaining cases',
            ],
          });
        }
      }
    }
  }

  // Recursively check nested expressions
  walkExpression(expr, (node) => {
    const nodeKind = (node as { kind: string }).kind;
    if (node !== expr && (nodeKind === 'ConditionalExpr' || nodeKind === 'ConditionalExpression')) {
      diagnostics.push(...checkConditionalExhaustiveness(
        node,
        enums,
        behaviorName,
        filePath,
        _typeEnv
      ));
    }
  });

  return diagnostics;
}

// ============================================================================
// Helper Functions
// ============================================================================

interface GuardPattern {
  variable: string;
  value: string;
  enumType?: string;
}

function analyzeGuardPattern(guard: Expression, enums: Map<string, EnumInfo>): GuardPattern | null {
  // Handle comparison expressions: x == EnumType.Variant
  if (guard.kind === 'ComparisonExpression' || guard.kind === 'BinaryExpression') {
    const comparison = guard as {
      left?: Expression;
      operator?: string;
      right?: Expression;
    };

    if (comparison.operator !== '==' && comparison.operator !== '===') {
      return null;
    }

    const leftVar = extractVariableName(comparison.left);
    const rightValue = extractEnumValue(comparison.right, enums);

    if (leftVar && rightValue) {
      return {
        variable: leftVar,
        value: rightValue.variant,
        enumType: rightValue.enumType,
      };
    }

    // Try the reverse (EnumType.Variant == x)
    const rightVar = extractVariableName(comparison.right);
    const leftValue = extractEnumValue(comparison.left, enums);

    if (rightVar && leftValue) {
      return {
        variable: rightVar,
        value: leftValue.variant,
        enumType: leftValue.enumType,
      };
    }
  }

  return null;
}

function analyzeEnumComparison(
  expr: Expression,
  enums: Map<string, EnumInfo>
): { variable: string; value: string; enumType: string } | null {
  if (expr.kind === 'ComparisonExpression' || expr.kind === 'BinaryExpression') {
    const comparison = expr as {
      left?: Expression;
      operator?: string;
      right?: Expression;
    };

    const leftVar = extractVariableName(comparison.left);
    const rightValue = extractEnumValue(comparison.right, enums);

    if (leftVar && rightValue) {
      return {
        variable: leftVar,
        value: rightValue.variant,
        enumType: rightValue.enumType,
      };
    }
  }

  return null;
}

function extractVariableName(expr: Expression | undefined): string | null {
  if (!expr) return null;
  const exprKind = (expr as { kind: string }).kind;

  if (exprKind === 'Identifier') {
    return (expr as { name: string }).name;
  }

  if (exprKind === 'MemberExpression' || exprKind === 'MemberExpr') {
    const member = expr as { object?: Expression; property?: Expression | { name?: string } };
    const objName = extractVariableName(member.object);
    const propName = member.property 
      ? (typeof member.property === 'object' && 'name' in member.property 
        ? member.property.name 
        : extractVariableName(member.property as Expression))
      : null;
    
    if (objName && propName) return `${objName}.${propName}`;
    return propName || objName;
  }

  return null;
}

function extractEnumValue(
  expr: Expression | undefined,
  enums: Map<string, EnumInfo>
): { enumType: string; variant: string } | null {
  if (!expr) return null;
  const exprKind = (expr as { kind: string }).kind;

  // Handle EnumType.Variant
  if (exprKind === 'MemberExpression' || exprKind === 'MemberExpr') {
    const member = expr as { object?: Expression; property?: Expression | { name?: string } };
    const enumName = extractVariableName(member.object);
    const variantName = member.property 
      ? (typeof member.property === 'object' && 'name' in member.property 
        ? member.property.name 
        : extractVariableName(member.property as Expression))
      : null;

    if (enumName && variantName && enums.has(enumName)) {
      return { enumType: enumName, variant: variantName };
    }
  }

  // Handle string literal that matches enum variant
  if (exprKind === 'StringLiteral') {
    const value = (expr as { value: string }).value;
    // Check if this value is a variant of any enum
    for (const [enumName, enumInfo] of enums) {
      if (enumInfo.variants.includes(value)) {
        return { enumType: enumName, variant: value };
      }
    }
  }

  return null;
}

function extractErrorName(guard: Expression): string | null {
  // Look for patterns like: error.name == "NotFound" or error == NotFound
  if (guard.kind === 'ComparisonExpression' || guard.kind === 'BinaryExpression') {
    const comparison = guard as {
      left?: Expression;
      right?: Expression;
    };

    // Check left side for error reference
    const leftVar = extractVariableName(comparison.left);
    if (leftVar === 'error' || leftVar?.startsWith('error.')) {
      // Right side should be the error name
      if (comparison.right?.kind === 'StringLiteral') {
        return (comparison.right as { value: string }).value;
      }
      if (comparison.right?.kind === 'Identifier') {
        return (comparison.right as { name: string }).name;
      }
    }

    // Check right side
    const rightVar = extractVariableName(comparison.right);
    if (rightVar === 'error' || rightVar?.startsWith('error.')) {
      if (comparison.left?.kind === 'StringLiteral') {
        return (comparison.left as { value: string }).value;
      }
      if (comparison.left?.kind === 'Identifier') {
        return (comparison.left as { name: string }).name;
      }
    }
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

function walkExpression(expr: Expression, visitor: (node: Expression) => void): void {
  if (!expr || typeof expr !== 'object') return;

  visitor(expr);

  const e = expr as unknown as Record<string, unknown>;

  const props = [
    'left', 'right', 'operand', 'object', 'property',
    'callee', 'condition', 'thenBranch', 'elseBranch',
    'expression', 'test', 'consequent', 'alternate',
  ];

  for (const prop of props) {
    if (e[prop] && typeof e[prop] === 'object') {
      walkExpression(e[prop] as Expression, visitor);
    }
  }

  const arrayProps = ['arguments', 'elements'];
  for (const prop of arrayProps) {
    if (Array.isArray(e[prop])) {
      for (const item of e[prop] as unknown[]) {
        if (item && typeof item === 'object') {
          walkExpression(item as Expression, visitor);
        }
      }
    }
  }
}

// ============================================================================
// Exports for Testing
// ============================================================================

export const _internals = {
  collectEnums,
  analyzeGuardPattern,
  extractVariableName,
  extractEnumValue,
  extractErrorName,
  ERRORS,
};
