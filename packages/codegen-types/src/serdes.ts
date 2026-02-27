/**
 * Serialization/Deserialization Generator
 * 
 * Generates JSON serialization helpers for ISL types.
 */

import type {
  DomainDeclaration,
  EntityDeclaration,
  BehaviorDeclaration,
  TypeExpression,
} from '@isl-lang/isl-core';

import type { GeneratorOptions } from './generator.js';

// ============================================================================
// SerDes Generator
// ============================================================================

export class SerdesGenerator {
  private output: string[] = [];
  private indent = 0;
  private options: GeneratorOptions;

  constructor(options: GeneratorOptions) {
    this.options = options;
  }

  // --------------------------------------------------------------------------
  // TypeScript SerDes Generation
  // --------------------------------------------------------------------------

  /**
   * Generate TypeScript serialization helpers
   */
  generateTypeScript(domain: DomainDeclaration): string {
    this.output = [];
    this.indent = 0;

    this.writeTypeScriptHeader(domain);
    this.writeTypeScriptImports();

    // Generate serdes for entities
    for (const entity of domain.entities) {
      this.generateTypeScriptEntitySerdes(entity);
      this.writeLine('');
    }

    // Generate serdes for behaviors
    for (const behavior of domain.behaviors) {
      this.generateTypeScriptBehaviorSerdes(behavior);
      this.writeLine('');
    }

    // Generate generic serdes utilities
    this.generateTypeScriptUtils(domain);

    return this.output.join('\n');
  }

  private writeTypeScriptHeader(domain: DomainDeclaration): void {
    if (this.options.comments) {
      this.writeLine('/**');
      this.writeLine(` * Generated serialization helpers for ${domain.name.name} domain`);
      if (domain.version) {
        this.writeLine(` * Version: ${domain.version.value}`);
      }
      this.writeLine(' * ');
      this.writeLine(' * DO NOT EDIT - This file is auto-generated from ISL');
      this.writeLine(` * Generated at: ${new Date().toISOString()}`);
      this.writeLine(' */');
      this.writeLine('');
    }
  }

  private writeTypeScriptImports(): void {
    this.writeLine("import type * as Types from './types.js';");
    this.writeLine('');
    this.writeLine('// ============================================================================');
    this.writeLine('// Serialization Types');
    this.writeLine('// ============================================================================');
    this.writeLine('');
    this.writeLine('/** JSON-safe serialized form */');
    this.writeLine('export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };');
    this.writeLine('');
    this.writeLine('/** Serialization result */');
    this.writeLine('export interface SerializationResult<T> {');
    this.indent++;
    this.writeLine('success: boolean;');
    this.writeLine('data?: T;');
    this.writeLine('error?: string;');
    this.indent--;
    this.writeLine('}');
    this.writeLine('');
    this.writeLine('// ============================================================================');
    this.writeLine('// Base Serializers');
    this.writeLine('// ============================================================================');
    this.writeLine('');
    this.writeLine('/** Serialize a Date to ISO string */');
    this.writeLine('export function serializeTimestamp(date: Date | string): string {');
    this.indent++;
    this.writeLine('if (typeof date === "string") return date;');
    this.writeLine('return date.toISOString();');
    this.indent--;
    this.writeLine('}');
    this.writeLine('');
    this.writeLine('/** Deserialize ISO string to Date */');
    this.writeLine('export function deserializeTimestamp(value: string): Date {');
    this.indent++;
    this.writeLine('return new Date(value);');
    this.indent--;
    this.writeLine('}');
    this.writeLine('');
    this.writeLine('/** Serialize Decimal to string */');
    this.writeLine('export function serializeDecimal(value: string | number): string {');
    this.indent++;
    this.writeLine('return String(value);');
    this.indent--;
    this.writeLine('}');
    this.writeLine('');
    this.writeLine('/** Deserialize string to Decimal */');
    this.writeLine('export function deserializeDecimal(value: string): string {');
    this.indent++;
    this.writeLine('return value;');
    this.indent--;
    this.writeLine('}');
    this.writeLine('');
    this.writeLine('/** Serialize Money */');
    this.writeLine('export function serializeMoney(money: Types.Money): { amount: string; currency: string } {');
    this.indent++;
    this.writeLine('return {');
    this.indent++;
    this.writeLine('amount: serializeDecimal(money.amount),');
    this.writeLine('currency: money.currency,');
    this.indent--;
    this.writeLine('};');
    this.indent--;
    this.writeLine('}');
    this.writeLine('');
    this.writeLine('/** Deserialize Money */');
    this.writeLine('export function deserializeMoney(json: { amount: string; currency: string }): Types.Money {');
    this.indent++;
    this.writeLine('return {');
    this.indent++;
    this.writeLine('amount: deserializeDecimal(json.amount),');
    this.writeLine('currency: json.currency,');
    this.indent--;
    this.writeLine('};');
    this.indent--;
    this.writeLine('}');
    this.writeLine('');
  }

