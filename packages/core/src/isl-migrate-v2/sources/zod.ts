/**
 * Zod Source Adapter
 *
 * Extracts types from Zod schema definitions via static analysis.
 * Note: This is a text-based parser, not runtime execution.
 */

import type {
  SourceAdapter,
  MigrationSource,
  ExtractedType,
  ExtractedOperation,
  ExtractedProperty,
  TypeConstraints,
} from '../types.js';

// ============================================================================
// Zod Pattern Matchers
// ============================================================================

const ZOD_PATTERNS = {
  // Schema declaration: export const UserSchema = z.object({...})
  schemaDeclaration: /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*z\.([\w.]+)\s*\(/g,

  // Object properties: name: z.string()
  objectProperty: /(\w+)\s*:\s*z\.([\w.()]+)/g,

  // Method chains: .min(1).max(100).optional()
  methodChain: /\.(min|max|length|email|url|uuid|datetime|optional|nullable|default|regex)\s*\(([^)]*)\)/g,

  // Enum: z.enum(['a', 'b', 'c'])
  enumValues: /z\.enum\s*\(\s*\[([^\]]+)\]/,

  // Union: z.union([...])
  unionTypes: /z\.union\s*\(\s*\[([^\]]+)\]/,

  // Array: z.array(z.string())
  arrayType: /z\.array\s*\(\s*(z\.\w+(?:\([^)]*\))?)/,
};

// ============================================================================
// Adapter Implementation
// ============================================================================

class ZodAdapter implements SourceAdapter {
  readonly sourceType = 'zod' as const;

  extractTypes(source: MigrationSource): ExtractedType[] {
    const types: ExtractedType[] = [];
    const content = source.content;

    // Find all schema declarations
    const declarations = this.findSchemaDeclarations(content);

    for (const decl of declarations) {
      const type = this.parseZodType(decl.zodType, decl.name, content);
      if (type) {
        types.push(type);
      }
    }

    return types;
  }

  extractOperations(_source: MigrationSource): ExtractedOperation[] {
    // Zod schemas typically define types, not operations
    // Operations would need to be inferred from usage patterns
    return [];
  }

  private findSchemaDeclarations(
    content: string
  ): Array<{ name: string; zodType: string; fullMatch: string }> {
    const declarations: Array<{ name: string; zodType: string; fullMatch: string }> = [];

    // Find all const X = z.something( patterns
    const regex = /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(z\.[\s\S]+?)(?=(?:export\s+)?(?:const|let)\s+\w+\s*=|$)/g;

    let match;
    while ((match = regex.exec(content)) !== null) {
      const [fullMatch, name, zodExpr] = match;
      declarations.push({
        name,
        zodType: zodExpr.trim(),
        fullMatch,
      });
    }

    return declarations;
  }

  private parseZodType(zodExpr: string, name?: string, _fullContent?: string): ExtractedType | null {
    const trimmed = zodExpr.trim();

    // z.object({...})
    if (trimmed.startsWith('z.object')) {
      return this.parseObjectType(trimmed, name);
    }

    // z.enum([...])
    if (trimmed.startsWith('z.enum')) {
      return this.parseEnumType(trimmed, name);
    }

    // z.union([...])
    if (trimmed.startsWith('z.union')) {
      return this.parseUnionType(trimmed, name);
    }

    // z.array(...)
    if (trimmed.startsWith('z.array')) {
      return this.parseArrayType(trimmed, name);
    }

    // Primitive types
    const primitiveMatch = trimmed.match(/^z\.(string|number|boolean|date|bigint)/);
    if (primitiveMatch) {
      return this.parsePrimitiveType(trimmed, primitiveMatch[1], name);
    }

    // Reference to another schema
    const refMatch = trimmed.match(/^(\w+Schema)/);
    if (refMatch) {
      return {
        kind: 'reference',
        name,
        refName: refMatch[1].replace(/Schema$/, ''),
      };
    }

    return {
      kind: 'unknown',
      name,
    };
  }

