/**
 * Zod Schema to ISL Migration Source Adapter
 * 
 * Extracts type information from Zod schema source code.
 * Uses regex-based parsing to avoid runtime Zod dependency.
 */

import type {
  ZodContract,
  ExtractedType,
  ExtractedOperation,
  ExtractedField,
  SourceAdapter,
} from '../migrateTypes.js';

/**
 * Zod source adapter
 */
export const zodAdapter: SourceAdapter<ZodContract> = {
  sourceType: 'zod',
  
  extractTypes(contract: ZodContract): ExtractedType[] {
    const types: ExtractedType[] = [];
    const exports = contract.exports ?? findZodExports(contract.content);
    
    for (const exportName of exports) {
      const schema = extractZodSchema(contract.content, exportName);
      if (schema) {
        types.push(zodSchemaToExtractedType(schema, exportName));
      }
    }
    
    return types;
  },
  
  extractOperations(_contract: ZodContract): ExtractedOperation[] {
    // Zod schemas don't directly define operations
    // Return empty - operations would come from associated route definitions
    return [];
  },
};

/**
 * Parsed Zod schema representation
 */
interface ParsedZodSchema {
  type: string;
  properties?: Record<string, ParsedZodSchema>;
  required?: string[];
  items?: ParsedZodSchema;
  values?: Array<string | number>;
  options?: ParsedZodSchema[];
  constraints?: Record<string, unknown>;
  nullable?: boolean;
  optional?: boolean;
}

/**
 * Find exported Zod schema names in source
 */
export function findZodExports(content: string): string[] {
  const exports: string[] = [];
  
  // Match: export const SchemName = z.object/z.string/etc
  const exportPattern = /export\s+const\s+(\w+)\s*=\s*z\./g;
  let match;
  
  while ((match = exportPattern.exec(content)) !== null) {
    exports.push(match[1]);
  }
  
  return exports;
}

/**
 * Extract Zod schema definition for an export name
 */
export function extractZodSchema(content: string, name: string): ParsedZodSchema | null {
  // Find the schema definition
  const startPattern = new RegExp(`(?:export\\s+)?(?:const|let)\\s+${name}\\s*=\\s*z\\.`);
  const startMatch = startPattern.exec(content);
  
  if (!startMatch) return null;
  
  const startIndex = startMatch.index + startMatch[0].length - 2; // -2 to include 'z.'
  const schemaStr = extractBalancedExpression(content, startIndex);
  
  if (!schemaStr) return null;
  
  return parseZodExpression(schemaStr);
}

/**
 * Extract balanced expression (handling nested parentheses/braces)
 */
function extractBalancedExpression(content: string, startIndex: number): string | null {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let i = startIndex;
  
  while (i < content.length) {
    const char = content[i];
    const prevChar = i > 0 ? content[i - 1] : '';
    
    // Handle strings
    if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }
    
    if (!inString) {
      if (char === '(' || char === '{' || char === '[') {
        depth++;
      } else if (char === ')' || char === '}' || char === ']') {
        depth--;
        if (depth < 0) break;
      } else if (depth === 0 && (char === ';' || char === '\n')) {
        // Check if this is the end of the statement
        const remaining = content.slice(i).trim();
        if (!remaining.startsWith('.')) {
          break;
        }
      }
    }
    
    i++;
  }
  
  return content.slice(startIndex, i).trim();
}

/**
 * Parse Zod expression string into schema representation
 */
function parseZodExpression(expr: string): ParsedZodSchema {
  expr = expr.trim();
  
  // Handle z.object({ ... })
  if (expr.startsWith('z.object(')) {
    return parseZodObject(expr);
  }
  
  // Handle z.array(...)
  if (expr.startsWith('z.array(')) {
    const inner = extractInnerContent(expr, 'z.array(');
    return {
      type: 'array',
      items: parseZodExpression(inner),
    };
  }
  
  // Handle z.enum([...])
  if (expr.startsWith('z.enum(')) {
    const values = extractEnumValues(expr);
    return {
      type: 'enum',
      values,
    };
  }
  
  // Handle z.union([...])
  if (expr.startsWith('z.union(')) {
    const options = extractUnionOptions(expr);
    return {
      type: 'union',
      options: options.map(parseZodExpression),
    };
  }
  
  // Handle primitives with potential modifiers
  const schema = parseZodPrimitive(expr);
  return applyZodModifiers(expr, schema);
}

/**
 * Parse z.object schema
 */
function parseZodObject(expr: string): ParsedZodSchema {
  const schema: ParsedZodSchema = {
    type: 'object',
    properties: {},
    required: [],
  };
  
  // Extract object body
  const bodyMatch = /z\.object\(\s*\{([\s\S]*)\}\s*\)/.exec(expr);
  if (!bodyMatch) return schema;
  
  const body = bodyMatch[1];
  
  // Parse properties (simplified regex-based parsing)
  // Match: propertyName: z.type()
  const propPattern = /(\w+)\s*:\s*(z\.[^,}]+(?:\([^)]*\))?)/g;
  let match;
  
  while ((match = propPattern.exec(body)) !== null) {
    const [, propName, propSchema] = match;
    const parsed = parseZodExpression(propSchema);
    schema.properties![propName] = parsed;
    
    if (!parsed.optional) {
      schema.required!.push(propName);
    }
  }
  
  return applyZodModifiers(expr, schema);
}

/**
 * Parse Zod primitive type
 */
