/**
 * Main database adapter generator
 */

import type { DomainDeclaration, EntityDeclaration, EnumDeclaration, FieldDeclaration } from '@intentos/isl-core';
import type {
  GeneratorOptions,
  GeneratedFile,
  GeneratorContext,
  NormalizedEntity,
  NormalizedEnum,
  NormalizedField,
  FieldType,
  FieldConstraints,
  DefaultValue,
  ScalarType,
} from './types.js';
import { PrismaGenerator } from './adapters/prisma.js';
import { DrizzleGenerator } from './adapters/drizzle.js';
import { TypeORMGenerator } from './adapters/typeorm.js';
import { SQLGenerator } from './adapters/sql.js';
import { generateRepositories } from './repository.js';
import { generateMigrations } from './migrations.js';

// ============================================
// Main Generator Function
// ============================================

export function generate(domain: DomainDeclaration, options: GeneratorOptions): GeneratedFile[] {
  const context = createContext(domain, options);
  const files: GeneratedFile[] = [];

  // Generate schema based on adapter
  const schemaFiles = generateSchema(context);
  files.push(...schemaFiles);

  // Generate repositories if requested
  if (options.generateRepository) {
    const repoFiles = generateRepositories(context);
    files.push(...repoFiles);
  }

  // Generate migrations if requested
  if (options.generateMigrations) {
    const migrationFiles = generateMigrations(context);
    files.push(...migrationFiles);
  }

  return files;
}

// ============================================
// Schema Generation
// ============================================

function generateSchema(context: GeneratorContext): GeneratedFile[] {
  const { options } = context;

  switch (options.adapter) {
    case 'prisma':
      return new PrismaGenerator().generateSchema(context);
    case 'drizzle':
      return new DrizzleGenerator().generateSchema(context);
    case 'typeorm':
      return new TypeORMGenerator().generateSchema(context);
    case 'sql':
      return new SQLGenerator().generateSchema(context);
    default:
      throw new Error(`Unknown adapter: ${options.adapter}`);
  }
}

// ============================================
// Context Creation
// ============================================

function createContext(domain: DomainDeclaration, options: GeneratorOptions): GeneratorContext {
  const normalizedOptions = normalizeOptions(options);
  const enums = normalizeEnums(domain.enums, normalizedOptions);
  const entities = normalizeEntities(domain.entities, enums, normalizedOptions);

  return {
    domain,
    options: normalizedOptions,
    entities,
    enums,
  };
}

function normalizeOptions(options: GeneratorOptions): GeneratorOptions {
  return {
    provider: 'postgresql',
    tableCasing: 'snake',
    columnCasing: 'snake',
    softDelete: false,
    auditFields: false,
    generateRepository: false,
    generateMigrations: false,
    ...options,
  };
}

// ============================================
// Entity Normalization
// ============================================

function normalizeEntities(
  entities: EntityDeclaration[],
  enums: NormalizedEnum[],
  options: GeneratorOptions
): NormalizedEntity[] {
  const enumNames = new Set(enums.map(e => e.name));

  return entities.map(entity => normalizeEntity(entity, enumNames, options));
}

function normalizeEntity(
  entity: EntityDeclaration,
  enumNames: Set<string>,
  options: GeneratorOptions
): NormalizedEntity {
  const name = entity.name.name;
  const tableName = toCase(name, options.tableCasing || 'snake', true);

  const fields = entity.fields.map(f => normalizeField(f, enumNames, options));

  // Extract indexes from field annotations
  const indexes = fields
    .filter(f => f.indexed && !f.unique && !f.primaryKey)
    .map(f => ({
      fields: [f.columnName],
      unique: false,
    }));

  // Extract unique constraints
  const uniqueConstraints = fields
    .filter(f => f.unique && !f.primaryKey)
    .map(f => ({
      fields: [f.columnName],
    }));

  return {
    name,
    tableName,
    fields,
    indexes,
    uniqueConstraints,
    relations: [], // Relations would be extracted from type analysis
  };
}