  private generateTypeScriptEntitySerdes(entity: EntityDeclaration): void {
    const name = entity.name.name;

    if (this.options.comments) {
      this.writeLine(`// ============================================================================`);
      this.writeLine(`// ${name} Serialization`);
      this.writeLine(`// ============================================================================`);
      this.writeLine('');
    }

    // Serialized type
    this.writeLine(`/** JSON-safe serialized form of ${name} */`);
    this.writeLine(`export interface ${name}Serialized {`);
    this.indent++;
    for (const field of entity.fields) {
      const jsonType = this.getJsonType(field.type, field.optional);
      this.writeLine(`${field.name.name}${field.optional ? '?' : ''}: ${jsonType};`);
    }
    this.indent--;
    this.writeLine('}');
    this.writeLine('');

    // Serialize function
    this.writeLine(`/** Serialize ${name} to JSON-safe object */`);
    this.writeLine(`export function serialize${name}(entity: Types.${name}): ${name}Serialized {`);
    this.indent++;
    this.writeLine('return {');
    this.indent++;
    for (const field of entity.fields) {
      const serializer = this.getSerializer(field.type, `entity.${field.name.name}`, field.optional);
      this.writeLine(`${field.name.name}: ${serializer},`);
    }
    this.indent--;
    this.writeLine('};');
    this.indent--;
    this.writeLine('}');
    this.writeLine('');

    // Deserialize function
    this.writeLine(`/** Deserialize JSON to ${name} */`);
    this.writeLine(`export function deserialize${name}(json: ${name}Serialized): Types.${name} {`);
    this.indent++;
    this.writeLine('return {');
    this.indent++;
    for (const field of entity.fields) {
      const deserializer = this.getDeserializer(field.type, `json.${field.name.name}`, field.optional);
      this.writeLine(`${field.name.name}: ${deserializer},`);
    }
    this.indent--;
    this.writeLine('};');
    this.indent--;
    this.writeLine('}');
    this.writeLine('');

    // Safe deserialize
    this.writeLine(`/** Safely deserialize JSON to ${name} */`);
    this.writeLine(`export function safeDeserialize${name}(json: unknown): SerializationResult<Types.${name}> {`);
    this.indent++;
    this.writeLine('try {');
    this.indent++;
    this.writeLine(`return { success: true, data: deserialize${name}(json as ${name}Serialized) };`);
    this.indent--;
    this.writeLine('} catch (error) {');
    this.indent++;
    this.writeLine('return { success: false, error: error instanceof Error ? error.message : String(error) };');
    this.indent--;
    this.writeLine('}');
    this.indent--;
    this.writeLine('}');
  }

  private generateTypeScriptBehaviorSerdes(behavior: BehaviorDeclaration): void {
    const name = behavior.name.name;

    if (this.options.comments) {
      this.writeLine(`// ${name} Serialization`);
      this.writeLine('');
    }

    // Input serialization
    if (behavior.input) {
      this.writeLine(`/** Serialize ${name} input */`);
      this.writeLine(`export function serialize${name}Input(input: Types.${name}Input): JsonValue {`);
      this.indent++;
      this.writeLine('return {');
      this.indent++;
      for (const field of behavior.input.fields) {
        const serializer = this.getSerializer(field.type, `input.${field.name.name}`, field.optional);
        this.writeLine(`${field.name.name}: ${serializer},`);
      }
      this.indent--;
      this.writeLine('} as JsonValue;');
      this.indent--;
      this.writeLine('}');
      this.writeLine('');
    }

    // Result serialization
    if (behavior.output) {
      this.writeLine(`/** Serialize ${name} result */`);
      this.writeLine(`export function serialize${name}Result(result: Types.${name}Result): JsonValue {`);
      this.indent++;
      this.writeLine('if (result.success) {');
      this.indent++;
      this.writeLine('return {');
      this.indent++;
      this.writeLine('success: true,');
      this.writeLine('data: result.data, // TODO: Add custom serialization if needed');
      this.indent--;
      this.writeLine('} as JsonValue;');
      this.indent--;
      this.writeLine('} else {');
      this.indent++;
      this.writeLine('return {');
      this.indent++;
      this.writeLine('success: false,');
      this.writeLine('error: result.error,');
      this.indent--;
      this.writeLine('} as JsonValue;');
      this.indent--;
      this.writeLine('}');
      this.indent--;
      this.writeLine('}');
    }
  }

