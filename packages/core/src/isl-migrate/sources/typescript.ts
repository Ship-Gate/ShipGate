/**
 * TypeScript to ISL Migration Source Adapter
 * 
 * Extracts type information from TypeScript interfaces and type aliases.
 * Uses regex-based parsing to avoid TypeScript compiler dependency.
 */

import type {
  TypeScriptContract,
  ExtractedType,
  ExtractedOperation,
  ExtractedField,
  SourceAdapter,
} from '../migrateTypes.js';

/**
 * TypeScript source adapter
 */
export const typescriptAdapter: SourceAdapter<TypeScriptContract> = {
  sourceType: 'typescript',
  
  extractTypes(contract: TypeScriptContract): ExtractedType[] {
    const types: ExtractedType[] = [];
    const typeNames = contract.typeNames ?? findTypeDeclarations(contract.content);
    
    for (const typeName of typeNames) {
      const parsed = extractTypeDeclaration(contract.content, typeName);
      if (parsed) {
        types.push(parsed);
      }
    }
    
    return types;
  },
  
  extractOperations(contract: TypeScriptContract): ExtractedOperation[] {
    // Extract function signatures as potential operations
    return extractFunctionSignatures(contract.content);
  },
};

/**
 * Find all exported interface and type declarations
 */
export function findTypeDeclarations(content: string): string[] {
  const names: string[] = [];
  
  // Match: export interface Name
  const interfacePattern = /export\s+interface\s+(\w+)/g;
  let match;
  while ((match = interfacePattern.exec(content)) !== null) {
    names.push(match[1]);
  }
  
  // Match: export type Name =
  const typePattern = /export\s+type\s+(\w+)\s*=/g;
  while ((match = typePattern.exec(content)) !== null) {
    names.push(match[1]);
  }
  
  return names;
}

/**
 * Extract a type declaration by name
 */
export function extractTypeDeclaration(
  content: string,
  name: string
): ExtractedType | null {
  // Try interface first
  const interfaceType = extractInterface(content, name);
  if (interfaceType) return interfaceType;
  
  // Try type alias
  const typeAlias = extractTypeAlias(content, name);
  if (typeAlias) return typeAlias;
  
  return null;
}

/**
 * Extract interface definition
 */
function extractInterface(content: string, name: string): ExtractedType | null {
  const pattern = new RegExp(
    `(?:export\\s+)?interface\\s+${name}(?:<[^>]+>)?\\s*(?:extends\\s+[^{]+)?\\{([^}]*)\\}`,
    's'
  );
  const match = pattern.exec(content);
  
  if (!match) return null;
  
  const body = match[1];
  const properties = parseInterfaceBody(body);
  
  return {
    kind: 'object',
    name,
    properties,
  };
}

/**
 * Extract type alias definition
 */
function extractTypeAlias(content: string, name: string): ExtractedType | null {
  const pattern = new RegExp(
    `(?:export\\s+)?type\\s+${name}(?:<[^>]+>)?\\s*=\\s*([^;]+)`,
    's'
  );
  const match = pattern.exec(content);
  
  if (!match) return null;
  
  const typeExpr = match[1].trim();
  return parseTypeExpression(typeExpr, name);
}

/**
 * Parse interface body into fields
 */
function parseInterfaceBody(body: string): ExtractedField[] {
  const fields: ExtractedField[] = [];
  
  // Match property declarations: name?: Type;
  // Handle multiline and various formats
  const propPattern = /(\w+)(\?)?:\s*([^;,\n]+)/g;
  let match;
  
  while ((match = propPattern.exec(body)) !== null) {
    const [, propName, optional, typeStr] = match;
    
    // Skip if it looks like a method
    if (typeStr.includes('=>') && typeStr.includes('(')) continue;
    
    fields.push({
      name: propName,
      type: parseTypeExpression(typeStr.trim()),
      required: !optional,
    });
  }
  
  return fields;
}

/**
 * Parse a TypeScript type expression
 */
