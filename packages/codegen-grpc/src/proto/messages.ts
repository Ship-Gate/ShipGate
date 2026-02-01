// ============================================================================
// ISL Entity to Proto Message Generation
// ============================================================================

import type {
  Entity,
  Field,
  LifecycleSpec,
} from '@intentos/isl-core';
import {
  toSnakeCase,
  toPascalCase,
  toScreamingSnakeCase,
  fieldNumbers,
  protoComment,
} from '../utils';
import { resolveType, type ProtoTypeOptions } from './types';

// ==========================================================================
// MESSAGE OPTIONS
// ==========================================================================

export interface ProtoMessageOptions extends ProtoTypeOptions {
  /** Generate lifecycle status enums */
  generateLifecycleEnums?: boolean;
  /** Generate field masks for partial updates */
  generateFieldMasks?: boolean;
  /** Add JSON name options */
  addJsonNames?: boolean;
}

// ==========================================================================
// GENERATED MESSAGE
// ==========================================================================

export interface GeneratedProtoMessage {
  name: string;
  definition: string;
  imports: Set<string>;
  relatedEnums: string[];
}

// ==========================================================================
// MESSAGE GENERATOR
// ==========================================================================

/**
 * Generate proto messages from ISL entities
 */
export function generateProtoMessages(
  entities: Entity[],
  options: ProtoMessageOptions = {}
): GeneratedProtoMessage[] {
  const results: GeneratedProtoMessage[] = [];
  
  for (const entity of entities) {
    results.push(generateEntityMessage(entity, options));
  }
  
  return results;
}

/**
 * Generate a single entity message
 */
function generateEntityMessage(
  entity: Entity,
  options: ProtoMessageOptions
): GeneratedProtoMessage {
  const name = toPascalCase(entity.name.name);
  const imports = new Set<string>();
  const relatedEnums: string[] = [];
  const lines: string[] = [];
  
  // Add comment
  lines.push(`// ${name} entity`);
  
  // Generate lifecycle enum if present
  if (options.generateLifecycleEnums && entity.lifecycle) {
    const enumDef = generateLifecycleEnum(name, entity.lifecycle);
    lines.push(enumDef);
    lines.push('');
    relatedEnums.push(`${name}Status`);
  }
  
  // Start message
  lines.push(`message ${name} {`);
  
  const fieldNums = fieldNumbers();
  
  for (const field of entity.fields) {
    const fieldNum = fieldNums.next().value;
    const fieldDef = generateFieldDefinition(field, fieldNum, options, imports);
    lines.push(fieldDef);
  }
  
  lines.push('}');
  
  // Generate field mask if requested
  if (options.generateFieldMasks) {
    lines.push('');
    lines.push(generateFieldMask(name, entity.fields));
    imports.add('google/protobuf/field_mask.proto');
  }
  
  return {
    name,
    definition: lines.join('\n'),
    imports,
    relatedEnums,
  };
}

/**
 * Generate field definition
 */
function generateFieldDefinition(
  field: Field,
  fieldNum: number,
  options: ProtoMessageOptions,
  imports: Set<string>
): string {
  const { protoType, fieldImports } = resolveType(field.type, options);
  fieldImports.forEach(i => imports.add(i));
  
  const fieldName = toSnakeCase(field.name.name);
  const parts: string[] = [`  ${protoType} ${fieldName} = ${fieldNum}`];
  
  // Build options
  const fieldOptions: string[] = [];
  
  // JSON name option
  if (options.addJsonNames) {
    const jsonName = toCamelCase(field.name.name);
    if (jsonName !== fieldName) {
      fieldOptions.push(`json_name = "${jsonName}"`);
    }
  }
  
  // Validation rules
  if (options.includeValidation) {
    const rules = generateFieldValidation(field, options);
    if (rules) {
      fieldOptions.push(rules);
      imports.add('validate/validate.proto');
    }
  }
  
  // Add options
  if (fieldOptions.length > 0) {
    parts.push(` [${fieldOptions.join(', ')}]`);
  }
  
  parts.push(';');
  
  // Add field comment from annotations
  const comment = getFieldComment(field);
  if (comment) {
    return `  // ${comment}\n${parts.join('')}`;
  }
  
  return parts.join('');
}

function toCamelCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (c) => c.toLowerCase());
}

/**
 * Get field comment from annotations
 */
function getFieldComment(field: Field): string | null {
  for (const ann of field.annotations) {
    if (ann.name.name === 'description' && ann.value?.kind === 'StringLiteral') {
      return ann.value.value;
    }
  }
  return null;
}

/**
 * Generate validation rules for a field
 */
function generateFieldValidation(
  field: Field,
  _options: ProtoMessageOptions
): string | null {
  const rules: string[] = [];
  let ruleType = 'message';
  
  // Check annotations
  for (const ann of field.annotations) {
    switch (ann.name.name) {
      case 'unique':
      case 'indexed':
        // No proto equivalent
        break;
      
      case 'immutable':
        // Could add custom option
        break;
      
      case 'secret':
      case 'pii':
      case 'sensitive':
        // Could add custom option for sensitive data handling
        break;
    }
  }
  
  // Required check (non-optional message fields)
  if (!field.optional && field.type.kind === 'ReferenceType') {
    rules.push('required = true');
  }
  
  // Handle constrained types
  if (field.type.kind === 'ConstrainedType') {
    const base = field.type.base;
    if (base.kind === 'PrimitiveType') {
      ruleType = getPrimitiveValidateType(base.name);
      
      for (const constraint of field.type.constraints) {
        const rule = constraintToValidateRule(constraint, ruleType);
        if (rule) rules.push(rule);
      }
    }
  }
  
  if (rules.length === 0) return null;
  return `(validate.rules).${ruleType} = {${rules.join(', ')}}`;
}

