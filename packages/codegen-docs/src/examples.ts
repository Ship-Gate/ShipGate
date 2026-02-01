// ============================================================================
// Example Generation
// Generates example requests/responses for behaviors
// ============================================================================

import type * as AST from '../../../master_contracts/ast';

// ============================================================================
// TYPES
// ============================================================================

export interface GeneratedExample {
  name: string;
  content: string;
  type: 'request' | 'response' | 'error';
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate examples for all behaviors in a domain
 */
export function generateExamples(domain: AST.Domain): GeneratedExample[] {
  const examples: GeneratedExample[] = [];

  for (const behavior of domain.behaviors) {
    // Generate request example
    if (behavior.input.fields.length > 0) {
      examples.push({
        name: `${behavior.name.name} - Request`,
        content: JSON.stringify(generateRequestExample(behavior, domain), null, 2),
        type: 'request',
      });
    }

    // Generate success response example
    examples.push({
      name: `${behavior.name.name} - Success Response`,
      content: JSON.stringify(generateResponseExample(behavior, domain), null, 2),
      type: 'response',
    });

    // Generate error examples
    for (const error of behavior.output.errors) {
      examples.push({
        name: `${behavior.name.name} - ${error.name.name} Error`,
        content: JSON.stringify(generateErrorExample(error), null, 2),
        type: 'error',
      });
    }
  }

  return examples;
}

// ============================================================================
// REQUEST EXAMPLES
// ============================================================================

function generateRequestExample(behavior: AST.Behavior, domain: AST.Domain): Record<string, unknown> {
  const request: Record<string, unknown> = {};

  for (const field of behavior.input.fields) {
    if (!field.optional) {
      request[field.name.name] = generateExampleValue(field.type, field.name.name, domain);
    }
  }

  return request;
}

// ============================================================================
// RESPONSE EXAMPLES
// ============================================================================

function generateResponseExample(behavior: AST.Behavior, domain: AST.Domain): Record<string, unknown> {
  return {
    success: true,
    data: generateExampleValue(behavior.output.success, 'result', domain),
  };
}

// ============================================================================
// ERROR EXAMPLES
// ============================================================================

function generateErrorExample(error: AST.ErrorSpec): Record<string, unknown> {
  const example: Record<string, unknown> = {
    success: false,
    error: {
      code: error.name.name,
      message: error.when?.value ?? `${error.name.name} error occurred`,
      retriable: error.retriable,
    },
  };

  if (error.retryAfter) {
    example.retryAfter = formatDuration(error.retryAfter);
  }

  return example;
}

// ============================================================================
// VALUE GENERATION
// ============================================================================

function generateExampleValue(
  type: AST.TypeDefinition,
  fieldName: string,
  domain: AST.Domain,
  depth = 0
): unknown {
  // Prevent infinite recursion
  if (depth > 5) {
    return null;
  }

  switch (type.kind) {
    case 'PrimitiveType':
      return generatePrimitiveValue(type.name, fieldName);

    case 'ConstrainedType':
      return generateConstrainedValue(type, fieldName, domain, depth);

    case 'EnumType':
      return type.variants[0]?.name.name ?? 'UNKNOWN';

    case 'StructType':
      return generateStructValue(type.fields, domain, depth);

    case 'UnionType':
      if (type.variants.length > 0) {
        const variant = type.variants[0];
        return {
          type: variant.name.name,
          ...generateStructValue(variant.fields, domain, depth),
        };
      }
      return {};

    case 'ListType':
      return [generateExampleValue(type.element, fieldName, domain, depth + 1)];

    case 'MapType':
      return {
        exampleKey: generateExampleValue(type.value, 'value', domain, depth + 1),
      };

    case 'OptionalType':
      return generateExampleValue(type.inner, fieldName, domain, depth);

    case 'ReferenceType': {
      const refName = type.name.parts[type.name.parts.length - 1].name;
      
      // Check if it's an entity
      const entity = domain.entities.find(e => e.name.name === refName);
      if (entity) {
        return generateEntityExample(entity, domain, depth);
      }
      
      // Check if it's a type declaration
      const typeDecl = domain.types.find(t => t.name.name === refName);
      if (typeDecl) {
        return generateExampleValue(typeDecl.definition, refName, domain, depth);
      }
      
      return `<${refName}>`;
    }

    default:
      return null;
  }
}

function generatePrimitiveValue(typeName: string, fieldName: string): unknown {
  const lowerName = fieldName.toLowerCase();

  switch (typeName) {
    case 'String':
      // Try to generate contextual strings
      if (lowerName.includes('email')) return 'user@example.com';
      if (lowerName.includes('name')) return 'John Doe';
      if (lowerName.includes('password')) return '********';
      if (lowerName.includes('phone')) return '+1-555-123-4567';
      if (lowerName.includes('address')) return '123 Main St';
      if (lowerName.includes('city')) return 'San Francisco';
      if (lowerName.includes('country')) return 'US';
      if (lowerName.includes('url')) return 'https://example.com';
      if (lowerName.includes('key')) return 'example-key-123';
      if (lowerName.includes('token')) return 'tok_example123';
      if (lowerName.includes('id')) return 'example-id';
      return `example_${fieldName}`;

    case 'Int':
      if (lowerName.includes('age')) return 25;
      if (lowerName.includes('count')) return 10;
      if (lowerName.includes('quantity')) return 1;
      if (lowerName.includes('year')) return 2024;
      if (lowerName.includes('month')) return 12;
      if (lowerName.includes('day')) return 15;
      if (lowerName.includes('attempts')) return 0;
      return 42;

    case 'Decimal':
      if (lowerName.includes('price') || lowerName.includes('amount') || lowerName.includes('total')) {
        return 99.99;
      }
      if (lowerName.includes('rate') || lowerName.includes('percentage')) {
        return 5.5;
      }
      return 123.45;

    case 'Boolean':
      if (lowerName.includes('active') || lowerName.includes('enabled') || lowerName.includes('valid')) {
        return true;
      }
      if (lowerName.includes('deleted') || lowerName.includes('revoked') || lowerName.includes('disabled')) {
        return false;
      }
      return true;

    case 'Timestamp':
      return '2024-01-15T10:30:00Z';

    case 'UUID':
      return '550e8400-e29b-41d4-a716-446655440000';

    case 'Duration':
      return 'PT1H30M';

    default:
      return `<${typeName}>`;
  }
}

function generateConstrainedValue(
  type: AST.ConstrainedType,
  fieldName: string,
  domain: AST.Domain,
  depth: number
): unknown {
  let value = generateExampleValue(type.base, fieldName, domain, depth);

  // Apply constraints to generate more realistic values
  for (const constraint of type.constraints) {
    const constraintValue = extractValue(constraint.value);
    
    switch (constraint.name) {
      case 'min':
        if (typeof value === 'number' && typeof constraintValue === 'number') {
          value = Math.max(value, constraintValue);
        }
        break;
      case 'max':
        if (typeof value === 'number' && typeof constraintValue === 'number') {
          value = Math.min(value, constraintValue);
        }
        break;
      case 'min_length':
        if (typeof value === 'string' && typeof constraintValue === 'number') {
          while (value.length < constraintValue) {
            value += '_';
          }
        }
        break;
      case 'max_length':
        if (typeof value === 'string' && typeof constraintValue === 'number') {
          value = value.slice(0, constraintValue);
        }
        break;
      case 'precision':
        if (typeof value === 'number' && typeof constraintValue === 'number') {
          value = Number(value.toFixed(constraintValue));
        }
        break;
    }
  }

  return value;
}

function generateStructValue(
  fields: AST.Field[],
  domain: AST.Domain,
  depth: number
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const field of fields) {
    if (!field.optional || Math.random() > 0.5) {
      result[field.name.name] = generateExampleValue(field.type, field.name.name, domain, depth + 1);
    }
  }

