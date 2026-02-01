/**
 * OpenAPI to ISL Migration Source Adapter
 * 
 * Converts OpenAPI 3.x and Swagger 2.x specifications into
 * ISL-compatible extracted types and operations.
 */

import type {
  OpenAPIContract,
  OpenAPISpec,
  OpenAPISchema,
  OpenAPIOperation,
  OpenAPIParameter,
  ExtractedType,
  ExtractedOperation,
  ExtractedField,
  ExtractedError,
  SourceAdapter,
} from '../migrateTypes.js';

/**
 * OpenAPI source adapter
 */
export const openAPIAdapter: SourceAdapter<OpenAPIContract> = {
  sourceType: 'openapi',
  
  extractTypes(contract: OpenAPIContract): ExtractedType[] {
    const spec = contract.parsed ?? parseOpenAPI(contract.content);
    const types: ExtractedType[] = [];
    
    // Extract component schemas
    const schemas = spec.components?.schemas ?? {};
    for (const [name, schema] of Object.entries(schemas)) {
      types.push(schemaToExtractedType(schema, name));
    }
    
    return types;
  },
  
  extractOperations(contract: OpenAPIContract): ExtractedOperation[] {
    const spec = contract.parsed ?? parseOpenAPI(contract.content);
    const operations: ExtractedOperation[] = [];
    
    const paths = spec.paths ?? {};
    for (const [path, pathItem] of Object.entries(paths)) {
      const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;
      const pathParams = pathItem.parameters ?? [];
      
      for (const method of methods) {
        const operation = pathItem[method];
        if (operation) {
          operations.push(
            operationToExtracted(path, method, operation, pathParams)
          );
        }
      }
    }
    
    return operations;
  },
  
  parse: parseOpenAPI,
};

/**
 * Parse OpenAPI JSON/YAML content
 */
export function parseOpenAPI(content: string): OpenAPISpec {
  try {
    // Try JSON first
    return JSON.parse(content) as OpenAPISpec;
  } catch {
    // For YAML, we'd need a YAML parser - return minimal spec
    // In production, integrate js-yaml or similar
    return {
      info: {
        title: 'Unknown API',
        version: '1.0.0',
      },
    };
  }
}

/**
 * Convert OpenAPI schema to extracted type
 */
export function schemaToExtractedType(
  schema: OpenAPISchema,
  name?: string
): ExtractedType {
  // Handle $ref
  if (schema.$ref) {
    const refName = schema.$ref.split('/').pop() ?? 'Unknown';
    return {
      kind: 'reference',
      refName,
      name,
    };
  }
  
  // Handle allOf (merge schemas)
  if (schema.allOf && schema.allOf.length > 0) {
    const merged = mergeAllOf(schema.allOf);
    return schemaToExtractedType(merged, name);
  }
  
  // Handle oneOf/anyOf (union types)
  if (schema.oneOf || schema.anyOf) {
    const variants = (schema.oneOf ?? schema.anyOf ?? []);
    return {
      kind: 'union',
      name,
      unionTypes: variants.map(v => schemaToExtractedType(v)),
      nullable: schema.nullable,
    };
  }
  
  // Handle enum
  if (schema.enum) {
    return {
      kind: 'enum',
      name,
      enumValues: schema.enum,
    };
  }
  
  // Handle array
  if (schema.type === 'array') {
    return {
      kind: 'array',
      name,
      itemType: schema.items 
        ? schemaToExtractedType(schema.items) 
        : { kind: 'unknown' },
      nullable: schema.nullable,
    };
  }
  
  // Handle object
  if (schema.type === 'object' || schema.properties) {
    const properties: ExtractedField[] = [];
    const required = new Set(schema.required ?? []);
    
    for (const [propName, propSchema] of Object.entries(schema.properties ?? {})) {
      properties.push({
        name: propName,
        type: schemaToExtractedType(propSchema),
        required: required.has(propName),
        description: propSchema.description,
        defaultValue: propSchema.default,
      });
    }
    
    return {
      kind: 'object',
      name,
      properties,
      nullable: schema.nullable,
    };
  }
  
  // Handle primitives
  const primitiveType = mapOpenAPIPrimitive(schema.type, schema.format);
  if (primitiveType) {
    const constraints: Record<string, unknown> = {};
    if (schema.minimum !== undefined) constraints.min = schema.minimum;
    if (schema.maximum !== undefined) constraints.max = schema.maximum;
    if (schema.minLength !== undefined) constraints.minLength = schema.minLength;
    if (schema.maxLength !== undefined) constraints.maxLength = schema.maxLength;
    if (schema.pattern !== undefined) constraints.pattern = schema.pattern;
    
    return {
      kind: 'primitive',
      name,
      primitiveType,
      constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
      nullable: schema.nullable,
    };
  }
  
  // Unknown type
  return {
    kind: 'unknown',
    name,
  };
}