  private generateTypeScriptUtils(domain: DomainDeclaration): void {
    this.writeLine('// ============================================================================');
    this.writeLine('// Serialization Registry');
    this.writeLine('// ============================================================================');
    this.writeLine('');

    this.writeLine('/** Serializer registry for all entities */');
    this.writeLine('export const Serializers = {');
    this.indent++;
    for (const entity of domain.entities) {
      this.writeLine(`${entity.name.name}: serialize${entity.name.name},`);
    }
    this.indent--;
    this.writeLine('} as const;');
    this.writeLine('');

    this.writeLine('/** Deserializer registry for all entities */');
    this.writeLine('export const Deserializers = {');
    this.indent++;
    for (const entity of domain.entities) {
      this.writeLine(`${entity.name.name}: deserialize${entity.name.name},`);
    }
    this.indent--;
    this.writeLine('} as const;');
    this.writeLine('');

    // Batch serialization
    this.writeLine('/**');
    this.writeLine(' * Serialize an array of entities');
    this.writeLine(' */');
    this.writeLine('export function serializeArray<T, S>(');
    this.indent++;
    this.writeLine('items: T[],');
    this.writeLine('serializer: (item: T) => S');
    this.indent--;
    this.writeLine('): S[] {');
    this.indent++;
    this.writeLine('return items.map(serializer);');
    this.indent--;
    this.writeLine('}');
    this.writeLine('');

    // JSON stringify helper
    this.writeLine('/**');
    this.writeLine(' * Serialize entity to JSON string');
    this.writeLine(' */');
    this.writeLine('export function toJSON<K extends keyof typeof Serializers>(');
    this.indent++;
    this.writeLine('entityType: K,');
    this.writeLine('entity: Parameters<typeof Serializers[K]>[0],');
    this.writeLine('pretty = false');
    this.indent--;
    this.writeLine('): string {');
    this.indent++;
    this.writeLine('const serializer = Serializers[entityType] as (e: typeof entity) => unknown;');
    this.writeLine('const serialized = serializer(entity);');
    this.writeLine('return pretty ? JSON.stringify(serialized, null, 2) : JSON.stringify(serialized);');
    this.indent--;
    this.writeLine('}');
    this.writeLine('');

    // JSON parse helper
    this.writeLine('/**');
    this.writeLine(' * Deserialize entity from JSON string');
    this.writeLine(' */');
    this.writeLine('export function fromJSON<K extends keyof typeof Deserializers>(');
    this.indent++;
    this.writeLine('entityType: K,');
    this.writeLine('json: string');
    this.indent--;
    this.writeLine('): ReturnType<typeof Deserializers[K]> {');
    this.indent++;
    this.writeLine('const parsed = JSON.parse(json);');
    this.writeLine('const deserializer = Deserializers[entityType] as (j: unknown) => ReturnType<typeof Deserializers[K]>;');
    this.writeLine('return deserializer(parsed);');
    this.indent--;
    this.writeLine('}');
  }

  // --------------------------------------------------------------------------
  // Python SerDes Generation
  // --------------------------------------------------------------------------

  /**
   * Generate Python serialization helpers
   */
  generatePython(domain: DomainDeclaration): string {
    this.output = [];
    this.indent = 0;

    this.writePythonHeader(domain);
    this.writePythonImports();

    // Generate serdes for entities
    for (const entity of domain.entities) {
      this.generatePythonEntitySerdes(entity);
      this.writeLine('');
    }

    // Generate serdes utilities
    this.generatePythonUtils(domain);

    return this.output.join('\n');
  }