function normalizeField(
  field: FieldDeclaration,
  enumNames: Set<string>,
  options: GeneratorOptions
): NormalizedField {
  const name = field.name.name;
  const columnName = toCase(name, options.columnCasing || 'snake');
  const annotations = extractAnnotations(field);
  const constraints = extractConstraints(field);
  const fieldType = resolveFieldType(field.type, enumNames);

  // Determine if primary key
  const isPrimaryKey = name === 'id' || annotations.has('primary');

  // Determine auto-generation
  const autoGenerate = isPrimaryKey && (
    fieldType.scalarType === 'UUID' ||
    annotations.has('auto') ||
    annotations.has('autoincrement')
  );

  // Determine default value
  const defaultValue = resolveDefaultValue(field, fieldType, annotations, isPrimaryKey);

  return {
    name,
    columnName,
    type: fieldType,
    nullable: field.optional,
    unique: annotations.has('unique'),
    indexed: annotations.has('indexed'),
    immutable: annotations.has('immutable'),
    primaryKey: isPrimaryKey,
    autoGenerate,
    defaultValue,
    constraints,
    rawType: field.type,
  };
}

// ============================================
// Type Resolution
// ============================================

function resolveFieldType(type: import('@intentos/isl-core').TypeExpression, enumNames: Set<string>): FieldType {
  switch (type.kind) {
    case 'SimpleType': {
      const typeName = type.name.name;

      if (enumNames.has(typeName)) {
        return {
          kind: 'enum',
          name: typeName,
          isArray: false,
          enumName: typeName,
        };
      }

      const scalarType = mapToScalarType(typeName);
      return {
        kind: 'scalar',
        name: typeName,
        isArray: false,
        scalarType,
      };
    }

    case 'ArrayType': {
      const elementType = resolveFieldType(type.elementType, enumNames);
      return {
        ...elementType,
        isArray: true,
      };
    }

    case 'GenericType': {
      // Handle List<T>, Set<T>, etc.
      const genericName = type.name.name;
      if (genericName === 'List' || genericName === 'Set' || genericName === 'Array') {
        if (type.typeArguments.length > 0) {
          const elementType = resolveFieldType(type.typeArguments[0], enumNames);
          return {
            ...elementType,
            isArray: true,
          };
        }
      }

      // Handle Optional<T>
      if (genericName === 'Optional' && type.typeArguments.length > 0) {
        return resolveFieldType(type.typeArguments[0], enumNames);
      }

      // Default to JSON for complex types
      return {
        kind: 'json',
        name: genericName,
        isArray: false,
        scalarType: 'Json',
      };
    }

    case 'ObjectType':
      return {
        kind: 'json',
        name: 'Object',
        isArray: false,
        scalarType: 'Json',
      };

    default:
      return {
        kind: 'scalar',
        name: 'String',
        isArray: false,
        scalarType: 'String',
      };
  }
}

function mapToScalarType(typeName: string): ScalarType {
  const mapping: Record<string, ScalarType> = {
    String: 'String',
    Int: 'Int',
    Integer: 'Int',
    Float: 'Float',
    Double: 'Float',
    Boolean: 'Boolean',
    Bool: 'Boolean',
    DateTime: 'DateTime',
    Timestamp: 'DateTime',
    Date: 'DateTime',
    Time: 'DateTime',
    UUID: 'UUID',
    Id: 'UUID',
    Email: 'String',
    URL: 'String',
    Phone: 'String',
    BigInt: 'BigInt',
    Decimal: 'Decimal',
    Money: 'Decimal',
    Currency: 'Decimal',
    Json: 'Json',
    JSON: 'Json',
    Bytes: 'Bytes',
    Binary: 'Bytes',
  };

  return mapping[typeName] || 'String';
}

// ============================================
// Annotation & Constraint Extraction
// ============================================

function extractAnnotations(field: FieldDeclaration): Set<string> {
  const annotations = new Set<string>();

  for (const annotation of field.annotations) {
    annotations.add(annotation.name.name.toLowerCase());
  }

  return annotations;
}

