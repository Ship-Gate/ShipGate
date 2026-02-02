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
    case 'SimpleType':
      // Could be a primitive type or a reference to another type
      return generateYupPrimitive(type.name.name, options);

    case 'ArrayType':
      return `yup.array().of(${generateYupType(type.elementType, options)})`;

    case 'GenericType': {
      const typeName = type.name.name;
      if (typeName === 'List' || typeName === 'Array') {
        return `yup.array().of(${generateYupType(type.typeArguments[0], options)})`;
      }
      if (typeName === 'Map' || typeName === 'Record') {
        return `yup.object()`;
      }
      if (typeName === 'Optional' || typeName === 'Maybe') {
        return `${generateYupType(type.typeArguments[0], options)}.nullable()`;
      }
      // Reference to a generic type
      return `${typeName}Schema`;
    }

    case 'UnionType':
      // Yup doesn't have native union support, use mixed with oneOf
      const variants = type.variants.map((v) => `'${v.name.name}'`);
      return `yup.mixed().oneOf([${variants.join(', ')}])`;

    case 'ObjectType':
      // Inline object type
      const fields = type.fields.map((f) => 
        `${f.name.name}: ${generateYupType(f.type, options)}`
      ).join(', ');
      return `yup.object({ ${fields} })`;

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
  entity: AST.EntityDeclaration,
  options: GenerateOptions
): ValidatorDefinition {
  const fields: string[] = [];
  const entityName = entity.name.name;

  for (const field of entity.fields) {
    let fieldSchema = generateYupType(field.type, options);
    const fieldName = field.name.name;

    // Apply constraints from annotations
    fieldSchema = applyYupConstraints(fieldSchema, field, options);

    // Handle required/optional
    if (!field.optional) {
      fieldSchema = `${fieldSchema}.required()`;
    } else {
      fieldSchema = `${fieldSchema}.notRequired()`;
    }

    fields.push(`  ${fieldName}: ${fieldSchema}`);
  }

  const schemaCode = `export const ${entityName}Schema = yup.object({\n${fields.join(',\n')}\n});`;
  const typeCode = `export type ${entityName} = yup.InferType<typeof ${entityName}Schema>;`;

  return {
    name: entityName,
    schemaCode,
    typeCode,
    description: `Validator for ${entityName} entity`,
  };
}

/**
 * Generate Yup schema for enum
 */
export function generateYupEnum(enumDecl: AST.EnumDeclaration, options: GenerateOptions): ValidatorDefinition {
  const enumName = enumDecl.name.name;
  const values = enumDecl.variants.map((v) => `'${v.name}'`).join(', ');
  const schemaCode = `export const ${enumName}Schema = yup.string().oneOf([${values}]);`;
  const typeCode = `export type ${enumName} = yup.InferType<typeof ${enumName}Schema>;`;

  return {
    name: enumName,
    schemaCode,
    typeCode,
    description: `Enum validator for ${enumName}`,
  };
}

/**
 * Generate Yup schema for behavior input
 */
export function generateYupBehaviorInput(
  behavior: AST.BehaviorDeclaration,
  options: GenerateOptions
): ValidatorDefinition | null {
  if (!behavior.input || behavior.input.fields.length === 0) {
    return null;
  }

  const behaviorName = behavior.name.name;
  const fields: string[] = [];

  for (const field of behavior.input.fields) {
    let fieldSchema = generateYupType(field.type, options);
    const fieldName = field.name.name;
    fieldSchema = applyYupConstraints(fieldSchema, field, options);

    if (!field.optional) {
      fieldSchema = `${fieldSchema}.required()`;
    }

    fields.push(`  ${fieldName}: ${fieldSchema}`);
  }

  const schemaName = `${behaviorName}InputSchema`;
  const schemaCode = `export const ${schemaName} = yup.object({\n${fields.join(',\n')}\n});`;
  const typeCode = `export type ${behaviorName}Input = yup.InferType<typeof ${schemaName}>;`;

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
function applyYupConstraints(
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
          const msg = options.includeMessages 
            ? `, '${fieldName} must be at least ${annotationValue.value} characters'`
            : '';
          result = `${result}.min(${annotationValue.value}${msg})`;
        }
        break;
      case 'maxLength':
        if (annotationValue && annotationValue.kind === 'NumberLiteral') {
          const msg = options.includeMessages
            ? `, '${fieldName} must be at most ${annotationValue.value} characters'`
            : '';
          result = `${result}.max(${annotationValue.value}${msg})`;
        }
        break;
      case 'min':
        if (annotationValue && annotationValue.kind === 'NumberLiteral') {
          const msg = options.includeMessages
            ? `, '${fieldName} must be at least ${annotationValue.value}'`
            : '';
          result = `${result}.min(${annotationValue.value}${msg})`;
        }
        break;
      case 'max':
        if (annotationValue && annotationValue.kind === 'NumberLiteral') {
          const msg = options.includeMessages
            ? `, '${fieldName} must be at most ${annotationValue.value}'`
            : '';
          result = `${result}.max(${annotationValue.value}${msg})`;
        }
        break;
      case 'pattern':
      case 'regex':
        if (annotationValue && annotationValue.kind === 'StringLiteral') {
          const msg = options.includeMessages
            ? `, '${fieldName} has invalid format'`
            : '';
          result = `${result}.matches(${annotationValue.value}${msg})`;
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
