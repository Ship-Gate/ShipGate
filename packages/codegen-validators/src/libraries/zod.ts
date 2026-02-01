// ============================================================================
// Zod Validator Generator
// ============================================================================

import type * as AST from '@isl-lang/isl-core';
import type { GenerateOptions, ValidatorDefinition } from '../types';

/**
 * Generate Zod schema from ISL type
 */
export function generateZodSchema(
  name: string,
  type: AST.TypeExpression,
  options: GenerateOptions
): string {
  return `export const ${name}Schema = ${generateZodType(type, options)};`;
}

/**
 * Generate Zod type from ISL type expression
 */
export function generateZodType(type: AST.TypeExpression, options: GenerateOptions): string {
  switch (type.kind) {
    case 'primitive':
      return generateZodPrimitive(type.name, options);

    case 'reference':
      return `${type.name}Schema`;

    case 'list':
      return `z.array(${generateZodType(type.elementType, options)})`;

    case 'map':
      return `z.record(${generateZodType(type.keyType, options)}, ${generateZodType(type.valueType, options)})`;

    case 'optional':
      return `${generateZodType(type.innerType, options)}.optional()`;

    case 'union':
      const variants = type.variants.map((v) => generateZodType(v, options));
      return `z.union([${variants.join(', ')}])`;

    default:
      return 'z.unknown()';
  }
}

/**
 * Generate Zod primitive type
 */
function generateZodPrimitive(name: string, options: GenerateOptions): string {
  const primitiveMap: Record<string, string> = {
    'String': 'z.string()',
    'Int': 'z.number().int()',
    'Integer': 'z.number().int()',
    'Float': 'z.number()',
    'Double': 'z.number()',
    'Decimal': 'z.number()',
    'Boolean': 'z.boolean()',
    'Bool': 'z.boolean()',
    'UUID': 'z.string().uuid()',
    'Timestamp': 'z.date()',
    'Date': 'z.date()',
    'DateTime': 'z.date()',
    'Email': 'z.string().email()',
    'URL': 'z.string().url()',
    'Money': 'z.number().nonnegative()',
    'JSON': 'z.unknown()',
  };

  return primitiveMap[name] || 'z.string()';
}

/**
 * Generate Zod schema for entity
 */
export function generateZodEntity(
  entity: AST.Entity,
  options: GenerateOptions
): ValidatorDefinition {
  const fields: string[] = [];

  for (const field of entity.fields) {
    let fieldSchema = generateZodType(field.type, options);

    // Apply constraints from annotations
    fieldSchema = applyZodConstraints(fieldSchema, field, options);

    // Make optional if needed
    if (field.optional) {
      if (!fieldSchema.includes('.optional()')) {
        fieldSchema = `${fieldSchema}.optional()`;
      }
    }

    fields.push(`  ${field.name}: ${fieldSchema}`);
  }

  const schemaCode = `export const ${entity.name}Schema = z.object({\n${fields.join(',\n')}\n});`;

  const typeCode = options.brandedTypes
    ? `export type ${entity.name} = z.infer<typeof ${entity.name}Schema>;`
    : `export type ${entity.name} = z.infer<typeof ${entity.name}Schema>;`;

  return {
    name: entity.name,
    schemaCode,
    typeCode,
    description: `Validator for ${entity.name} entity`,
  };
}

/**
 * Generate Zod schema for enum
 */
export function generateZodEnum(typeDecl: AST.TypeDeclaration, options: GenerateOptions): ValidatorDefinition {
  if (typeDecl.definition.kind !== 'enum') {
    throw new Error(`Expected enum type, got ${typeDecl.definition.kind}`);
  }

  const values = typeDecl.definition.values.map((v) => `'${v.name}'`).join(', ');
  const schemaCode = `export const ${typeDecl.name}Schema = z.enum([${values}]);`;
  const typeCode = `export type ${typeDecl.name} = z.infer<typeof ${typeDecl.name}Schema>;`;

  return {
    name: typeDecl.name,
    schemaCode,
    typeCode,
    description: `Enum validator for ${typeDecl.name}`,
  };
}

/**
 * Generate Zod schema for behavior input
 */
export function generateZodBehaviorInput(
  behavior: AST.Behavior,
  options: GenerateOptions
): ValidatorDefinition | null {
  if (!behavior.input || behavior.input.fields.length === 0) {
    return null;
  }

  const fields: string[] = [];

  for (const field of behavior.input.fields) {
    let fieldSchema = generateZodType(field.type, options);
    fieldSchema = applyZodConstraints(fieldSchema, field, options);

    if (field.optional) {
      fieldSchema = `${fieldSchema}.optional()`;
    }

    fields.push(`  ${field.name}: ${fieldSchema}`);
  }

  const schemaName = `${behavior.name}InputSchema`;
  const schemaCode = `export const ${schemaName} = z.object({\n${fields.join(',\n')}\n});`;
  const typeCode = `export type ${behavior.name}Input = z.infer<typeof ${schemaName}>;`;

  return {
    name: schemaName,
    schemaCode,
    typeCode,
    description: `Input validator for ${behavior.name}`,
  };
}