function extractConstraints(field: FieldDeclaration): FieldConstraints {
  const constraints: FieldConstraints = {};

  for (const constraint of field.constraints) {
    const name = constraint.name.name.toLowerCase();
    const value = constraint.value;

    switch (name) {
      case 'min_length':
      case 'minlength':
        if (value?.kind === 'NumberLiteral') {
          constraints.minLength = value.value;
        }
        break;

      case 'max_length':
      case 'maxlength':
        if (value?.kind === 'NumberLiteral') {
          constraints.maxLength = value.value;
        }
        break;

      case 'min':
      case 'minimum':
        if (value?.kind === 'NumberLiteral') {
          constraints.min = value.value;
        }
        break;

      case 'max':
      case 'maximum':
        if (value?.kind === 'NumberLiteral') {
          constraints.max = value.value;
        }
        break;

      case 'pattern':
      case 'regex':
        if (value?.kind === 'StringLiteral') {
          constraints.pattern = value.value;
        }
        break;

      case 'precision':
        if (value?.kind === 'NumberLiteral') {
          constraints.precision = value.value;
        }
        break;

      case 'scale':
        if (value?.kind === 'NumberLiteral') {
          constraints.scale = value.value;
        }
        break;
    }
  }

  return constraints;
}

// ============================================
// Default Value Resolution
// ============================================

function resolveDefaultValue(
  field: FieldDeclaration,
  fieldType: FieldType,
  annotations: Set<string>,
  isPrimaryKey: boolean
): DefaultValue | undefined {
  // Check for explicit default value
  if (field.defaultValue) {
    switch (field.defaultValue.kind) {
      case 'StringLiteral':
        return { kind: 'literal', value: field.defaultValue.value };
      case 'NumberLiteral':
        return { kind: 'literal', value: field.defaultValue.value };
      case 'BooleanLiteral':
        return { kind: 'literal', value: field.defaultValue.value };
      case 'NullLiteral':
        return { kind: 'literal', value: null };
    }
  }

  // Auto-generate UUID for primary keys
  if (isPrimaryKey && fieldType.scalarType === 'UUID') {
    return { kind: 'function', value: 'uuid', function: 'uuid' };
  }

  // Auto-generate timestamps
  const fieldName = field.name.name.toLowerCase();
  if (fieldType.scalarType === 'DateTime') {
    if (fieldName.includes('created') || fieldName === 'createdat') {
      return { kind: 'function', value: 'now', function: 'now' };
    }
    if (fieldName.includes('updated') || fieldName === 'updatedat') {
      return { kind: 'function', value: 'now', function: 'now' };
    }
  }

  // Check for enum default (first value)
  if (fieldType.kind === 'enum' && !field.optional) {
    // Will be handled by the specific adapter
    return undefined;
  }

  return undefined;
}

// ============================================
// Enum Normalization
// ============================================

function normalizeEnums(enums: EnumDeclaration[], options: GeneratorOptions): NormalizedEnum[] {
  return enums.map(enumDecl => ({
    name: enumDecl.name.name,
    dbName: toCase(enumDecl.name.name, options.tableCasing || 'snake'),
    values: enumDecl.variants.map(v => v.name),
  }));
}

// ============================================
// Utility Functions
// ============================================

export function toCase(str: string, casing: 'snake' | 'camel' | 'pascal', pluralize = false): string {
  // Split on case boundaries
  const words = str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .toLowerCase()
    .split('_')
    .filter(Boolean);

  // Pluralize last word if requested
  if (pluralize && words.length > 0) {
    const last = words[words.length - 1];
    words[words.length - 1] = pluralizeWord(last);
  }

  switch (casing) {
    case 'snake':
      return words.join('_');
    case 'camel':
      return words
        .map((word, i) => (i === 0 ? word : capitalize(word)))
        .join('');
    case 'pascal':
      return words.map(capitalize).join('');
    default:
      return words.join('_');
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function pluralizeWord(word: string): string {
  if (word.endsWith('y') && !['ay', 'ey', 'oy', 'uy'].some(ending => word.endsWith(ending))) {
    return word.slice(0, -1) + 'ies';
  }
  if (word.endsWith('s') || word.endsWith('x') || word.endsWith('ch') || word.endsWith('sh')) {
    return word + 'es';
  }
  return word + 's';
}

export { GeneratorContext, GeneratedFile, GeneratorOptions };
