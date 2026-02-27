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
    case 'SimpleType':
      // Could be a primitive type or a reference to another type
      return generateZodPrimitive(type.name.name, options);

    case 'ArrayType':
      return `z.array(${generateZodType(type.elementType, options)})`;

    case 'GenericType': {
      const typeName = type.name.name;
      if (typeName === 'List' || typeName === 'Array') {
        return `z.array(${generateZodType(type.typeArguments[0], options)})`;
      }
      if (typeName === 'Map' || typeName === 'Record') {
        const keyType = generateZodType(type.typeArguments[0], options);
        const valueType = generateZodType(type.typeArguments[1], options);
        return `z.record(${keyType}, ${valueType})`;
      }
      if (typeName === 'Optional' || typeName === 'Maybe') {
        return `${generateZodType(type.typeArguments[0], options)}.optional()`;
      }
      // Reference to a generic type
      return `${typeName}Schema`;
    }

    case 'UnionType':
      const variants = type.variants.map((v) => `z.literal('${v.name.name}')`);
      return `z.union([${variants.join(', ')}])`;

    case 'ObjectType':
      // Inline object type
      const fields = type.fields.map((f) => 
        `${f.name.name}: ${generateZodType(f.type, options)}`
      ).join(', ');
      return `z.object({ ${fields} })`;

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
  entity: AST.EntityDeclaration,
  options: GenerateOptions
): ValidatorDefinition {
  const fields: string[] = [];
  const entityName = entity.name.name;

  for (const field of entity.fields) {
    let fieldSchema = generateZodType(field.type, options);
    const fieldName = field.name.name;

    // Apply constraints from annotations
    fieldSchema = applyZodConstraints(fieldSchema, field, options);

    // Make optional if needed
    if (field.optional) {
      if (!fieldSchema.includes('.optional()')) {
        fieldSchema = `${fieldSchema}.optional()`;
      }
    }

    fields.push(`  ${fieldName}: ${fieldSchema}`);
  }

  const schemaCode = `export const ${entityName}Schema = z.object({\n${fields.join(',\n')}\n});`;

  const typeCode = options.brandedTypes
    ? `export type ${entityName} = z.infer<typeof ${entityName}Schema>;`
    : `export type ${entityName} = z.infer<typeof ${entityName}Schema>;`;

  return {
    name: entityName,
    schemaCode,
    typeCode,
    description: `Validator for ${entityName} entity`,
  };
}

/**
 * Generate Zod schema for enum
 */
export function generateZodEnum(enumDecl: AST.EnumDeclaration, options: GenerateOptions): ValidatorDefinition {
  const enumName = enumDecl.name.name;
  const values = enumDecl.variants.map((v) => `'${v.name}'`).join(', ');
  const schemaCode = `export const ${enumName}Schema = z.enum([${values}]);`;
  const typeCode = `export type ${enumName} = z.infer<typeof ${enumName}Schema>;`;

  return {
    name: enumName,
    schemaCode,
    typeCode,
    description: `Enum validator for ${enumName}`,
  };
}

/**
 * Generate Zod schema for behavior input
 */
export function generateZodBehaviorInput(
  behavior: AST.BehaviorDeclaration,
  options: GenerateOptions
): ValidatorDefinition | null {
  if (!behavior.input || behavior.input.fields.length === 0) {
    return null;
  }

  const behaviorName = behavior.name.name;
  const fields: string[] = [];

  for (const field of behavior.input.fields) {
    let fieldSchema = generateZodType(field.type, options);
    const fieldName = field.name.name;
    fieldSchema = applyZodConstraints(fieldSchema, field, options);

    if (field.optional) {
      fieldSchema = `${fieldSchema}.optional()`;
    }

    fields.push(`  ${fieldName}: ${fieldSchema}`);
  }

  const schemaName = `${behaviorName}InputSchema`;
  const schemaCode = `export const ${schemaName} = z.object({\n${fields.join(',\n')}\n});`;
  const typeCode = `export type ${behaviorName}Input = z.infer<typeof ${schemaName}>;`;

  return {
    name: schemaName,
    schemaCode,
    typeCode,
    description: `Input validator for ${behaviorName}`,
  };
}

/**
 * Apply constraints from field annotations
 */
function applyZodConstraints(
  schema: string,
  field: AST.FieldDeclaration,
  options: GenerateOptions
): string {
  let result = schema;
  const fieldName = field.name.name;

  for (const annotation of field.annotations || []) {
    const annotationName = annotation.name.name;
    const annotationValue = annotation.value;
    switch (annotationName) {
      case 'minLength':
        if (annotationValue && annotationValue.kind === 'NumberLiteral') {
          result = `${result}.min(${annotationValue.value})`;
        }
        break;
      case 'maxLength':
        if (annotationValue && annotationValue.kind === 'NumberLiteral') {
          result = `${result}.max(${annotationValue.value})`;
        }
        break;
      case 'min':
        if (annotationValue && annotationValue.kind === 'NumberLiteral') {
          result = `${result}.min(${annotationValue.value})`;
        }
        break;
      case 'max':
        if (annotationValue && annotationValue.kind === 'NumberLiteral') {
          result = `${result}.max(${annotationValue.value})`;
        }
        break;
      case 'pattern':
      case 'regex':
        if (annotationValue && annotationValue.kind === 'StringLiteral') {
          result = `${result}.regex(${annotationValue.value})`;
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
  invariant: AST.InvariantStatement,
  schemaName: string
): string {
  // Convert ISL expression to JavaScript predicate
  const predicate = compileInvariantToPredicate(invariant.expression);
  const message = invariant.description?.value || 'Validation failed';

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
    case 'BinaryExpression': {
      const left = compileInvariantToPredicate(expr.left);
      const right = compileInvariantToPredicate(expr.right);
      const op = mapOperator(expr.operator);
      return `(${left} ${op} ${right})`;
    }

    case 'ComparisonExpression': {
      const left = compileInvariantToPredicate(expr.left);
      const right = compileInvariantToPredicate(expr.right);
      const op = mapOperator(expr.operator);
      return `(${left} ${op} ${right})`;
    }

    case 'LogicalExpression': {
      const left = compileInvariantToPredicate(expr.left);
      const right = compileInvariantToPredicate(expr.right);
      const op = mapOperator(expr.operator);
      return `(${left} ${op} ${right})`;
    }

    case 'UnaryExpression': {
      const operand = compileInvariantToPredicate(expr.operand);
      if (expr.operator === 'not') {
        return `!(${operand})`;
      }
      return operand;
    }

    case 'MemberExpression': {
      const obj = compileInvariantToPredicate(expr.object);
      return `${obj}.${expr.property.name}`;
    }

    case 'CallExpression': {
      const callee = compileInvariantToPredicate(expr.callee);
      const args = expr.arguments.map(compileInvariantToPredicate).join(', ');
      return `${callee}(${args})`;
    }

    case 'StringLiteral':
      return `"${expr.value}"`;

    case 'NumberLiteral':
      return String(expr.value);

    case 'BooleanLiteral':
      return String(expr.value);

    case 'NullLiteral':
      return 'null';

    case 'Identifier':
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