/**
 * Apply constraints from field annotations
 */
function applyZodConstraints(
  schema: string,
  field: AST.Field,
  options: GenerateOptions
): string {
  let result = schema;

  for (const annotation of field.annotations || []) {
    switch (annotation.name) {
      case 'minLength':
        if (annotation.args?.[0]) {
          result = `${result}.min(${annotation.args[0]})`;
        }
        break;
      case 'maxLength':
        if (annotation.args?.[0]) {
          result = `${result}.max(${annotation.args[0]})`;
        }
        break;
      case 'min':
        if (annotation.args?.[0]) {
          result = `${result}.min(${annotation.args[0]})`;
        }
        break;
      case 'max':
        if (annotation.args?.[0]) {
          result = `${result}.max(${annotation.args[0]})`;
        }
        break;
      case 'pattern':
      case 'regex':
        if (annotation.args?.[0]) {
          result = `${result}.regex(${annotation.args[0]})`;
        }
        break;
      case 'positive':
        result = `${result}.positive()`;
        break;
      case 'negative':
        result = `${result}.negative()`;
        break;
      case 'nonnegative':
        result = `${result}.nonnegative()`;
        break;
      case 'sensitive':
        // Add transform to mask on output
        if (options.includeTransforms) {
          result = `${result}.transform(v => '***')`;
        }
        break;
    }
  }

  // Add custom error messages
  if (options.includeMessages) {
    const fieldName = field.name;
    if (schema.includes('z.string()')) {
      result = result.replace(
        'z.string()',
        `z.string({ required_error: '${fieldName} is required', invalid_type_error: '${fieldName} must be a string' })`
      );
    }
    if (schema.includes('z.number()')) {
      result = result.replace(
        'z.number()',
        `z.number({ required_error: '${fieldName} is required', invalid_type_error: '${fieldName} must be a number' })`
      );
    }
  }

  return result;
}

/**
 * Generate Zod refinement from ISL invariant
 */
export function generateZodRefinement(
  invariant: AST.Invariant,
  schemaName: string
): string {
  // Convert ISL expression to JavaScript predicate
  const predicate = compileInvariantToPredicate(invariant.expression);
  const message = invariant.message || 'Validation failed';

  return `export const ${schemaName}WithInvariants = ${schemaName}.refine(
  (data) => ${predicate},
  { message: "${message}" }
);`;
}

/**
 * Compile ISL expression to JavaScript predicate
 */
function compileInvariantToPredicate(expr: AST.Expression): string {
  switch (expr.kind) {
    case 'binary':
      const left = compileInvariantToPredicate(expr.left);
      const right = compileInvariantToPredicate(expr.right);
      const op = mapOperator(expr.operator);
      return `(${left} ${op} ${right})`;

    case 'unary':
      const operand = compileInvariantToPredicate(expr.operand);
      if (expr.operator === 'not') {
        return `!(${operand})`;
      }
      return operand;

    case 'member':
      return `data.${expr.path.join('.')}`;

    case 'literal':
      if (typeof expr.value === 'string') {
        return `"${expr.value}"`;
      }
      return String(expr.value);

    case 'identifier':
      return `data.${expr.name}`;

    default:
      return 'true';
  }
}

function mapOperator(op: string): string {
  const opMap: Record<string, string> = {
    '==': '===',
    '!=': '!==',
    'and': '&&',
    'or': '||',
    'gt': '>',
    'lt': '<',
    'gte': '>=',
    'lte': '<=',
  };
  return opMap[op] || op;
}

/**
 * Generate file header with imports
 */
export function generateZodHeader(): string {
  return `// Auto-generated by @isl-lang/codegen-validators
// Do not edit manually

import { z } from 'zod';

`;
}

/**
 * Generate index file for barrel exports
 */
export function generateZodIndex(schemas: ValidatorDefinition[]): string {
  const exports = schemas.map((s) => s.name).join(', ');
  const types = schemas
    .filter((s) => s.typeCode)
    .map((s) => s.name.replace('Schema', ''))
    .join(', ');

  return `// Auto-generated by @isl-lang/codegen-validators

export { ${exports} } from './validators';
export type { ${types} } from './validators';
`;
}