  private writePythonHeader(domain: DomainDeclaration): void {
    this.writeLine('"""');
    this.writeLine(`Generated serialization helpers for ${domain.name.name} domain`);
    if (domain.version) {
      this.writeLine(`Version: ${domain.version.value}`);
    }
    this.writeLine('');
    this.writeLine('DO NOT EDIT - This file is auto-generated from ISL');
    this.writeLine(`Generated at: ${new Date().toISOString()}`);
    this.writeLine('"""');
    this.writeLine('');
  }

  private writePythonImports(): void {
    this.writeLine('from __future__ import annotations');
    this.writeLine('import json');
    this.writeLine('from dataclasses import asdict');
    this.writeLine('from datetime import datetime');
    this.writeLine('from decimal import Decimal');
    this.writeLine('from typing import Any, Dict, List, Optional, Type, TypeVar, Union');
    this.writeLine('from uuid import UUID');
    this.writeLine('');
    this.writeLine('from .types import *');
    this.writeLine('');
    this.writeLine('');
    this.writeLine('T = TypeVar("T")');
    this.writeLine('');
    this.writeLine('');
    this.writeLine('# =============================================================================');
    this.writeLine('# Base Serializers');
    this.writeLine('# =============================================================================');
    this.writeLine('');
    this.writeLine('def serialize_timestamp(dt: datetime | str) -> str:');
    this.indent++;
    this.writeLine('"""Serialize datetime to ISO string"""');
    this.writeLine('if isinstance(dt, str):');
    this.indent++;
    this.writeLine('return dt');
    this.indent--;
    this.writeLine('return dt.isoformat()');
    this.indent--;
    this.writeLine('');
    this.writeLine('');
    this.writeLine('def deserialize_timestamp(value: str) -> datetime:');
    this.indent++;
    this.writeLine('"""Deserialize ISO string to datetime"""');
    this.writeLine('return datetime.fromisoformat(value.replace("Z", "+00:00"))');
    this.indent--;
    this.writeLine('');
    this.writeLine('');
    this.writeLine('def serialize_decimal(value: Decimal | str | float) -> str:');
    this.indent++;
    this.writeLine('"""Serialize Decimal to string"""');
    this.writeLine('return str(value)');
    this.indent--;
    this.writeLine('');
    this.writeLine('');
    this.writeLine('def deserialize_decimal(value: str) -> Decimal:');
    this.indent++;
    this.writeLine('"""Deserialize string to Decimal"""');
    this.writeLine('return Decimal(value)');
    this.indent--;
    this.writeLine('');
    this.writeLine('');
    this.writeLine('def serialize_uuid(value: UUID | str) -> str:');
    this.indent++;
    this.writeLine('"""Serialize UUID to string"""');
    this.writeLine('if isinstance(value, str):');
    this.indent++;
    this.writeLine('return value');
    this.indent--;
    this.writeLine('return str(value)');
    this.indent--;
    this.writeLine('');
    this.writeLine('');
    this.writeLine('def deserialize_uuid(value: str) -> UUID:');
    this.indent++;
    this.writeLine('"""Deserialize string to UUID"""');
    this.writeLine('return UUID(value)');
    this.indent--;
    this.writeLine('');
    this.writeLine('');
    this.writeLine('def serialize_money(money: Money) -> Dict[str, str]:');
    this.indent++;
    this.writeLine('"""Serialize Money to dict"""');
    this.writeLine('return {');
    this.indent++;
    this.writeLine('"amount": serialize_decimal(money.amount),');
    this.writeLine('"currency": money.currency,');
    this.indent--;
    this.writeLine('}');
    this.indent--;
    this.writeLine('');
    this.writeLine('');
    this.writeLine('def deserialize_money(data: Dict[str, str]) -> Money:');
    this.indent++;
    this.writeLine('"""Deserialize dict to Money"""');
    this.writeLine('return Money(');
    this.indent++;
    this.writeLine('amount=deserialize_decimal(data["amount"]),');
    this.writeLine('currency=data["currency"],');
    this.indent--;
    this.writeLine(')');
    this.indent--;
    this.writeLine('');
    this.writeLine('');
  }

