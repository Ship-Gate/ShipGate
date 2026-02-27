// ============================================================================
// API Client Generator
// Transforms ISL domains into type-safe API clients
// ============================================================================

import type * as AST from '@isl-lang/isl-core';
import type {
  GenerateOptions,
  GeneratedFile,
  ClientConfig,
  ClientMethod,
  TypeDefinition,
  FieldDefinition,
  HttpMethod,
} from './types';
import { generateTypeScriptClient, generateTypeScriptTypes } from './languages/typescript';
import { generatePythonClient, generatePythonTypes } from './languages/python';
import { generateGoClient, generateGoTypes } from './languages/go';

/**
 * Generate API client from ISL domain
 */
export function generate(
  domain: AST.DomainDeclaration,
  options: GenerateOptions
): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const config = buildClientConfig(domain, options);

  switch (options.language) {
    case 'typescript': {
      if (options.splitFiles) {
        // Separate types file
        files.push({
          path: 'types.ts',
          content: generateTypeScriptTypes(config.types),
          language: 'typescript',
        });
        // Client file (would need to import types)
        files.push({
          path: 'client.ts',
          content: generateTypeScriptClient(config, options),
          language: 'typescript',
        });
      } else {
        files.push({
          path: 'client.ts',
          content: generateTypeScriptClient(config, options),
          language: 'typescript',
        });
      }
      
      // Generate index file
      files.push({
        path: 'index.ts',
        content: generateTypeScriptIndex(config, options),
        language: 'typescript',
      });
      break;
    }

    case 'python': {
      if (options.splitFiles) {
        files.push({
          path: 'types.py',
          content: generatePythonTypes(config.types, options.includeValidation || false),
          language: 'python',
        });
        files.push({
          path: 'client.py',
          content: generatePythonClient(config, options),
          language: 'python',
        });
      } else {
        files.push({
          path: 'client.py',
          content: generatePythonClient(config, options),
          language: 'python',
        });
      }
      
      // Generate __init__.py
      files.push({
        path: '__init__.py',
        content: generatePythonInit(config),
        language: 'python',
      });
      break;
    }

    case 'go': {
      const packageName = options.packageName || toSnakeCase(domain.name.name);
      
      if (options.splitFiles) {
        files.push({
          path: 'types.go',
          content: generateGoTypes(config.types, packageName),
          language: 'go',
        });
      }
      
      files.push({
        path: 'client.go',
        content: generateGoClient(config, { ...options, packageName }),
        language: 'go',
      });
      break;
    }

    default:
      throw new Error(`Unsupported language: ${options.language}`);
  }

  return files;
}

/**
 * Build client configuration from ISL domain
 */
function buildClientConfig(domain: AST.DomainDeclaration, options: GenerateOptions): ClientConfig {
  const types: TypeDefinition[] = [];
  const methods: ClientMethod[] = [];

  // Convert type declarations
  for (const typeDecl of domain.types || []) {
    types.push(convertTypeDeclaration(typeDecl));
  }

  // Convert entities to types
  for (const entity of domain.entities || []) {
    types.push(convertEntityToType(entity));
  }

  // Convert behaviors to client methods
  for (const behavior of domain.behaviors || []) {
    // Add input type
    if (behavior.input) {
      types.push({
        name: `${behavior.name.name}Input`,
        kind: 'interface',
        fields: behavior.input.fields.map(convertFieldToDefinition),
      });
    }

    // Add output type
    if (behavior.output) {
      const outputType = convertOutputToType(behavior);
      if (outputType) {
        types.push(outputType);
      }
    }

    // Add error types - note: ErrorDeclaration doesn't have fields
    if (behavior.output?.errors) {
      for (const error of behavior.output.errors) {
        types.push({
          name: `${behavior.name.name}Error${error.name.name}`,
          kind: 'interface',
          fields: [],
        });
      }
    }

    // Create client method
    methods.push(convertBehaviorToMethod(behavior));
  }

  // Determine class name
  const className = `${domain.name.name}Client`;

  return {
    className,
    baseUrl: options.baseUrl || '/api',
    methods,
    types,
    imports: [],
  };
}

