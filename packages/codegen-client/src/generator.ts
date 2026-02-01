// ============================================================================
// API Client Generator
// Transforms ISL domains into type-safe API clients
// ============================================================================

import type * as AST from '@intentos/isl-core';
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
  domain: AST.Domain,
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
      const packageName = options.packageName || toSnakeCase(domain.name);
      
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
function buildClientConfig(domain: AST.Domain, options: GenerateOptions): ClientConfig {
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
        name: `${behavior.name}Input`,
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

    // Add error types
    if (behavior.output?.errors) {
      for (const error of behavior.output.errors) {
        types.push({
          name: `${behavior.name}Error${error.name}`,
          kind: 'interface',
          fields: error.fields?.map(convertFieldToDefinition) || [],
        });
      }
    }

    // Create client method
    methods.push(convertBehaviorToMethod(behavior));
  }

  // Determine class name
  const className = `${domain.name}Client`;

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
  // Handle enum types
  if (typeDecl.definition.kind === 'enum') {
    return {
      name: typeDecl.name,
      kind: 'enum',
      values: typeDecl.definition.values.map((v) => v.name),
    };
  }

  // Handle struct/object types
  if (typeDecl.definition.kind === 'struct') {
    return {
      name: typeDecl.name,
      kind: 'interface',
      fields: typeDecl.definition.fields.map(convertFieldToDefinition),
    };
  }

  // Handle alias types
  if (typeDecl.definition.kind === 'primitive' || typeDecl.definition.kind === 'reference') {
    return {
      name: typeDecl.name,
      kind: 'type',
      fields: [],
    };
  }

  return {
    name: typeDecl.name,
    kind: 'type',
    fields: [],
  };
}

/**
 * Convert ISL entity to TypeDefinition
 */
function convertEntityToType(entity: AST.Entity): TypeDefinition {
  return {
    name: entity.name,
    kind: 'interface',
    fields: entity.fields.map(convertFieldToDefinition),
  };
}

/**
 * Convert ISL field to FieldDefinition
 */
function convertFieldToDefinition(field: AST.Field): FieldDefinition {
  return {
    name: field.name,
    type: resolveTypeName(field.type),
    optional: field.optional || false,
    description: undefined, // Could extract from annotations
  };
}

/**
 * Convert behavior output to type definition
 */
function convertOutputToType(behavior: AST.Behavior): TypeDefinition | null {
  if (!behavior.output) return null;

  const successType = behavior.output.success;
  if (!successType) return null;

  // If it's a reference to an entity, don't create a new type
  if (successType.kind === 'reference') {
    return null;
  }

  return {
    name: `${behavior.name}Output`,
    kind: 'interface',
    fields: successType.kind === 'struct'
      ? successType.fields.map(convertFieldToDefinition)
      : [],
  };
}

/**
 * Convert ISL behavior to client method
 */
function convertBehaviorToMethod(behavior: AST.Behavior): ClientMethod {
  const httpMethod = inferHttpMethod(behavior);
  const path = inferApiPath(behavior);

  return {
    name: toCamelCase(behavior.name),
    httpMethod,
    path,
    description: behavior.description,
    inputType: behavior.input ? `${behavior.name}Input` : 'void',
    outputType: inferOutputType(behavior),
    errorTypes: behavior.output?.errors?.map((e) => e.name) || [],
  };
}

/**
 * Infer HTTP method from behavior
 */
function inferHttpMethod(behavior: AST.Behavior): HttpMethod {
  const name = behavior.name.toLowerCase();

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
function inferApiPath(behavior: AST.Behavior): string {
  const name = behavior.name;

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
function inferOutputType(behavior: AST.Behavior): string {
  if (!behavior.output?.success) {
    return 'void';
  }

  const success = behavior.output.success;

  if (success.kind === 'reference') {
    return success.name;
  }

  return `${behavior.name}Output`;
}

/**
 * Resolve type name from ISL type
 */
function resolveTypeName(type: AST.TypeExpression): string {
  switch (type.kind) {
    case 'primitive':
      return mapPrimitiveType(type.name);
    case 'reference':
      return type.name;
    case 'list':
      return `${resolveTypeName(type.elementType)}[]`;
    case 'map':
      return `Record<${resolveTypeName(type.keyType)}, ${resolveTypeName(type.valueType)}>`;
    case 'optional':
      return `${resolveTypeName(type.innerType)}?`;
    case 'union':
      return type.variants.map(resolveTypeName).join(' | ');
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

  lines.push('// Auto-generated by @intentos/codegen-client');
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
  lines.push('Auto-generated by @intentos/codegen-client');
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