function parseTypeExpression(expr: string, name?: string): ExtractedType {
  expr = expr.trim();
  
  // Handle union types: A | B | C
  if (expr.includes('|') && !expr.startsWith('{') && !expr.includes('=>')) {
    const variants = splitUnion(expr);
    if (variants.length > 1) {
      // Check if it's a nullable type (Type | null | undefined)
      const nonNullVariants = variants.filter(v => v !== 'null' && v !== 'undefined');
      const isNullable = variants.length !== nonNullVariants.length;
      
      if (nonNullVariants.length === 1) {
        const inner = parseTypeExpression(nonNullVariants[0], name);
        inner.nullable = isNullable;
        return inner;
      }
      
      return {
        kind: 'union',
        name,
        unionTypes: nonNullVariants.map(v => parseTypeExpression(v)),
        nullable: isNullable,
      };
    }
  }
  
  // Handle array types: Type[] or Array<Type>
  if (expr.endsWith('[]')) {
    const itemType = expr.slice(0, -2).trim();
    return {
      kind: 'array',
      name,
      itemType: parseTypeExpression(itemType),
    };
  }
  
  if (expr.startsWith('Array<') && expr.endsWith('>')) {
    const itemType = expr.slice(6, -1).trim();
    return {
      kind: 'array',
      name,
      itemType: parseTypeExpression(itemType),
    };
  }
  
  // Handle Record<K, V>
  if (expr.startsWith('Record<')) {
    return {
      kind: 'object',
      name,
      properties: [],
    };
  }
  
  // Handle inline object type: { ... }
  if (expr.startsWith('{') && expr.endsWith('}')) {
    const body = expr.slice(1, -1);
    return {
      kind: 'object',
      name,
      properties: parseInterfaceBody(body),
    };
  }
  
  // Handle literal types (string literals as enum-like)
  if (expr.startsWith("'") || expr.startsWith('"')) {
    const value = expr.slice(1, -1);
    return {
      kind: 'enum',
      name,
      enumValues: [value],
    };
  }
  
  // Handle primitives
  return mapTSPrimitive(expr, name);
}

/**
 * Split union type by |, respecting generics
 */
function splitUnion(expr: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  
  for (let i = 0; i < expr.length; i++) {
    const char = expr[i];
    
    if (char === '<' || char === '(' || char === '{' || char === '[') {
      depth++;
      current += char;
    } else if (char === '>' || char === ')' || char === '}' || char === ']') {
      depth--;
      current += char;
    } else if (char === '|' && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) parts.push(current.trim());
  
  return parts;
}

/**
 * Map TypeScript primitive to ISL-friendly type
 */
function mapTSPrimitive(type: string, name?: string): ExtractedType {
  const normalized = type.toLowerCase();
  
  switch (normalized) {
    case 'string':
      return { kind: 'primitive', name, primitiveType: 'String' };
    case 'number':
      return { kind: 'primitive', name, primitiveType: 'Decimal' };
    case 'boolean':
      return { kind: 'primitive', name, primitiveType: 'Boolean' };
    case 'date':
      return { kind: 'primitive', name, primitiveType: 'Timestamp' };
    case 'bigint':
      return { kind: 'primitive', name, primitiveType: 'Int' };
    case 'null':
    case 'undefined':
    case 'void':
    case 'never':
      return { kind: 'primitive', name, primitiveType: 'null', nullable: true };
    case 'any':
    case 'unknown':
      return { kind: 'unknown', name };
    default:
      // Assume it's a reference to another type
      return { kind: 'reference', name, refName: type };
  }
}

/**
 * Extract function signatures as potential operations
 */
function extractFunctionSignatures(content: string): ExtractedOperation[] {
  const operations: ExtractedOperation[] = [];
  
  // Match: export function name(params): ReturnType
  // or: export async function name(params): Promise<ReturnType>
  const funcPattern = /export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*:\s*([^{;]+)/g;
  let match;
  
  while ((match = funcPattern.exec(content)) !== null) {
    const [, funcName, paramsStr, returnType] = match;
    
    const inputs = parseParameters(paramsStr);
    let output = parseTypeExpression(returnType.trim());
    
    // Unwrap Promise<T>
    if (returnType.trim().startsWith('Promise<')) {
      const inner = returnType.trim().slice(8, -1);
      output = parseTypeExpression(inner);
    }
    
    operations.push({
      name: funcName,
      inputs,
      output,
      errors: [],
    });
  }
  
  return operations;
}

/**
 * Parse function parameters
 */
function parseParameters(paramsStr: string): ExtractedField[] {
  const params: ExtractedField[] = [];
  if (!paramsStr.trim()) return params;
  
  // Split parameters, respecting object/generic types
  const paramParts = splitParameters(paramsStr);
  
  for (const part of paramParts) {
    const colonIndex = part.indexOf(':');
    if (colonIndex === -1) continue;
    
    let paramName = part.slice(0, colonIndex).trim();
    const paramType = part.slice(colonIndex + 1).trim();
    
    // Handle optional parameters
    const isOptional = paramName.endsWith('?');
    if (isOptional) {
      paramName = paramName.slice(0, -1);
    }
    
    // Handle destructured parameters
    if (paramName.startsWith('{')) continue;
    
    params.push({
      name: paramName,
      type: parseTypeExpression(paramType),
      required: !isOptional,
    });
  }
  
  return params;
}

/**
 * Split function parameters, respecting nesting
 */
function splitParameters(paramsStr: string): string[] {
  const params: string[] = [];
  let current = '';
  let depth = 0;
  
  for (const char of paramsStr) {
    if (char === '<' || char === '(' || char === '{' || char === '[') {
      depth++;
      current += char;
    } else if (char === '>' || char === ')' || char === '}' || char === ']') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      if (current.trim()) params.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) params.push(current.trim());
  
  return params;
}

export default typescriptAdapter;
