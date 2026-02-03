// ============================================================================
// Property Extraction - Extract testable properties from ISL behaviors
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type {
  Property,
  BehaviorProperties,
  InputFieldSpec,
  FieldConstraints,
} from './types.js';

// ============================================================================
// MAIN EXTRACTION
// ============================================================================

/**
 * Extract all testable properties from a behavior
 */
export function extractProperties(
  behavior: AST.Behavior,
  domain: AST.Domain
): BehaviorProperties {
  return {
    behaviorName: behavior.name.name,
    domain,
    preconditions: extractPreconditions(behavior),
    postconditions: extractPostconditions(behavior),
    invariants: extractInvariants(behavior),
    inputSpec: extractInputSpec(behavior, domain),
  };
}

// ============================================================================
// PRECONDITIONS
// ============================================================================

/**
 * Extract preconditions from behavior
 */
function extractPreconditions(behavior: AST.Behavior): Property[] {
  const properties: Property[] = [];
  
  if (!behavior.preconditions) {
    return properties;
  }
  
  for (const condition of behavior.preconditions.conditions) {
    for (const stmt of condition.statements) {
      properties.push({
        name: expressionToString(stmt.expression),
        type: 'precondition',
        expression: stmt.expression,
        location: stmt.location,
      });
    }
  }
  
  return properties;
}

// ============================================================================
// POSTCONDITIONS
// ============================================================================

/**
 * Extract postconditions from behavior
 */
function extractPostconditions(behavior: AST.Behavior): Property[] {
  const properties: Property[] = [];
  
  if (!behavior.postconditions) {
    return properties;
  }
  
  for (const condition of behavior.postconditions.conditions) {
    // Determine guard
    let guard: string | undefined;
    if (condition.guard) {
      if (typeof condition.guard === 'string') {
        guard = condition.guard; // 'success' or 'failure'
      } else {
        guard = condition.guard.name; // Error identifier
      }
    }
    
    for (const stmt of condition.statements) {
      properties.push({
        name: expressionToString(stmt.expression),
        type: 'postcondition',
        expression: stmt.expression,
        guard,
        location: stmt.location,
      });
    }
  }
  
  return properties;
}

// ============================================================================
// INVARIANTS
// ============================================================================

/**
 * Extract invariants from behavior
 */
function extractInvariants(behavior: AST.Behavior): Property[] {
  const properties: Property[] = [];
  
  if (!behavior.invariants) {
    return properties;
  }
  
  for (const condition of behavior.invariants.conditions) {
    for (const stmt of condition.statements) {
      // Handle special invariant expressions like "password never_logged"
      const invariantStr = expressionToString(stmt.expression);
      
      properties.push({
        name: invariantStr,
        type: 'invariant',
        expression: stmt.expression,
        location: stmt.location,
      });
    }
  }
  
  return properties;
}

// ============================================================================
// INPUT SPECIFICATION
// ============================================================================

/**
 * Extract input field specifications
 */
function extractInputSpec(
  behavior: AST.Behavior,
  domain: AST.Domain
): InputFieldSpec[] {
  const specs: InputFieldSpec[] = [];
  
  if (!behavior.input) {
    return specs;
  }
  
  for (const field of behavior.input.fields) {
    const constraints = extractConstraints(field.type, domain);
    const sensitive = field.annotations?.some(
      (a) => a.name === 'sensitive' || a.name === 'secret' || a.name === 'pii'
    ) ?? false;
    
    specs.push({
      name: field.name.name,
      type: field.type,
      constraints,
      optional: field.optional ?? false,
      sensitive,
    });
  }
  
  return specs;
}

/**
 * Extract constraints from a type definition
 */
function extractConstraints(
  type: AST.TypeDefinition,
  domain: AST.Domain
): FieldConstraints {
  const constraints: FieldConstraints = {};
  
  switch (type.kind) {
    case 'ConstrainedType':
      // Extract constraints from annotations
      for (const constraint of type.constraints) {
        const value = extractLiteralValue(constraint.value);
        switch (constraint.name.toLowerCase()) {
          case 'min':
            constraints.min = value as number;
            break;
          case 'max':
            constraints.max = value as number;
            break;
          case 'min_length':
          case 'minlength':
            constraints.minLength = value as number;
            break;
          case 'max_length':
          case 'maxlength':
            constraints.maxLength = value as number;
            break;
          case 'format':
            constraints.format = value as string;
            break;
          case 'pattern':
            constraints.pattern = new RegExp(value as string);
            break;
        }
      }
      // Merge with base type constraints
      const baseConstraints = extractConstraints(type.base, domain);
      return { ...baseConstraints, ...constraints };
    
    case 'ReferenceType': {
      // Look up the type definition
      const refName = type.name.parts.map((p) => p.name).join('.');
      const typeDef = domain.types.find((t) => t.name.name === refName);
      if (typeDef) {
        return extractConstraints(typeDef.definition, domain);
      }
      return constraints;
    }
    
    case 'EnumType':
      constraints.enum = type.variants.map((v) => v.name.name);
      return constraints;
    
    case 'PrimitiveType':
      // Set default constraints based on primitive type
      switch (type.name) {
        case 'Email':
          constraints.format = 'email';
          constraints.maxLength = 254;
          break;
        case 'UUID':
          constraints.format = 'uuid';
          break;
      }
      return constraints;
    
    default:
      return constraints;
  }
}