  return result;
}

function generateEntityExample(
  entity: AST.Entity,
  domain: AST.Domain,
  depth: number
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const field of entity.fields) {
    // Skip secret/sensitive fields in examples
    const isSensitive = field.annotations.some(a => 
      ['secret', 'sensitive', 'pii'].includes(a.name.name)
    );
    
    if (isSensitive) {
      result[field.name.name] = '[REDACTED]';
      continue;
    }

    if (!field.optional) {
      result[field.name.name] = generateExampleValue(field.type, field.name.name, domain, depth + 1);
    }
  }

  return result;
}

// ============================================================================
// HELPERS
// ============================================================================

function extractValue(expr: AST.Expression): unknown {
  switch (expr.kind) {
    case 'NumberLiteral':
      return expr.value;
    case 'StringLiteral':
      return expr.value;
    case 'BooleanLiteral':
      return expr.value;
    default:
      return null;
  }
}

function formatDuration(expr: AST.Expression): string {
  if (expr.kind === 'DurationLiteral') {
    return `${expr.value}${expr.unit}`;
  }
  return '15 minutes';
}

// ============================================================================
// SCENARIO EXAMPLES
// ============================================================================

/**
 * Generate examples from scenario definitions
 */
export function generateScenarioExamples(
  scenarios: AST.ScenarioBlock,
  domain: AST.Domain
): GeneratedExample[] {
  const examples: GeneratedExample[] = [];

  for (const scenario of scenarios.scenarios) {
    examples.push({
      name: `Scenario: ${scenario.name.value}`,
      content: JSON.stringify({
        scenario: scenario.name.value,
        behavior: scenarios.behaviorName.name,
        given: 'Initial state setup',
        when: 'Action performed',
        then: scenario.then.map(expr => formatExpression(expr)),
      }, null, 2),
      type: 'request',
    });
  }

  return examples;
}

function formatExpression(expr: AST.Expression): string {
  switch (expr.kind) {
    case 'Identifier':
      return expr.name;
    case 'BinaryExpr':
      return `${formatExpression(expr.left)} ${expr.operator} ${formatExpression(expr.right)}`;
    case 'MemberExpr':
      return `${formatExpression(expr.object)}.${expr.property.name}`;
    case 'CallExpr':
      return `${formatExpression(expr.callee)}(...)`;
    default:
      return '...';
  }
}