/**
 * Convert ISL type declaration to TypeDefinition
 */
function convertTypeDeclaration(typeDecl: AST.TypeDeclaration): TypeDefinition {
  const baseType = typeDecl.baseType;

  // Handle object types (structs)
  if (baseType.kind === 'ObjectType') {
    return {
      name: typeDecl.name.name,
      kind: 'interface',
      fields: baseType.fields.map(convertFieldToDefinition),
    };
  }

  // Handle union types
  if (baseType.kind === 'UnionType') {
    return {
      name: typeDecl.name.name,
      kind: 'enum',
      values: baseType.variants.map((v) => v.name.name),
    };
  }

  // Handle alias types (simple, generic, array)
  return {
    name: typeDecl.name.name,
    kind: 'type',
    fields: [],
  };
}

/**
 * Convert ISL entity to TypeDefinition
 */
function convertEntityToType(entity: AST.EntityDeclaration): TypeDefinition {
  return {
    name: entity.name.name,
    kind: 'interface',
    fields: entity.fields.map(convertFieldToDefinition),
  };
}

/**
 * Convert ISL field to FieldDefinition
 */
function convertFieldToDefinition(field: AST.FieldDeclaration): FieldDefinition {
  return {
    name: field.name.name,
    type: resolveTypeName(field.type),
    optional: field.optional || false,
    description: undefined, // Could extract from annotations
  };
}

/**
 * Convert behavior output to type definition
 */
function convertOutputToType(behavior: AST.BehaviorDeclaration): TypeDefinition | null {
  if (!behavior.output) return null;

  const successType = behavior.output.success;
  if (!successType) return null;

  // If it's a simple type reference to an entity, don't create a new type
  if (successType.kind === 'SimpleType') {
    return null;
  }

  return {
    name: `${behavior.name.name}Output`,
    kind: 'interface',
    fields: successType.kind === 'ObjectType'
      ? successType.fields.map(convertFieldToDefinition)
      : [],
  };
}

/**
 * Convert ISL behavior to client method
 */
function convertBehaviorToMethod(behavior: AST.BehaviorDeclaration): ClientMethod {
  const httpMethod = inferHttpMethod(behavior);
  const path = inferApiPath(behavior);

  return {
    name: toCamelCase(behavior.name.name),
    httpMethod,
    path,
    description: behavior.description?.value,
    inputType: behavior.input ? `${behavior.name.name}Input` : 'void',
    outputType: inferOutputType(behavior),
    errorTypes: behavior.output?.errors?.map((e: AST.ErrorDeclaration) => e.name.name) || [],
  };
}

/**
 * Infer HTTP method from behavior
 */
function inferHttpMethod(behavior: AST.BehaviorDeclaration): HttpMethod {
  const name = behavior.name.name.toLowerCase();

  if (name.startsWith('get') || name.startsWith('list') || name.startsWith('find') || name.startsWith('search')) {
    return 'GET';
  }
  if (name.startsWith('create') || name.startsWith('add') || name.startsWith('register')) {
    return 'POST';
  }
  if (name.startsWith('update') || name.startsWith('modify') || name.startsWith('change')) {
    return 'PUT';
  }
  if (name.startsWith('patch') || name.startsWith('partial')) {
    return 'PATCH';
  }
  if (name.startsWith('delete') || name.startsWith('remove') || name.startsWith('cancel')) {
    return 'DELETE';
  }

  // Default to POST for operations
  return 'POST';
}

/**
 * Infer API path from behavior
 */