  private generatePythonEntitySerdes(entity: EntityDeclaration): void {
    const name = entity.name.name;
    const snakeName = this.toSnakeCase(name);

    this.writeLine('# ' + '='.repeat(77));
    this.writeLine(`# ${name} Serialization`);
    this.writeLine('# ' + '='.repeat(77));
    this.writeLine('');

    // Serialize function
    this.writeLine(`def serialize_${snakeName}(entity: ${name}) -> Dict[str, Any]:`);
    this.indent++;
    this.writeLine(`"""Serialize ${name} to JSON-safe dict"""`);
    this.writeLine('return {');
    this.indent++;
    for (const field of entity.fields) {
      const pyFieldName = this.toSnakeCase(field.name.name);
      const serializer = this.getPythonSerializer(field.type, `entity.${pyFieldName}`, field.optional);
      this.writeLine(`"${field.name.name}": ${serializer},`);
    }
    this.indent--;
    this.writeLine('}');
    this.indent--;
    this.writeLine('');
    this.writeLine('');

    // Deserialize function
    this.writeLine(`def deserialize_${snakeName}(data: Dict[str, Any]) -> ${name}:`);
    this.indent++;
    this.writeLine(`"""Deserialize JSON dict to ${name}"""`);
    this.writeLine(`return ${name}(`);
    this.indent++;
    for (const field of entity.fields) {
      const pyFieldName = this.toSnakeCase(field.name.name);
      const deserializer = this.getPythonDeserializer(field.type, `data["${field.name.name}"]`, field.optional);
      this.writeLine(`${pyFieldName}=${deserializer},`);
    }
    this.indent--;
    this.writeLine(')');
    this.indent--;
    this.writeLine('');
    this.writeLine('');
  }

  private generatePythonUtils(domain: DomainDeclaration): void {
    this.writeLine('# =============================================================================');
    this.writeLine('# Serialization Registry');
    this.writeLine('# =============================================================================');
    this.writeLine('');

    // Serializers dict
    this.writeLine('SERIALIZERS: Dict[str, Any] = {');
    this.indent++;
    for (const entity of domain.entities) {
      const snakeName = this.toSnakeCase(entity.name.name);
      this.writeLine(`"${entity.name.name}": serialize_${snakeName},`);
    }
    this.indent--;
    this.writeLine('}');
    this.writeLine('');
    this.writeLine('');

    // Deserializers dict
    this.writeLine('DESERIALIZERS: Dict[str, Any] = {');
    this.indent++;
    for (const entity of domain.entities) {
      const snakeName = this.toSnakeCase(entity.name.name);
      this.writeLine(`"${entity.name.name}": deserialize_${snakeName},`);
    }
    this.indent--;
    this.writeLine('}');
    this.writeLine('');
    this.writeLine('');

    // JSON helpers
    this.writeLine('def to_json(entity_type: str, entity: Any, pretty: bool = False) -> str:');
    this.indent++;
    this.writeLine('"""Serialize entity to JSON string"""');
    this.writeLine('serializer = SERIALIZERS[entity_type]');
    this.writeLine('data = serializer(entity)');
    this.writeLine('if pretty:');
    this.indent++;
    this.writeLine('return json.dumps(data, indent=2, default=str)');
    this.indent--;
    this.writeLine('return json.dumps(data, default=str)');
    this.indent--;
    this.writeLine('');
    this.writeLine('');

    this.writeLine('def from_json(entity_type: str, json_str: str) -> Any:');
    this.indent++;
    this.writeLine('"""Deserialize entity from JSON string"""');
    this.writeLine('data = json.loads(json_str)');
    this.writeLine('deserializer = DESERIALIZERS[entity_type]');
    this.writeLine('return deserializer(data)');
    this.indent--;
  }

  // --------------------------------------------------------------------------
  // Type Conversion Helpers
  // --------------------------------------------------------------------------

  private getJsonType(type: TypeExpression, optional: boolean): string {
    let jsonType: string;

    switch (type.kind) {
      case 'SimpleType': {
        const name = type.name.name;
        switch (name) {
          case 'Timestamp':
          case 'Date':
          case 'UUID':
          case 'Decimal':
            jsonType = 'string';
            break;
          case 'Money':
            jsonType = '{ amount: string; currency: string }';
            break;
          case 'Int':
          case 'Float':
          case 'Duration':
            jsonType = 'number';
            break;
          case 'Boolean':
            jsonType = 'boolean';
            break;
          case 'JSON':
            jsonType = 'Record<string, unknown>';
            break;
          default:
            jsonType = 'string';
        }
        break;
      }
      case 'ArrayType':
        jsonType = `${this.getJsonType(type.elementType, false)}[]`;
        break;
      case 'GenericType':
        if (type.name.name === 'List') {
          jsonType = `${this.getJsonType(type.typeArguments[0]!, false)}[]`;
        } else {
          jsonType = 'unknown';
        }
        break;
      default:
        jsonType = 'unknown';
    }

    return optional ? `${jsonType} | null` : jsonType;
  }

