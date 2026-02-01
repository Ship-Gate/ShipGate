/**
 * TypeScript Source Adapter
 *
 * Extracts types from TypeScript type definitions via static analysis.
 * Note: This is a text-based parser, not full TypeScript compilation.
 */

import type {
  SourceAdapter,
  MigrationSource,
  ExtractedType,
  ExtractedOperation,
  ExtractedProperty,
} from '../types.js';

// ============================================================================
// TypeScript Pattern Matchers
// ============================================================================

const TS_PATTERNS = {
  // Interface: interface User { ... }
  interfaceDecl: /(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+[\w,\s]+)?\s*\{([^}]*)\}/g,

  // Type alias: type Status = 'active' | 'inactive'
  typeAlias: /(?:export\s+)?type\s+(\w+)\s*=\s*([^;]+);/g,

  // Enum: enum Status { Active, Inactive }
  enumDecl: /(?:export\s+)?enum\s+(\w+)\s*\{([^}]*)\}/g,

  // Property: name: string; or name?: string;
  property: /(\w+)(\?)?:\s*([^;,}]+)/g,
};

// ============================================================================
// Adapter Implementation
// ============================================================================

class TypeScriptAdapter implements SourceAdapter {
  readonly sourceType = 'typescript' as const;

  extractTypes(source: MigrationSource): ExtractedType[] {
    const types: ExtractedType[] = [];
    const content = source.content;

    // Extract interfaces
    types.push(...this.extractInterfaces(content));

    // Extract type aliases
    types.push(...this.extractTypeAliases(content));

    // Extract enums
    types.push(...this.extractEnums(content));

    return types;
  }

  extractOperations(_source: MigrationSource): ExtractedOperation[] {
    // TypeScript type files don't typically define operations
    // Could potentially extract function signatures in the future
    return [];
  }

  private extractInterfaces(content: string): ExtractedType[] {
    const types: ExtractedType[] = [];
    const regex = new RegExp(TS_PATTERNS.interfaceDecl.source, 'g');

    let match;
    while ((match = regex.exec(content)) !== null) {
      const [, name, body] = match;
      const properties = this.parseProperties(body);

      types.push({
        kind: 'object',
        name,
        properties,
      });
    }

    return types;
  }

  private extractTypeAliases(content: string): ExtractedType[] {
    const types: ExtractedType[] = [];
    const regex = new RegExp(TS_PATTERNS.typeAlias.source, 'g');

    let match;
    while ((match = regex.exec(content)) !== null) {
      const [, name, definition] = match;
      const type = this.parseTypeDefinition(definition.trim(), name);
      if (type) {
        types.push(type);
      }
    }

    return types;
  }

  private extractEnums(content: string): ExtractedType[] {
    const types: ExtractedType[] = [];
    const regex = new RegExp(TS_PATTERNS.enumDecl.source, 'g');

    let match;
    while ((match = regex.exec(content)) !== null) {
      const [, name, body] = match;
      const values = this.parseEnumValues(body);

      types.push({
        kind: 'enum',
        name,
        enumValues: values,
      });
    }

    return types;
  }

  private parseProperties(body: string): ExtractedProperty[] {
    const properties: ExtractedProperty[] = [];
    const lines = body.split(/[;\n]/).filter((l) => l.trim());

    for (const line of lines) {
      const match = line.match(/^\s*(\w+)(\?)?:\s*(.+?)\s*$/);
      if (match) {
        const [, propName, optional, typeStr] = match;
        const type = this.parseTypeString(typeStr.trim());

        properties.push({
          name: propName,
          type,
          required: !optional,
        });
      }
    }

    return properties;
  }

  private parseTypeDefinition(definition: string, name?: string): ExtractedType | null {
    const trimmed = definition.trim();

    // Union type: 'a' | 'b' | 'c'
    if (trimmed.includes('|')) {
      return this.parseUnionType(trimmed, name);
    }

    // Object type: { name: string; ... }
    if (trimmed.startsWith('{')) {
      const body = trimmed.slice(1, -1);
      return {
        kind: 'object',
        name,
        properties: this.parseProperties(body),
      };
    }

    // Array type: string[] or Array<string>
    if (trimmed.endsWith('[]') || trimmed.startsWith('Array<')) {
      return this.parseArrayType(trimmed, name);
    }

    // Simple type reference or primitive
    return this.parseTypeString(trimmed, name);
  }

  private parseUnionType(definition: string, name?: string): ExtractedType {
    const variants = definition.split('|').map((v) => v.trim());

    // Check if it's a string literal union (enum-like)
    const isLiteralUnion = variants.every(
      (v) => (v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))
    );

    if (isLiteralUnion) {
      return {
        kind: 'enum',
        name,
        enumValues: variants.map((v) => v.slice(1, -1)),
      };
    }

    // It's a type union
    return {
      kind: 'union',
      name,
      unionTypes: variants.map((v) => this.parseTypeString(v)),
    };
  }

  private parseArrayType(definition: string, name?: string): ExtractedType {
    let itemTypeStr: string;

    if (definition.endsWith('[]')) {
      itemTypeStr = definition.slice(0, -2).trim();
    } else {
      // Array<T>
      const match = definition.match(/Array<(.+)>/);
      itemTypeStr = match ? match[1].trim() : 'unknown';
    }

    return {
      kind: 'array',
      name,
      itemType: this.parseTypeString(itemTypeStr),
    };
  }

  private parseTypeString(typeStr: string, name?: string): ExtractedType {
    const trimmed = typeStr.trim();

    // Handle nullable types
    const nullable = trimmed.endsWith(' | null') || trimmed.endsWith('| null');
    const cleanType = trimmed.replace(/\s*\|\s*null\s*$/, '').trim();

    // Primitive types
    const primitiveMap: Record<string, string> = {
      string: 'String',
      number: 'Decimal',
      boolean: 'Boolean',
      Date: 'Timestamp',
      bigint: 'Int',
      any: 'String',
      unknown: 'String',
    };

    if (primitiveMap[cleanType]) {
      return {
        kind: 'primitive',
        name,
        primitiveType: primitiveMap[cleanType],
        nullable,
      };
    }

    // Array shorthand
    if (cleanType.endsWith('[]')) {
      return {
        kind: 'array',
        name,
        itemType: this.parseTypeString(cleanType.slice(0, -2)),
        nullable,
      };
    }

    // Array<T>
    if (cleanType.startsWith('Array<')) {
      const match = cleanType.match(/Array<(.+)>/);
      return {
        kind: 'array',
        name,
        itemType: match ? this.parseTypeString(match[1]) : { kind: 'unknown' },
        nullable,
      };
    }

    // Generic types like Record<K, V>, Map<K, V>, etc.
    if (cleanType.includes('<')) {
      // For now, treat as unknown - could enhance later
      return {
        kind: 'unknown',
        name: name ?? cleanType,
        nullable,
      };
    }

    // Type reference
    return {
      kind: 'reference',
      name,
      refName: cleanType,
      nullable,
    };
  }

  private parseEnumValues(body: string): Array<string | number> {
    const values: Array<string | number> = [];
    const members = body.split(',').map((m) => m.trim()).filter(Boolean);

    for (const member of members) {
      // Handle both simple and assigned values: Active = 'active' or just Active
      const match = member.match(/(\w+)(?:\s*=\s*['"]?(\w+)['"]?)?/);
      if (match) {
        const [, name, value] = match;
        values.push(value ?? name);
      }
    }

    return values;
  }
}

export const typescriptAdapter = new TypeScriptAdapter();
