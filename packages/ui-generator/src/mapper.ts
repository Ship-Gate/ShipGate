// ============================================================================
// ISL AST → UI Model Mapper
// Maps entities to forms/tables and behaviors to submit actions
// ============================================================================

import type * as AST from '@isl-lang/isl-core';
import type {
  DomainUIModel,
  EntityUIModel,
  BehaviorUIModel,
  FieldUIModel,
  FieldInputType,
  EnumUIModel,
  ErrorUIModel,
} from './types.js';
import { extractFieldValidation, extractBehaviorValidation } from './validation.js';

/**
 * Map a full ISL DomainDeclaration into a DomainUIModel
 */
export function mapDomain(domain: AST.DomainDeclaration): DomainUIModel {
  const enums = (domain.enums ?? []).map(mapEnum);
  const enumNames = new Set(enums.map((e) => e.name));
  const entities = (domain.entities ?? []).map((e) => mapEntity(e, enumNames));
  const behaviors = (domain.behaviors ?? []).map((b) => mapBehavior(b, enumNames));

  return {
    name: domain.name.name,
    entities,
    behaviors,
    enums,
  };
}

// ============================================================================
// Entity Mapping
// ============================================================================

function mapEntity(
  entity: AST.EntityDeclaration,
  enumNames: Set<string>,
): EntityUIModel {
  return {
    name: entity.name.name,
    displayName: toDisplayName(entity.name.name),
    pluralName: pluralize(entity.name.name),
    fields: entity.fields.map((f) => mapField(f, enumNames)),
  };
}

// ============================================================================
// Behavior Mapping
// ============================================================================

function mapBehavior(
  behavior: AST.BehaviorDeclaration,
  enumNames: Set<string>,
): BehaviorUIModel {
  const inputFields = behavior.input
    ? behavior.input.fields.map((f) => mapField(f, enumNames))
    : [];

  const errors: ErrorUIModel[] = behavior.output?.errors
    ? behavior.output.errors.map((e) => ({
        name: e.name.name,
        message: e.when?.value ?? e.name.name,
        retriable: e.retriable ?? false,
      }))
    : [];

  return {
    name: behavior.name.name,
    displayName: toDisplayName(behavior.name.name),
    httpMethod: inferHttpMethod(behavior.name.name),
    apiPath: inferApiPath(behavior.name.name),
    inputFields,
    outputType: inferOutputType(behavior),
    errors,
    validation: extractBehaviorValidation(behavior),
  };
}

// ============================================================================
// Field Mapping
// ============================================================================

function mapField(
  field: AST.FieldDeclaration,
  enumNames: Set<string>,
): FieldUIModel {
  const annotations = field.annotations ?? [];
  const annotationNames = new Set(annotations.map((a) => a.name.name.toLowerCase()));
  const typeName = resolveTypeName(field.type);

  return {
    name: field.name.name,
    label: toDisplayName(field.name.name),
    type: inferInputType(field, enumNames),
    tsType: mapToTsType(typeName),
    optional: field.optional,
    sensitive: annotationNames.has('sensitive') || annotationNames.has('secret'),
    immutable: annotationNames.has('immutable'),
    hidden: annotationNames.has('secret'),
    validation: extractFieldValidation(field),
  };
}

// ============================================================================
// Enum Mapping
// ============================================================================

function mapEnum(decl: AST.EnumDeclaration): EnumUIModel {
  return {
    name: decl.name.name,
    values: decl.variants.map((v) => v.name),
  };
}

// ============================================================================
// Type Inference Helpers
// ============================================================================

function inferInputType(
  field: AST.FieldDeclaration,
  enumNames: Set<string>,
): FieldInputType {
  const annotations = (field.annotations ?? []).map((a) => a.name.name.toLowerCase());
  const typeName = resolveTypeName(field.type);
  const fieldName = field.name.name.toLowerCase();

  if (annotations.includes('sensitive') || annotations.includes('secret')) {
    return 'password';
  }
  if (fieldName.includes('email')) return 'email';
  if (fieldName.includes('password')) return 'password';

  if (enumNames.has(typeName)) return 'select';

  switch (typeName) {
    case 'Boolean':
    case 'Bool':
      return 'checkbox';
    case 'Int':
    case 'Integer':
    case 'Float':
    case 'Double':
    case 'Decimal':
    case 'Money':
      return 'number';
    case 'Date':
      return 'date';
    case 'DateTime':
    case 'Timestamp':
      return 'datetime';
    case 'UUID':
      return 'uuid';
    default:
      return 'text';
  }
}

function resolveTypeName(type: AST.TypeExpression): string {
  switch (type.kind) {
    case 'SimpleType':
      return type.name.name;
    case 'GenericType':
      return type.name.name;
    case 'ArrayType':
      return resolveTypeName(type.elementType) + '[]';
    case 'UnionType':
      return type.variants.map((v) => v.name.name).join(' | ');
    case 'ObjectType':
      return 'object';
    default:
      return 'unknown';
  }
}

function mapToTsType(islType: string): string {
  const map: Record<string, string> = {
    String: 'string',
    Int: 'number',
    Integer: 'number',
    Float: 'number',
    Double: 'number',
    Decimal: 'number',
    Money: 'number',
    Boolean: 'boolean',
    Bool: 'boolean',
    UUID: 'string',
    Timestamp: 'string',
    Date: 'string',
    DateTime: 'string',
  };
  return map[islType] ?? islType;
}

function inferHttpMethod(name: string): string {
  const lower = name.toLowerCase();
  if (lower.startsWith('get') || lower.startsWith('list') || lower.startsWith('find') || lower.startsWith('search') || lower.startsWith('validate')) return 'GET';
  if (lower.startsWith('create') || lower.startsWith('add') || lower.startsWith('register') || lower.startsWith('login')) return 'POST';
  if (lower.startsWith('update') || lower.startsWith('modify') || lower.startsWith('change')) return 'PUT';
  if (lower.startsWith('delete') || lower.startsWith('remove') || lower.startsWith('cancel')) return 'DELETE';
  return 'POST';
}

function inferApiPath(name: string): string {
  return '/' + toKebabCase(name);
}

function inferOutputType(behavior: AST.BehaviorDeclaration): string {
  if (!behavior.output?.success) return 'void';
  const s = behavior.output.success;
  if (s.kind === 'SimpleType') return s.name.name;
  return `${behavior.name.name}Output`;
}

// ============================================================================
// String Utilities
// ============================================================================

function toDisplayName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function pluralize(name: string): string {
  if (name.endsWith('s')) return name + 'es';
  if (name.endsWith('y')) return name.slice(0, -1) + 'ies';
  return name + 's';
}

function toKebabCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');
}