  private getSerializer(type: TypeExpression, accessor: string, optional: boolean): string {
    if (optional) {
      const inner = this.getSerializer(type, accessor, false);
      return `${accessor} != null ? ${inner.replace(accessor, accessor)} : null`;
    }

    switch (type.kind) {
      case 'SimpleType': {
        const name = type.name.name;
        switch (name) {
          case 'Timestamp':
            return `serializeTimestamp(${accessor})`;
          case 'Decimal':
            return `serializeDecimal(${accessor})`;
          case 'Money':
            return `serializeMoney(${accessor})`;
          case 'UUID':
            return accessor; // UUID is already a string
          default:
            return accessor;
        }
      }
      case 'ArrayType':
        return `${accessor}.map(item => ${this.getSerializer(type.elementType, 'item', false)})`;
      default:
        return accessor;
    }
  }

  private getDeserializer(type: TypeExpression, accessor: string, optional: boolean): string {
    if (optional) {
      const inner = this.getDeserializer(type, accessor, false);
      return `${accessor} != null ? ${inner} : undefined`;
    }

    switch (type.kind) {
      case 'SimpleType': {
        const name = type.name.name;
        switch (name) {
          case 'Timestamp':
            return `deserializeTimestamp(${accessor})`;
          case 'Decimal':
            return `deserializeDecimal(${accessor})`;
          case 'Money':
            return `deserializeMoney(${accessor})`;
          default:
            return accessor;
        }
      }
      case 'ArrayType':
        return `${accessor}.map((item: unknown) => ${this.getDeserializer(type.elementType, 'item', false)})`;
      default:
        return accessor;
    }
  }

  private getPythonSerializer(type: TypeExpression, accessor: string, optional: boolean): string {
    if (optional) {
      const inner = this.getPythonSerializer(type, accessor, false);
      return `${inner} if ${accessor} is not None else None`;
    }

    switch (type.kind) {
      case 'SimpleType': {
        const name = type.name.name;
        switch (name) {
          case 'Timestamp':
            return `serialize_timestamp(${accessor})`;
          case 'Decimal':
            return `serialize_decimal(${accessor})`;
          case 'UUID':
            return `serialize_uuid(${accessor})`;
          case 'Money':
            return `serialize_money(${accessor})`;
          default:
            return accessor;
        }
      }
      case 'ArrayType':
        return `[${this.getPythonSerializer(type.elementType, 'item', false)} for item in ${accessor}]`;
      default:
        return accessor;
    }
  }

  private getPythonDeserializer(type: TypeExpression, accessor: string, optional: boolean): string {
    if (optional) {
      const inner = this.getPythonDeserializer(type, accessor, false);
      return `${inner} if ${accessor.replace('["', '.get("').replace('"]', '")')} is not None else None`;
    }

    switch (type.kind) {
      case 'SimpleType': {
        const name = type.name.name;
        switch (name) {
          case 'Timestamp':
            return `deserialize_timestamp(${accessor})`;
          case 'Decimal':
            return `deserialize_decimal(${accessor})`;
          case 'UUID':
            return `deserialize_uuid(${accessor})`;
          case 'Money':
            return `deserialize_money(${accessor})`;
          default:
            return accessor;
        }
      }
      case 'ArrayType':
        return `[${this.getPythonDeserializer(type.elementType, 'item', false)} for item in ${accessor}]`;
      default:
        return accessor;
    }
  }

  private toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
      .replace(/__/g, '_');
  }

  private writeLine(line: string): void {
    const indentStr = this.options.language === 'python' 
      ? '    '.repeat(this.indent)
      : '  '.repeat(this.indent);
    this.output.push(indentStr + line);
  }
}

// ============================================================================
// Convenience Function
// ============================================================================

/**
 * Generate serialization helpers from an ISL domain
 */
export function generateSerdes(
  domain: DomainDeclaration,
  options?: Partial<GeneratorOptions>
): { typescript: string; python: string } {
  const generator = new SerdesGenerator({
    language: 'typescript',
    validation: false,
    comments: true,
    ...options,
  });

  return {
    typescript: generator.generateTypeScript(domain),
    python: generator.generatePython(domain),
  };
}
