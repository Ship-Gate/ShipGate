// ============================================================================
// Yup Validator Generator
// ============================================================================

import type * as AST from '@isl-lang/isl-core';
import type { GenerateOptions, ValidatorDefinition } from '../types';

/**
 * Generate Yup schema from ISL type
 */
export function generateYupSchema(
  name: string,
  type: AST.TypeExpression,
  options: GenerateOptions
): string {
  return `export const ${name}Schema = ${generateYupType(type, options)};`;
}

/**
 * Generate Yup type from ISL type expression
 */
export function generateYupType(type: AST.TypeExpression, options: GenerateOptions): string {
  switch (type.kind) {
    case 'primitive':
      return generateYupPrimitive(type.name, options);

    case 'reference':
      return `${type.name}Schema`;

    case 'list':
      return `yup.array().of(${generateYupType(type.elementType, options)})`;

    case 'map':
      return `yup.object()`;

    case 'optional':
      return `${generateYupType(type.innerType, options)}.nullable()`;

    case 'union':
      // Yup doesn't have native union support, use mixed with oneOf
      const variants = type.variants.map((v) => generateYupType(v, options));
      return `yup.mixed().oneOf([${variants.join(', ')}])`;

    default:
      return 'yup.mixed()';
  }
}

/**
 * Generate Yup primitive type
 */
function generateYupPrimitive(name: string, options: GenerateOptions): string {
  const strict = options.strict ? '.strict()' : '';
  
  const primitiveMap: Record<string, string> = {
    'String': `yup.string()${strict}`,
    'Int': `yup.number().integer()${strict}`,
    'Integer': `yup.number().integer()${strict}`,
    'Float': `yup.number()${strict}`,
    'Double': `yup.number()${strict}`,
    'Decimal': `yup.number()${strict}`,
    'Boolean': `yup.boolean()${strict}`,
    'Bool': `yup.boolean()${strict}`,
    'UUID': `yup.string().uuid()${strict}`,
    'Timestamp': `yup.date()${strict}`,
    'Date': `yup.date()${strict}`,
    'DateTime': `yup.date()${strict}`,
    'Email': `yup.string().email()${strict}`,
    'URL': `yup.string().url()${strict}`,
    'Money': `yup.number().min(0)${strict}`,
    'JSON': `yup.mixed()`,
  };

  return primitiveMap[name] || `yup.string()${strict}`;
}

/**
 * Generate Yup schema for entity
 */
export function generateYupEntity(
  entity: AST.Entity,
  options: GenerateOptions
): ValidatorDefinition {
  const fields: string[] = [];

  for (const field of entity.fields) {
    let fieldSchema = generateYupType(field.type, options);

    // Apply constraints from annotations
    fieldSchema = applyYupConstraints(fieldSchema, field, options);

    // Handle required/optional
    if (!field.optional) {
      fieldSchema = `${fieldSchema}.required()`;
    } else {
      fieldSchema = `${fieldSchema}.notRequired()`;
    }

    fields.push(`  ${field.name}: ${fieldSchema}`);
  }

  const schemaCode = `export const ${entity.name}Schema = yup.object({\n${fields.join(',\n')}\n});`;
  const typeCode = `export type ${entity.name} = yup.InferType<typeof ${entity.name}Schema>;`;

  return {
    name: entity.name,
    schemaCode,
    typeCode,
    description: `Validator for ${entity.name} entity`,
  };
}

/**
 * Generate Yup schema for enum
 */
export function generateYupEnum(typeDecl: AST.TypeDeclaration, options: GenerateOptions): ValidatorDefinition {
  if (typeDecl.definition.kind !== 'enum') {
    throw new Error(`Expected enum type, got ${typeDecl.definition.kind}`);
  }

  const values = typeDecl.definition.values.map((v) => `'${v.name}'`).join(', ');
  const schemaCode = `export const ${typeDecl.name}Schema = yup.string().oneOf([${values}]);`;
  const typeCode = `export type ${typeDecl.name} = yup.InferType<typeof ${typeDecl.name}Schema>;`;

  return {
    name: typeDecl.name,
    schemaCode,
    typeCode,
    description: `Enum validator for ${typeDecl.name}`,
  };
}

/**
 * Generate Yup schema for behavior input
 */
export function generateYupBehaviorInput(
  behavior: AST.Behavior,
  options: GenerateOptions
): ValidatorDefinition | null {
  if (!behavior.input || behavior.input.fields.length === 0) {
    return null;
  }

  const fields: string[] = [];

  for (const field of behavior.input.fields) {
    let fieldSchema = generateYupType(field.type, options);
    fieldSchema = applyYupConstraints(fieldSchema, field, options);

    if (!field.optional) {
      fieldSchema = `${fieldSchema}.required()`;
    }

    fields.push(`  ${field.name}: ${fieldSchema}`);
  }

  const schemaName = `${behavior.name}InputSchema`;
  const schemaCode = `export const ${schemaName} = yup.object({\n${fields.join(',\n')}\n});`;
  const typeCode = `export type ${behavior.name}Input = yup.InferType<typeof ${schemaName}>;`;

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
function applyYupConstraints(
  schema: string,
  field: AST.Field,
  options: GenerateOptions
): string {
  let result = schema;

  for (const annotation of field.annotations || []) {
    switch (annotation.name) {
      case 'minLength':
        if (annotation.args?.[0]) {
          const msg = options.includeMessages 
            ? `, '${field.name} must be at least ${annotation.args[0]} characters'`
            : '';
          result = `${result}.min(${annotation.args[0]}${msg})`;
        }
        break;
      case 'maxLength':
        if (annotation.args?.[0]) {
          const msg = options.includeMessages
            ? `, '${field.name} must be at most ${annotation.args[0]} characters'`
            : '';
          result = `${result}.max(${annotation.args[0]}${msg})`;
        }
        break;
      case 'min':
        if (annotation.args?.[0]) {
          const msg = options.includeMessages
            ? `, '${field.name} must be at least ${annotation.args[0]}'`
            : '';
          result = `${result}.min(${annotation.args[0]}${msg})`;
        }
        break;
      case 'max':
        if (annotation.args?.[0]) {
          const msg = options.includeMessages
            ? `, '${field.name} must be at most ${annotation.args[0]}'`
            : '';
          result = `${result}.max(${annotation.args[0]}${msg})`;
        }
        break;
      case 'pattern':
      case 'regex':
        if (annotation.args?.[0]) {
          const msg = options.includeMessages
            ? `, '${field.name} has invalid format'`
            : '';
          result = `${result}.matches(${annotation.args[0]}${msg})`;
        }
        break;
      case 'positive':
        result = `${result}.positive()`;
        break;
      case 'negative':
        result = `${result}.negative()`;
        break;
    }
  }

  return result;
}

/**
 * Generate file header with imports
 */
export function generateYupHeader(): string {
  return `// Auto-generated by @isl-lang/codegen-validators
// Do not edit manually

import * as yup from 'yup';

`;
}

/**
 * Generate index file for barrel exports
 */
export function generateYupIndex(schemas: ValidatorDefinition[]): string {
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
