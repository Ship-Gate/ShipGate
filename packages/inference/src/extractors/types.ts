/**
 * Type Extractor
 *
 * Extract type definitions from parsed source files.
 */

import type { TypeScriptParseResult } from '../parsers/typescript.js';
import type { PythonParseResult } from '../parsers/python.js';
import type { ExtractedType, ExtractedField } from '../analyzer.js';

/**
 * Extract type definitions from parse result
 */
export function extractTypes(
  parseResult: TypeScriptParseResult | PythonParseResult
): ExtractedType[] {
  if (parseResult.language === 'typescript') {
    return extractTypesFromTypeScript(parseResult);
  } else {
    return extractTypesFromPython(parseResult);
  }
}

function extractTypesFromTypeScript(result: TypeScriptParseResult): ExtractedType[] {
  const types: ExtractedType[] = [];

  // Extract interfaces
  for (const iface of result.interfaces) {
    const fields = iface.properties.map((p) => mapTypeScriptField(p));

    types.push({
      name: iface.name,
      fields,
      isEnum: false,
      sourceLocation: iface.location,
    });
  }

  // Extract enums
  for (const enumDef of result.enums) {
    types.push({
      name: enumDef.name,
      fields: [],
      isEnum: true,
      enumValues: enumDef.members,
      sourceLocation: enumDef.location,
    });
  }

  // Extract type aliases that are union literals (can become enums)
  for (const typeDef of result.types) {
    if (typeDef.isUnion && typeDef.unionMembers?.every((m) => isStringLiteral(m))) {
      types.push({
        name: typeDef.name,
        fields: [],
        isEnum: true,
        enumValues: typeDef.unionMembers.map((m) => toEnumValue(m)),
        sourceLocation: typeDef.location,
      });
    }
  }

  // Extract classes as entities
  for (const cls of result.classes) {
    const fields = cls.properties.map((p) => mapTypeScriptField(p));

    types.push({
      name: cls.name,
      fields,
      isEnum: false,
      sourceLocation: cls.location,
    });
  }

  return types;
}

function extractTypesFromPython(result: PythonParseResult): ExtractedType[] {
  const types: ExtractedType[] = [];

  // Extract dataclasses as entities
  for (const dataclass of result.dataclasses) {
    const fields: ExtractedField[] = dataclass.fields.map((f) => ({
      name: f.name,
      type: mapPythonType(f.type),
      optional: f.optional,
      defaultValue: f.default,
      annotations: dataclass.frozen ? ['immutable'] : [],
    }));

    types.push({
      name: dataclass.name,
      fields,
      isEnum: false,
      sourceLocation: dataclass.location,
    });
  }

  // Extract enums
  for (const enumDef of result.enums) {
    types.push({
      name: enumDef.name,
      fields: [],
      isEnum: true,
      enumValues: enumDef.members,
      sourceLocation: enumDef.location,
    });
  }

  // Extract regular classes as entities
  for (const cls of result.classes) {
    const fields: ExtractedField[] = cls.attributes.map((a) => ({
      name: a.name,
      type: mapPythonType(a.type ?? 'Any'),
      optional: false,
      annotations: [],
    }));

    types.push({
      name: cls.name,
      fields,
      isEnum: false,
      sourceLocation: cls.location,
    });
  }

  return types;
}

function mapTypeScriptField(prop: {
  name: string;
  type: string;
  optional: boolean;
  readonly: boolean;
  initializer?: string;
}): ExtractedField {
  const annotations: string[] = [];

  if (prop.readonly) {
    annotations.push('immutable');
  }

  // Detect common patterns
  if (prop.name === 'id' || prop.name.endsWith('Id')) {
    if (!annotations.includes('immutable')) {
      annotations.push('immutable');
    }
    annotations.push('unique');
  }

  if (prop.name === 'email') {
    annotations.push('unique');
  }

  if (prop.name.includes('password') || prop.name.includes('secret') || prop.name.includes('token')) {
    annotations.push('secret');
  }

  if (prop.name.includes('createdAt') || prop.name.includes('created_at')) {
    if (!annotations.includes('immutable')) {
      annotations.push('immutable');
    }
  }

  return {
    name: toSnakeCase(prop.name),
    type: mapTypeScriptType(prop.type),
    optional: prop.optional,
    defaultValue: prop.initializer,
    annotations,
  };
}

function mapTypeScriptType(tsType: string): string {
  const typeMap: Record<string, string> = {
    string: 'String',
    number: 'Int',
    boolean: 'Boolean',
    Date: 'Timestamp',
    void: 'Void',
    null: 'Null',
    undefined: 'Null',
    any: 'Any',
    unknown: 'Any',
  };

  // Handle Promise<T>
  const promiseMatch = tsType.match(/Promise<(.+)>/);
  if (promiseMatch) {
    return mapTypeScriptType(promiseMatch[1]);
  }

  // Handle Array<T> or T[]
  const arrayMatch = tsType.match(/Array<(.+)>/) || tsType.match(/(.+)\[\]/);
  if (arrayMatch) {
    return `List<${mapTypeScriptType(arrayMatch[1])}>`;
  }

  // Handle union types with null/undefined (optional)
  if (tsType.includes('| null') || tsType.includes('| undefined')) {
    const baseType = tsType.replace(/\s*\|\s*(null|undefined)/g, '').trim();
    return mapTypeScriptType(baseType);
  }

  // Handle literal union types
  if (tsType.includes("'") || tsType.includes('"')) {
    return 'String'; // String literal union becomes String
  }

  return typeMap[tsType] ?? capitalize(tsType);
}

function mapPythonType(pyType: string): string {
  const typeMap: Record<string, string> = {
    str: 'String',
    int: 'Int',
    float: 'Float',
    bool: 'Boolean',
    datetime: 'Timestamp',
    date: 'Date',
    None: 'Null',
    Any: 'Any',
  };

  // Handle Optional[T]
  const optionalMatch = pyType.match(/Optional\[(.+)\]/);
  if (optionalMatch) {
    return mapPythonType(optionalMatch[1]);
  }

  // Handle List[T]
  const listMatch = pyType.match(/(?:List|list)\[(.+)\]/);
  if (listMatch) {
    return `List<${mapPythonType(listMatch[1])}>`;
  }

  // Handle Dict[K, V]
  const dictMatch = pyType.match(/(?:Dict|dict)\[.+\]/);
  if (dictMatch) {
    return 'JSON';
  }

  return typeMap[pyType] ?? capitalize(pyType);
}

function isStringLiteral(value: string): boolean {
  return value.startsWith("'") || value.startsWith('"');
}

function toEnumValue(literal: string): string {
  // Remove quotes and convert to SCREAMING_SNAKE_CASE
  return literal.replace(/['"]/g, '').toUpperCase().replace(/[- ]/g, '_');
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
