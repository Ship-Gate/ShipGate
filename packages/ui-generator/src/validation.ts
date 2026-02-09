// ============================================================================
// Validation Extraction
// Derives client-side validation rules from ISL constraints & preconditions
// ============================================================================

import type * as AST from '@isl-lang/isl-core';
import type { ValidationRule } from './types.js';

/**
 * Extract validation rules from a single FieldDeclaration.
 * Sources: field.optional, field.constraints, field.annotations, field type.
 */
export function extractFieldValidation(field: AST.FieldDeclaration): ValidationRule[] {
  const rules: ValidationRule[] = [];
  const fieldName = toLabel(field.name.name);

  // Required check (non-optional fields)
  if (!field.optional) {
    rules.push({ type: 'required', message: `${fieldName} is required` });
  }

  // Inline constraints (e.g. min, max, minLength, maxLength, pattern)
  for (const c of field.constraints ?? []) {
    const cName = c.name.name.toLowerCase();
    const val = extractLiteralValue(c.value);

    switch (cName) {
      case 'minlength':
      case 'min_length':
        rules.push({
          type: 'minLength',
          value: val as number,
          message: `${fieldName} must be at least ${val} characters`,
        });
        break;
      case 'maxlength':
      case 'max_length':
        rules.push({
          type: 'maxLength',
          value: val as number,
          message: `${fieldName} must be at most ${val} characters`,
        });
        break;
      case 'min':
        rules.push({
          type: 'min',
          value: val as number,
          message: `${fieldName} must be at least ${val}`,
        });
        break;
      case 'max':
        rules.push({
          type: 'max',
          value: val as number,
          message: `${fieldName} must be at most ${val}`,
        });
        break;
      case 'pattern':
      case 'regex':
        rules.push({
          type: 'pattern',
          value: val as string,
          message: `${fieldName} has an invalid format`,
        });
        break;
      case 'email':
        rules.push({
          type: 'email',
          message: `${fieldName} must be a valid email`,
        });
        break;
    }
  }

  // Annotation-based validation
  for (const a of field.annotations ?? []) {
    const aName = a.name.name.toLowerCase();
    if (aName === 'unique' || aName === 'indexed' || aName === 'immutable') {
      // These are storage-level — skip for client validation
      continue;
    }
  }

  // Type-based heuristics
  const typeName = resolveSimpleTypeName(field.type);
  const nameLC = field.name.name.toLowerCase();

  if (nameLC.includes('email') && !rules.some((r) => r.type === 'email')) {
    rules.push({ type: 'email', message: `${fieldName} must be a valid email` });
  }

  if (typeName === 'UUID' && !field.optional) {
    rules.push({
      type: 'pattern',
      value: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
      message: `${fieldName} must be a valid UUID`,
    });
  }

  return rules;
}

/**
 * Extract cross-field / behavior-level validation rules from preconditions.
 * E.g. `password.length >= 8` → minLength(8) on password field.
 * E.g. `amount > 0` → min(1) on amount field.
 */
export function extractBehaviorValidation(
  behavior: AST.BehaviorDeclaration,
): ValidationRule[] {
  const rules: ValidationRule[] = [];

  if (!behavior.preconditions) return rules;

  for (const condition of behavior.preconditions.conditions ?? []) {
    for (const stmt of condition.statements ?? []) {
      const extracted = parseConditionExpr(stmt.expression);
      if (extracted) {
        rules.push(extracted);
      }
    }
  }

  return rules;
}

// ============================================================================
// Expression Parsing Helpers
// ============================================================================

function parseConditionExpr(expr: AST.Expression): ValidationRule | null {
  // Handle `field.length >= N`  →  minLength
  if (expr.kind === 'ComparisonExpression' || expr.kind === 'BinaryExpression') {
    const { left, operator, right } = expr as AST.ComparisonExpression;
    return parseComparison(left, operator, right);
  }

  // Handle `field.is_valid`  →  custom validation placeholder
  if (expr.kind === 'MemberExpression') {
    const me = expr as AST.MemberExpression;
    if (me.property.name === 'is_valid') {
      const fieldName = extractIdentName(me.object);
      if (fieldName) {
        return {
          type: 'custom',
          value: `${fieldName}.is_valid`,
          message: `${toLabel(fieldName)} must be valid`,
        };
      }
    }
  }

  return null;
}

function parseComparison(
  left: AST.Expression,
  operator: string,
  right: AST.Expression,
): ValidationRule | null {
  // `field.length >= N`
  if (left.kind === 'MemberExpression') {
    const me = left as AST.MemberExpression;
    if (me.property.name === 'length') {
      const fieldName = extractIdentName(me.object);
      const val = extractLiteralValue(right);
      if (fieldName && typeof val === 'number') {
        if (operator === '>=' || operator === '>') {
          const min = operator === '>' ? val + 1 : val;
          return {
            type: 'minLength',
            value: min,
            field: fieldName,
            message: `${toLabel(fieldName)} must be at least ${min} characters`,
          };
        }
        if (operator === '<=' || operator === '<') {
          const max = operator === '<' ? val - 1 : val;
          return {
            type: 'maxLength',
            value: max,
            field: fieldName,
            message: `${toLabel(fieldName)} must be at most ${max} characters`,
          };
        }
      }
    }
  }

  // `amount > 0`
  const leftName = extractIdentName(left);
  const rightVal = extractLiteralValue(right);

  if (leftName && typeof rightVal === 'number') {
    if (operator === '>' || operator === '>=') {
      const min = operator === '>' ? rightVal + 1 : rightVal;
      return {
        type: 'min',
        value: min,
        field: leftName,
        message: `${toLabel(leftName)} must be at least ${min}`,
      };
    }
    if (operator === '<' || operator === '<=') {
      const max = operator === '<' ? rightVal - 1 : rightVal;
      return {
        type: 'max',
        value: max,
        field: leftName,
        message: `${toLabel(leftName)} must be at most ${max}`,
      };
    }
  }

  // `password == confirm_password`  →  matches rule
  const rightName = extractIdentName(right);
  if (leftName && rightName && operator === '==') {
    return {
      type: 'matches',
      value: rightName,
      field: leftName,
      message: `${toLabel(leftName)} must match ${toLabel(rightName)}`,
    };
  }

  return null;
}

// ============================================================================
// Utility Helpers
// ============================================================================

function extractLiteralValue(
  expr: AST.Expression | undefined,
): number | string | boolean | undefined {
  if (!expr) return undefined;
  if (expr.kind === 'NumberLiteral') return (expr as AST.NumberLiteral).value;
  if (expr.kind === 'StringLiteral') return (expr as AST.StringLiteral).value;
  if (expr.kind === 'BooleanLiteral') return (expr as AST.BooleanLiteral).value;
  return undefined;
}

function extractIdentName(expr: AST.Expression): string | null {
  if (expr.kind === 'Identifier') return (expr as AST.Identifier).name;
  return null;
}

function resolveSimpleTypeName(type: AST.TypeExpression): string {
  if (type.kind === 'SimpleType') return type.name.name;
  return '';
}

function toLabel(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