function inferApiPath(behavior: AST.BehaviorDeclaration): string {
  const name = behavior.name.name;

  // Extract resource name from behavior name
  // e.g., CreateUser -> /users, GetUserById -> /users/:id
  const match = name.match(/^(Get|Create|Update|Delete|List|Find|Search|Add|Remove)(.+)$/i);

  if (match) {
    const [, action, resource] = match;
    const resourcePath = `/${toKebabCase(resource)}s`;

    switch (action.toLowerCase()) {
      case 'get':
      case 'delete':
        return `${resourcePath}/:id`;
      case 'list':
      case 'search':
      case 'find':
        return resourcePath;
      case 'create':
      case 'add':
        return resourcePath;
      case 'update':
        return `${resourcePath}/:id`;
      default:
        return resourcePath;
    }
  }

  // Default: use behavior name as path
  return `/${toKebabCase(name)}`;
}

/**
 * Infer output type name
 */
function inferOutputType(behavior: AST.BehaviorDeclaration): string {
  if (!behavior.output?.success) {
    return 'void';
  }

  const success = behavior.output.success;

  if (success.kind === 'SimpleType') {
    return success.name.name;
  }

  return `${behavior.name.name}Output`;
}

/**
 * Resolve type name from ISL type
 */
function resolveTypeName(type: AST.TypeExpression): string {
  switch (type.kind) {
    case 'SimpleType':
      return mapPrimitiveType(type.name.name);
    case 'GenericType': {
      const typeName = type.name.name;
      // Handle common generic types
      if (typeName === 'List' || typeName === 'Array') {
        return `${resolveTypeName(type.typeArguments[0])}[]`;
      }
      if (typeName === 'Map' || typeName === 'Record') {
        return `Record<${resolveTypeName(type.typeArguments[0])}, ${resolveTypeName(type.typeArguments[1])}>`;
      }
      if (typeName === 'Optional') {
        return `${resolveTypeName(type.typeArguments[0])} | null`;
      }
      // Generic type with arguments
      const args = type.typeArguments.map(resolveTypeName).join(', ');
      return `${typeName}<${args}>`;
    }
    case 'ArrayType':
      return `${resolveTypeName(type.elementType)}[]`;
    case 'UnionType':
      return type.variants.map((v) => v.name.name).join(' | ');
    case 'ObjectType':
      // Inline object type
      return 'object';
    default:
      return 'unknown';
  }
}

/**
 * Map ISL primitive to language-agnostic type
 */
function mapPrimitiveType(name: string): string {
  const primitiveMap: Record<string, string> = {
    String: 'string',
    Int: 'number',
    Integer: 'number',
    Float: 'number',
    Double: 'number',
    Decimal: 'number',
    Boolean: 'boolean',
    Bool: 'boolean',
    UUID: 'string',
    Timestamp: 'Date',
    Date: 'Date',
    DateTime: 'Date',
    Money: 'number',
  };

  return primitiveMap[name] || name;
}

/**
 * Generate TypeScript index file
 */
function generateTypeScriptIndex(config: ClientConfig, options: GenerateOptions): string {
  const lines: string[] = [];

  lines.push('// Auto-generated by @isl-lang/codegen-client');
  lines.push('');

  if (options.splitFiles) {
    lines.push("export * from './types';");
    lines.push("export * from './client';");
  } else {
    lines.push("export * from './client';");
  }

  lines.push('');
  lines.push(`export { ${config.className} as default } from './client';`);

  return lines.join('\n');
}

/**
 * Generate Python __init__.py
 */
function generatePythonInit(config: ClientConfig): string {
  const lines: string[] = [];

  lines.push('"""');
  lines.push('Auto-generated by @isl-lang/codegen-client');
  lines.push('"""');
  lines.push('');
  lines.push(`from .client import ${config.className}`);
  lines.push('from .client import ClientOptions, ApiError, Result, Success, Failure');
  lines.push('');
  lines.push('__all__ = [');
  lines.push(`    "${config.className}",`);
  lines.push('    "ClientOptions",');
  lines.push('    "ApiError",');
  lines.push('    "Result",');
  lines.push('    "Success",');
  lines.push('    "Failure",');
  lines.push(']');

  return lines.join('\n');
}

// String utilities
function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

function toKebabCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');
}
