/**
 * Field type mappings for Zod, Prisma, and TypeScript
 */

import type { EntityField, FieldType } from './types.js';

export function fieldToZodType(field: EntityField): string {
  const base = baseZodType(field.type);
  let chain = base;

  if (field.constraints?.minLength !== undefined) {
    chain += `.min(${field.constraints.minLength})`;
  }
  if (field.constraints?.maxLength !== undefined) {
    chain += `.max(${field.constraints.maxLength})`;
  }
  if (field.constraints?.min !== undefined && (field.type === 'Int' || field.type === 'Float' || field.type === 'Decimal')) {
    chain += `.min(${field.constraints.min})`;
  }
  if (field.constraints?.max !== undefined && (field.type === 'Int' || field.type === 'Float' || field.type === 'Decimal')) {
    chain += `.max(${field.constraints.max})`;
  }
  if (field.constraints?.email) {
    chain += `.email()`;
  }
  if (field.constraints?.uuid) {
    chain += `.uuid()`;
  }
  if (field.constraints?.pattern) {
    chain += `.regex(new RegExp(${JSON.stringify(field.constraints.pattern)}))`;
  }

  if (!field.required) {
    chain += '.optional()';
  }

  return chain;
}

function baseZodType(type: FieldType): string {
  const map: Record<FieldType, string> = {
    String: 'z.string()',
    Int: 'z.number().int()',
    Float: 'z.number()',
    Boolean: 'z.boolean()',
    DateTime: 'z.coerce.date()',
    UUID: 'z.string().uuid()',
    Decimal: 'z.number()',
    Json: 'z.record(z.unknown())',
  };
  return map[type] ?? 'z.string()';
}

export function fieldToPrismaType(field: EntityField): string {
  const map: Record<FieldType, string> = {
    String: 'String',
    Int: 'Int',
    Float: 'Float',
    Boolean: 'Boolean',
    DateTime: 'DateTime',
    UUID: 'String',
    Decimal: 'Decimal',
    Json: 'Json',
  };
  const base = map[field.type] ?? 'String';
  return field.required ? base : `${base}?`;
}

export function fieldToTsType(field: EntityField): string {
  const map: Record<FieldType, string> = {
    String: 'string',
    Int: 'number',
    Float: 'number',
    Boolean: 'boolean',
    DateTime: 'Date',
    UUID: 'string',
    Decimal: 'number',
    Json: 'Record<string, unknown>',
  };
  const base = map[field.type] ?? 'string';
  return field.required ? base : `${base} | undefined`;
}