/**
 * Extract literal value from expression
 */
function extractLiteralValue(expr: AST.Expression): unknown {
  switch (expr.kind) {
    case 'NumberLiteral':
      return expr.value;
    case 'StringLiteral':
      return expr.value;
    case 'BooleanLiteral':
      return expr.value;
    default:
      return undefined;
  }
}

// ============================================================================
// EXPRESSION UTILITIES
// ============================================================================

/**
 * Convert expression to readable string
 */
export function expressionToString(expr: AST.Expression): string {
  switch (expr.kind) {
    case 'Identifier':
      return expr.name;
    
    case 'QualifiedName':
      return expr.parts.map((p) => p.name).join('.');
    
    case 'StringLiteral':
      return `"${expr.value}"`;
    
    case 'NumberLiteral':
      return String(expr.value);
    
    case 'BooleanLiteral':
      return String(expr.value);
    
    case 'NullLiteral':
      return 'null';
    
    case 'BinaryExpr':
      return `${expressionToString(expr.left)} ${expr.operator} ${expressionToString(expr.right)}`;
    
    case 'UnaryExpr':
      return `${expr.operator} ${expressionToString(expr.operand)}`;
    
    case 'CallExpr':
      const callee = expressionToString(expr.callee);
      const args = expr.arguments.map(expressionToString).join(', ');
      return `${callee}(${args})`;
    
    case 'MemberExpr':
      return `${expressionToString(expr.object)}.${expr.property.name}`;
    
    case 'IndexExpr':
      return `${expressionToString(expr.object)}[${expressionToString(expr.index)}]`;
    
    case 'QuantifierExpr':
      return `${expr.quantifier} ${expr.variable.name} in ${expressionToString(expr.collection)}: ${expressionToString(expr.predicate)}`;
    
    case 'ConditionalExpr':
      return `if ${expressionToString(expr.condition)} then ${expressionToString(expr.thenBranch)} else ${expressionToString(expr.elseBranch)}`;
    
    case 'OldExpr':
      return `old(${expressionToString(expr.expression)})`;
    
    case 'ResultExpr':
      return expr.property ? `result.${expr.property.name}` : 'result';
    
    case 'InputExpr':
      return `input.${expr.property.name}`;
    
    case 'ListExpr':
      return `[${expr.elements.map(expressionToString).join(', ')}]`;
    
    default:
      return '<unknown>';
  }
}

/**
 * Check if a property is a PII invariant (e.g., "password never_logged")
 */
export function isPIIInvariant(property: Property): { field: string; rule: string } | null {
  const str = property.name;
  
  // Match patterns like "password never_logged" or "password never_stored_plaintext"
  const match = str.match(/^(\w+)\s+(never_logged|never_stored_plaintext|never_exposed)$/);
  if (match) {
    return {
      field: match[1]!,
      rule: match[2]!,
    };
  }
  
  return null;
}

/**
 * Get all fields that should never be logged
 */
export function getNeverLoggedFields(properties: BehaviorProperties): string[] {
  const fields: string[] = [];
  
  for (const inv of properties.invariants) {
    const pii = isPIIInvariant(inv);
    if (pii && pii.rule === 'never_logged') {
      fields.push(pii.field);
    }
  }
  
  return fields;
}

/**
 * Find behavior by name in domain
 */
export function findBehavior(domain: AST.Domain, name: string): AST.Behavior | undefined {
  return domain.behaviors.find((b) => b.name.name === name);
}

/**
 * Get entity fields marked as sensitive
 */
export function getSensitiveFields(domain: AST.Domain): Map<string, string[]> {
  const result = new Map<string, string[]>();
  
  for (const entity of domain.entities) {
    const sensitiveFields: string[] = [];
    for (const field of entity.fields) {
      const isSensitive = field.annotations?.some(
        (a) => a.name === 'secret' || a.name === 'sensitive' || a.name === 'pii'
      );
      if (isSensitive) {
        sensitiveFields.push(field.name.name);
      }
    }
    if (sensitiveFields.length > 0) {
      result.set(entity.name.name, sensitiveFields);
    }
  }
  
  return result;
}