function getPrimitiveValidateType(name: string): string {
  switch (name) {
    case 'String':
    case 'UUID':
      return 'string';
    case 'Int':
      return 'int64';
    case 'Decimal':
      return 'double';
    case 'Boolean':
      return 'bool';
    case 'Timestamp':
      return 'timestamp';
    case 'Duration':
      return 'duration';
    default:
      return 'message';
  }
}

function constraintToValidateRule(
  constraint: { name: string; value: { kind: string; value?: unknown; pattern?: string } },
  ruleType: string
): string | null {
  const { name, value } = constraint;
  
  switch (name) {
    case 'min':
      if (value.kind === 'NumberLiteral') {
        return ruleType === 'int64' ? `gte = ${value.value}` : `gte = ${value.value}`;
      }
      break;
    case 'max':
      if (value.kind === 'NumberLiteral') {
        return ruleType === 'int64' ? `lte = ${value.value}` : `lte = ${value.value}`;
      }
      break;
    case 'min_length':
      if (value.kind === 'NumberLiteral') {
        return `min_len = ${value.value}`;
      }
      break;
    case 'max_length':
      if (value.kind === 'NumberLiteral') {
        return `max_len = ${value.value}`;
      }
      break;
    case 'pattern':
    case 'format':
      if (value.kind === 'RegexLiteral' && value.pattern) {
        return `pattern = "${value.pattern.replace(/\\/g, '\\\\')}"`;
      }
      break;
  }
  
  return null;
}

/**
 * Generate lifecycle status enum
 */
function generateLifecycleEnum(entityName: string, lifecycle: LifecycleSpec): string {
  const enumName = `${entityName}Status`;
  const prefix = toScreamingSnakeCase(enumName);
  
  // Collect unique states
  const states = new Set<string>();
  for (const transition of lifecycle.transitions) {
    states.add(transition.from.name);
    states.add(transition.to.name);
  }
  
  const lines: string[] = [`enum ${enumName} {`];
  lines.push(`  ${prefix}_UNSPECIFIED = 0;`);
  
  let value = 1;
  for (const state of states) {
    const stateName = `${prefix}_${toScreamingSnakeCase(state)}`;
    lines.push(`  ${stateName} = ${value};`);
    value++;
  }
  
  lines.push('}');
  return lines.join('\n');
}

/**
 * Generate field mask message for partial updates
 */
function generateFieldMask(entityName: string, fields: Field[]): string {
  const lines: string[] = [
    `// Field mask for ${entityName} updates`,
    `message ${entityName}FieldMask {`,
    '  google.protobuf.FieldMask paths = 1;',
    '}',
  ];
  return lines.join('\n');
}

// ==========================================================================
// REQUEST/RESPONSE MESSAGE GENERATORS
// ==========================================================================

/**
 * Generate Get request message
 */
export function generateGetRequest(entityName: string): string {
  const name = toPascalCase(entityName);
  return [
    `message Get${name}Request {`,
    '  string id = 1 [(validate.rules).string.uuid = true];',
    '}',
  ].join('\n');
}

/**
 * Generate Get response message
 */
export function generateGetResponse(entityName: string): string {
  const name = toPascalCase(entityName);
  return [
    `message Get${name}Response {`,
    `  ${name} ${toSnakeCase(entityName)} = 1;`,
    '}',
  ].join('\n');
}

/**
 * Generate List request message
 */
export function generateListRequest(entityName: string): string {
  const name = toPascalCase(entityName);
  return [
    `message List${name}sRequest {`,
    '  int32 page_size = 1 [(validate.rules).int32 = {gte: 1, lte: 100}];',
    '  string page_token = 2;',
    `  ${name}Filter filter = 3;`,
    '}',
  ].join('\n');
}

/**
 * Generate List response message
 */
export function generateListResponse(entityName: string): string {
  const name = toPascalCase(entityName);
  return [
    `message List${name}sResponse {`,
    `  repeated ${name} ${toSnakeCase(entityName)}s = 1;`,
    '  string next_page_token = 2;',
    '  int32 total_count = 3;',
    '}',
  ].join('\n');
}

/**
 * Generate Watch request message (for streaming)
 */
export function generateWatchRequest(entityName: string): string {
  const name = toPascalCase(entityName);
  return [
    `message Watch${name}Request {`,
    '  string id = 1;',
    `  ${name}Filter filter = 2;`,
    '}',
  ].join('\n');
}

/**
 * Generate event message for streaming
 */
export function generateEventMessage(entityName: string): string {
  const name = toPascalCase(entityName);
  const prefix = toScreamingSnakeCase(name);
  return [
    `message ${name}Event {`,
    `  enum EventType {`,
    `    ${prefix}_EVENT_TYPE_UNSPECIFIED = 0;`,
    `    ${prefix}_EVENT_TYPE_CREATED = 1;`,
    `    ${prefix}_EVENT_TYPE_UPDATED = 2;`,
    `    ${prefix}_EVENT_TYPE_DELETED = 3;`,
    `  }`,
    `  EventType type = 1;`,
    `  ${name} ${toSnakeCase(entityName)} = 2;`,
    '  google.protobuf.Timestamp occurred_at = 3;',
    '}',
  ].join('\n');
}