/**
 * Map OpenAPI primitive type + format to ISL-friendly type name
 */
function mapOpenAPIPrimitive(type?: string, format?: string): string | undefined {
  if (!type) return undefined;
  
  switch (type) {
    case 'string':
      switch (format) {
        case 'date-time':
        case 'date':
          return 'Timestamp';
        case 'uuid':
          return 'UUID';
        case 'duration':
          return 'Duration';
        case 'email':
        case 'uri':
        case 'hostname':
        case 'ipv4':
        case 'ipv6':
        case 'byte':
        case 'binary':
        default:
          return 'String';
      }
    case 'integer':
      return 'Int';
    case 'number':
      return 'Decimal';
    case 'boolean':
      return 'Boolean';
    default:
      return undefined;
  }
}

/**
 * Merge allOf schemas into a single schema
 */
function mergeAllOf(schemas: OpenAPISchema[]): OpenAPISchema {
  const merged: OpenAPISchema = {
    type: 'object',
    properties: {},
    required: [],
  };
  
  for (const schema of schemas) {
    if (schema.properties) {
      merged.properties = { ...merged.properties, ...schema.properties };
    }
    if (schema.required) {
      merged.required = [...(merged.required ?? []), ...schema.required];
    }
  }
  
  return merged;
}

/**
 * Convert OpenAPI operation to extracted operation
 */
function operationToExtracted(
  path: string,
  method: string,
  operation: OpenAPIOperation,
  pathParams: OpenAPIParameter[]
): ExtractedOperation {
  const allParams = [...pathParams, ...(operation.parameters ?? [])];
  
  // Extract inputs from parameters and request body
  const inputs: ExtractedField[] = [];
  
  // Path, query, header parameters
  for (const param of allParams) {
    inputs.push({
      name: param.name,
      type: param.schema 
        ? schemaToExtractedType(param.schema) 
        : { kind: 'unknown' },
      required: param.required ?? false,
      description: param.description,
      source: param.in,
    });
  }
  
  // Request body
  if (operation.requestBody?.content) {
    const jsonContent = operation.requestBody.content['application/json'];
    if (jsonContent?.schema) {
      const bodyType = schemaToExtractedType(jsonContent.schema);
      
      // If it's an object, flatten fields into inputs
      if (bodyType.kind === 'object' && bodyType.properties) {
        for (const prop of bodyType.properties) {
          inputs.push({
            ...prop,
            required: operation.requestBody.required ? prop.required : false,
            source: 'body',
          });
        }
      } else {
        // Single body parameter
        inputs.push({
          name: 'body',
          type: bodyType,
          required: operation.requestBody.required ?? false,
          source: 'body',
        });
      }
    }
  }
  
  // Extract output from successful response
  let output: ExtractedType | undefined;
  const successResponse = operation.responses?.['200'] 
    ?? operation.responses?.['201'] 
    ?? operation.responses?.['204'];
  
  if (successResponse?.content?.['application/json']?.schema) {
    output = schemaToExtractedType(successResponse.content['application/json'].schema);
  }
  
  // Extract errors from non-2xx responses
  const errors: ExtractedError[] = [];
  for (const [code, response] of Object.entries(operation.responses ?? {})) {
    const statusCode = parseInt(code, 10);
    if (statusCode >= 400) {
      const errorSchema = response.content?.['application/json']?.schema;
      errors.push({
        name: `Error${code}`,
        statusCode,
        description: response.description,
        schema: errorSchema ? schemaToExtractedType(errorSchema) : undefined,
      });
    }
  }
  
  // Generate operation name
  const name = operation.operationId 
    ?? generateOperationName(method, path);
  
  return {
    name,
    method: method.toUpperCase(),
    path,
    description: operation.summary ?? operation.description,
    inputs,
    output,
    errors,
    security: operation.security?.flatMap(s => Object.keys(s)),
    tags: operation.tags,
  };
}

/**
 * Generate operation name from method and path
 */
function generateOperationName(method: string, path: string): string {
  // Convert path like /users/{id}/posts to UsersIdPosts
  const pathPart = path
    .split('/')
    .filter(p => p && !p.startsWith('{'))
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
  
  const methodPart = method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();
  
  return `${methodPart}${pathPart}`;
}

export default openAPIAdapter;