function parseZodPrimitive(expr: string): ParsedZodSchema {
  // Extract the base type
  const typeMatch = /z\.(\w+)/.exec(expr);
  if (!typeMatch) return { type: 'unknown' };
  
  const zodType = typeMatch[1];
  const constraints: Record<string, unknown> = {};
  
  // Map Zod types to ISL-friendly types
  let type: string;
  switch (zodType) {
    case 'string':
      type = 'String';
      // Extract string constraints
      if (expr.includes('.min(')) {
        const minMatch = /\.min\((\d+)/.exec(expr);
        if (minMatch) constraints.minLength = parseInt(minMatch[1], 10);
      }
      if (expr.includes('.max(')) {
        const maxMatch = /\.max\((\d+)/.exec(expr);
        if (maxMatch) constraints.maxLength = parseInt(maxMatch[1], 10);
      }
      if (expr.includes('.email(')) {
        constraints.format = 'email';
      }
      if (expr.includes('.uuid(')) {
        type = 'UUID';
      }
      if (expr.includes('.url(')) {
        constraints.format = 'url';
      }
      if (expr.includes('.regex(')) {
        const regexMatch = /\.regex\(\/([^/]+)\//.exec(expr);
        if (regexMatch) constraints.pattern = regexMatch[1];
      }
      break;
    case 'number':
      type = 'Decimal';
      // Extract number constraints
      if (expr.includes('.int(')) type = 'Int';
      if (expr.includes('.min(')) {
        const minMatch = /\.min\(([+-]?\d+(?:\.\d+)?)/.exec(expr);
        if (minMatch) constraints.min = parseFloat(minMatch[1]);
      }
      if (expr.includes('.max(')) {
        const maxMatch = /\.max\(([+-]?\d+(?:\.\d+)?)/.exec(expr);
        if (maxMatch) constraints.max = parseFloat(maxMatch[1]);
      }
      if (expr.includes('.positive(')) constraints.min = 0;
      if (expr.includes('.negative(')) constraints.max = 0;
      break;
    case 'boolean':
      type = 'Boolean';
      break;
    case 'date':
      type = 'Timestamp';
      break;
    case 'bigint':
      type = 'Int';
      break;
    case 'null':
    case 'undefined':
    case 'void':
      type = 'null';
      break;
    case 'any':
    case 'unknown':
      type = 'unknown';
      break;
    default:
      type = zodType;
  }
  
  return {
    type,
    constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
  };
}

/**
 * Apply Zod modifiers like .optional(), .nullable()
 */
function applyZodModifiers(expr: string, schema: ParsedZodSchema): ParsedZodSchema {
  if (expr.includes('.optional()')) {
    schema.optional = true;
  }
  if (expr.includes('.nullable()')) {
    schema.nullable = true;
  }
  if (expr.includes('.nullish()')) {
    schema.optional = true;
    schema.nullable = true;
  }
  return schema;
}

/**
 * Extract inner content from a Zod method call
 */
function extractInnerContent(expr: string, prefix: string): string {
  const start = expr.indexOf(prefix) + prefix.length;
  let depth = 1;
  let i = start;
  
  while (i < expr.length && depth > 0) {
    if (expr[i] === '(') depth++;
    if (expr[i] === ')') depth--;
    i++;
  }
  
  return expr.slice(start, i - 1);
}

/**
 * Extract enum values from z.enum([...])
 */
function extractEnumValues(expr: string): Array<string | number> {
  const match = /z\.enum\(\s*\[([\s\S]*?)\]/.exec(expr);
  if (!match) return [];
  
  const values: Array<string | number> = [];
  const valuesStr = match[1];
  
  // Match string literals
  const stringPattern = /['"]([^'"]+)['"]/g;
  let stringMatch;
  while ((stringMatch = stringPattern.exec(valuesStr)) !== null) {
    values.push(stringMatch[1]);
  }
  
  return values;
}

/**
 * Extract union options from z.union([...])
 */
function extractUnionOptions(expr: string): string[] {
  const match = /z\.union\(\s*\[([\s\S]*?)\]\s*\)/.exec(expr);
  if (!match) return [];
  
  // Split by comma, respecting nesting
  const options: string[] = [];
  let current = '';
  let depth = 0;
  
  for (const char of match[1]) {
    if (char === '(' || char === '[' || char === '{') depth++;
    if (char === ')' || char === ']' || char === '}') depth--;
    if (char === ',' && depth === 0) {
      if (current.trim()) options.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) options.push(current.trim());
  
  return options;
}

/**
 * Convert parsed Zod schema to extracted type
 */
export function zodSchemaToExtractedType(
  schema: ParsedZodSchema,
  name?: string
): ExtractedType {
  switch (schema.type) {
    case 'object':
      return {
        kind: 'object',
        name,
        properties: Object.entries(schema.properties ?? {}).map(([propName, propSchema]) => ({
          name: propName,
          type: zodSchemaToExtractedType(propSchema),
          required: !propSchema.optional && (schema.required?.includes(propName) ?? true),
        })),
        nullable: schema.nullable,
      };
      
    case 'array':
      return {
        kind: 'array',
        name,
        itemType: schema.items ? zodSchemaToExtractedType(schema.items) : { kind: 'unknown' },
        nullable: schema.nullable,
      };
      
    case 'enum':
      return {
        kind: 'enum',
        name,
        enumValues: schema.values,
      };
      
    case 'union':
      return {
        kind: 'union',
        name,
        unionTypes: (schema.options ?? []).map(o => zodSchemaToExtractedType(o)),
        nullable: schema.nullable,
      };
      
    case 'unknown':
      return { kind: 'unknown', name };
      
    default:
      return {
        kind: 'primitive',
        name,
        primitiveType: schema.type,
        constraints: schema.constraints,
        nullable: schema.nullable,
      };
  }
}

export default zodAdapter;