  private parseObjectType(zodExpr: string, name?: string): ExtractedType {
    const properties: ExtractedProperty[] = [];

    // Extract the object body between z.object({ and })
    const bodyMatch = zodExpr.match(/z\.object\s*\(\s*\{([\s\S]*)\}\s*\)/);
    if (bodyMatch) {
      const body = bodyMatch[1];

      // Parse each property
      const propRegex = /(\w+)\s*:\s*(z\.[^,}]+(?:\([^)]*\)[^,}]*)*)/g;
      let propMatch;

      while ((propMatch = propRegex.exec(body)) !== null) {
        const [, propName, propType] = propMatch;
        const type = this.parseZodType(propType);

        if (type) {
          const isOptional = propType.includes('.optional()');
          const isNullable = propType.includes('.nullable()');

          properties.push({
            name: propName,
            type: {
              ...type,
              nullable: isNullable || type.nullable,
            },
            required: !isOptional,
          });
        }
      }
    }

    return {
      kind: 'object',
      name,
      properties,
    };
  }

  private parseEnumType(zodExpr: string, name?: string): ExtractedType {
    const match = zodExpr.match(ZOD_PATTERNS.enumValues);
    if (match) {
      // Parse the enum values from ['a', 'b', 'c']
      const valuesStr = match[1];
      const values = valuesStr
        .split(',')
        .map((v) => v.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);

      return {
        kind: 'enum',
        name,
        enumValues: values,
      };
    }

    return {
      kind: 'enum',
      name,
      enumValues: [],
    };
  }

  private parseUnionType(zodExpr: string, name?: string): ExtractedType {
    // z.union([z.literal('a'), z.literal('b')])
    const match = zodExpr.match(/z\.union\s*\(\s*\[([\s\S]*?)\]\s*\)/);
    if (match) {
      const content = match[1];
      const variants: ExtractedType[] = [];

      // Simple parse of union members
      const memberRegex = /z\.(\w+)\s*\(([^)]*)\)/g;
      let memberMatch;

      while ((memberMatch = memberRegex.exec(content)) !== null) {
        const [, type, args] = memberMatch;
        if (type === 'literal') {
          variants.push({
            kind: 'primitive',
            primitiveType: 'String',
            name: args.replace(/^['"]|['"]$/g, ''),
          });
        } else {
          variants.push({
            kind: 'primitive',
            primitiveType: this.mapZodPrimitive(type),
          });
        }
      }

      return {
        kind: 'union',
        name,
        unionTypes: variants,
      };
    }

    return {
      kind: 'union',
      name,
      unionTypes: [],
    };
  }

  private parseArrayType(zodExpr: string, name?: string): ExtractedType {
    const match = zodExpr.match(/z\.array\s*\(([\s\S]*?)\)/);
    if (match) {
      const innerExpr = match[1].trim();
      const itemType = this.parseZodType(innerExpr);

      return {
        kind: 'array',
        name,
        itemType: itemType ?? { kind: 'unknown' },
      };
    }

    return {
      kind: 'array',
      name,
      itemType: { kind: 'unknown' },
    };
  }

  private parsePrimitiveType(
    zodExpr: string,
    primitive: string,
    name?: string
  ): ExtractedType {
    const constraints = this.extractConstraints(zodExpr);
    const nullable = zodExpr.includes('.nullable()');

    return {
      kind: 'primitive',
      name,
      primitiveType: this.mapZodPrimitive(primitive),
      constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
      nullable,
    };
  }

  private mapZodPrimitive(zodType: string): string {
    const map: Record<string, string> = {
      string: 'String',
      number: 'Decimal',
      boolean: 'Boolean',
      date: 'Timestamp',
      bigint: 'Int',
    };
    return map[zodType] ?? 'String';
  }

  private extractConstraints(zodExpr: string): TypeConstraints {
    const constraints: TypeConstraints = {};

    // .min(N) or .length(N)
    const minMatch = zodExpr.match(/\.min\s*\(\s*(\d+)\s*\)/);
    if (minMatch) constraints.minimum = parseInt(minMatch[1], 10);

    // .max(N)
    const maxMatch = zodExpr.match(/\.max\s*\(\s*(\d+)\s*\)/);
    if (maxMatch) constraints.maximum = parseInt(maxMatch[1], 10);

    // .length(N) for exact length
    const lengthMatch = zodExpr.match(/\.length\s*\(\s*(\d+)\s*\)/);
    if (lengthMatch) {
      const len = parseInt(lengthMatch[1], 10);
      constraints.minLength = len;
      constraints.maxLength = len;
    }

    // .email(), .url(), .uuid() are format hints
    if (zodExpr.includes('.email()')) constraints.format = 'email';
    if (zodExpr.includes('.url()')) constraints.format = 'url';
    if (zodExpr.includes('.uuid()')) constraints.format = 'uuid';
    if (zodExpr.includes('.datetime()')) constraints.format = 'datetime';

    // .regex(/pattern/)
    const regexMatch = zodExpr.match(/\.regex\s*\(\s*\/([^/]+)\/\s*\)/);
    if (regexMatch) constraints.pattern = regexMatch[1];

    return constraints;
  }
}

export const zodAdapter = new ZodAdapter();
