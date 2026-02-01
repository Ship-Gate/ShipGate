// ============================================================================
// OpenAPI Specification Generator
// ============================================================================

import type { Domain, Entity, Behavior, TypeDeclaration, DocOptions, GeneratedFile, Field } from '../types';

export function generateOpenAPI(domain: Domain, options: DocOptions): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const { outputDir } = options;

  const spec = buildOpenAPISpec(domain);

  files.push({
    path: `${outputDir}/openapi.yaml`,
    content: generateYAML(spec),
  });

  files.push({
    path: `${outputDir}/openapi.json`,
    content: JSON.stringify(spec, null, 2),
  });

  return files;
}

function buildOpenAPISpec(domain: Domain): OpenAPISpec {
  const spec: OpenAPISpec = {
    openapi: '3.1.0',
    info: {
      title: `${domain.name} API`,
      version: domain.version || '1.0.0',
      description: domain.description || `API specification for ${domain.name}`,
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Development server' },
    ],
    paths: {},
    components: {
      schemas: {},
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    tags: [],
  };

  // Add entity schemas
  for (const entity of domain.entities) {
    spec.components.schemas[entity.name] = buildEntitySchema(entity);
    spec.tags.push({
      name: entity.name,
      description: entity.description || `${entity.name} operations`,
    });

    // Add CRUD paths for entities
    const basePath = `/${toKebabCase(entity.name)}s`;
    
    // List
    spec.paths[basePath] = {
      get: {
        tags: [entity.name],
        summary: `List all ${entity.name}s`,
        operationId: `list${entity.name}s`,
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: `#/components/schemas/${entity.name}` },
                },
              },
            },
          },
        },
      },
      post: {
        tags: [entity.name],
        summary: `Create a new ${entity.name}`,
        operationId: `create${entity.name}`,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${entity.name}Input` },
            },
          },
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${entity.name}` },
              },
            },
          },
        },
      },
    };

    // Get by ID
    spec.paths[`${basePath}/{id}`] = {
      get: {
        tags: [entity.name],
        summary: `Get ${entity.name} by ID`,
        operationId: `get${entity.name}`,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${entity.name}` },
              },
            },
          },
          '404': { description: 'Not found' },
        },
      },
      put: {
        tags: [entity.name],
        summary: `Update ${entity.name}`,
        operationId: `update${entity.name}`,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${entity.name}Input` },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated',
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${entity.name}` },
              },
            },
          },
        },
      },
      delete: {
        tags: [entity.name],
        summary: `Delete ${entity.name}`,
        operationId: `delete${entity.name}`,
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '204': { description: 'Deleted' },
        },
      },
    };

    // Add input schema
    spec.components.schemas[`${entity.name}Input`] = buildInputSchema(entity);
  }

  // Add custom type schemas
  for (const type of domain.types) {
    spec.components.schemas[type.name] = buildTypeSchema(type);
  }

  // Add behavior endpoints
  for (const behavior of domain.behaviors) {
    const path = `/api/${toKebabCase(behavior.name)}`;
    
    spec.paths[path] = {
      post: {
        tags: ['Behaviors'],
        summary: behavior.description || behavior.name,
        operationId: toCamelCase(behavior.name),
        requestBody: behavior.inputs.length > 0 ? {
          required: true,
          content: {
            'application/json': {
              schema: buildBehaviorInputSchema(behavior),
            },
          },
        } : undefined,
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: buildBehaviorOutputSchema(behavior),
              },
            },
          },
          ...buildErrorResponses(behavior.errors),
        },
      },
    };
  }

  spec.tags.push({
    name: 'Behaviors',
    description: 'Domain behaviors and operations',
  });

  return spec;
}

function buildEntitySchema(entity: Entity): SchemaObject {
  const properties: Record<string, SchemaObject> = {};
  const required: string[] = [];

  for (const field of entity.fields) {
    properties[field.name] = fieldToSchema(field);
    if (!field.optional) {
      required.push(field.name);
    }
  }

  return {
    type: 'object',
    description: entity.description,
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

function buildInputSchema(entity: Entity): SchemaObject {
  const properties: Record<string, SchemaObject> = {};
  const required: string[] = [];

  for (const field of entity.fields) {
    // Skip auto-generated fields
    if (field.annotations.includes('@computed') || 
        (field.name === 'id' && field.type === 'UUID') ||
        field.name === 'createdAt' || 
        field.name === 'updatedAt') {
      continue;
    }
    properties[field.name] = fieldToSchema(field);
    if (!field.optional) {
      required.push(field.name);
    }
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

function buildTypeSchema(type: TypeDeclaration): SchemaObject {
  const baseSchema = mapISLTypeToOpenAPI(type.baseType);
  
  return {
    ...baseSchema,
    description: type.description,
    // Constraints would be added as format/pattern/etc. based on ISL constraints
  };
}

function buildBehaviorInputSchema(behavior: Behavior): SchemaObject {
  const properties: Record<string, SchemaObject> = {};
  const required: string[] = [];

  for (const input of behavior.inputs) {
    properties[input.name] = fieldToSchema(input);
    if (!input.optional) {
      required.push(input.name);
    }
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

function buildBehaviorOutputSchema(behavior: Behavior): SchemaObject {
  return mapISLTypeToOpenAPI(behavior.outputType);
}

function buildErrorResponses(errors: string[]): Record<string, ResponseObject> {
  const responses: Record<string, ResponseObject> = {};

  if (errors.length > 0) {
    responses['400'] = {
      description: 'Bad Request',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              error: { type: 'string', enum: errors },
              message: { type: 'string' },
            },
          },
        },
      },
    };
  }

  return responses;
}

function fieldToSchema(field: Field): SchemaObject {
  return mapISLTypeToOpenAPI(field.type);
}

function mapISLTypeToOpenAPI(islType: string): SchemaObject {
  // Handle generic types
  const genericMatch = islType.match(/^(\w+)<(.+)>$/);
  if (genericMatch) {
    const [, containerType, innerType] = genericMatch;
    
    switch (containerType) {
      case 'List':
        return {
          type: 'array',
          items: mapISLTypeToOpenAPI(innerType),
        };
      case 'Map':
        const [keyType, valueType] = innerType.split(',').map(s => s.trim());
        return {
          type: 'object',
          additionalProperties: mapISLTypeToOpenAPI(valueType),
        };
      case 'Optional':
        return {
          ...mapISLTypeToOpenAPI(innerType),
          nullable: true,
        };
      case 'Set':
        return {
          type: 'array',
          items: mapISLTypeToOpenAPI(innerType),
          uniqueItems: true,
        };
    }
  }

  // Primitive types
  switch (islType) {
    case 'String':
      return { type: 'string' };
    case 'Int':
      return { type: 'integer', format: 'int64' };
    case 'Boolean':
      return { type: 'boolean' };
    case 'UUID':
      return { type: 'string', format: 'uuid' };
    case 'Timestamp':
      return { type: 'string', format: 'date-time' };
    case 'Date':
      return { type: 'string', format: 'date' };
    case 'Time':
      return { type: 'string', format: 'time' };
    case 'Decimal':
      return { type: 'number', format: 'double' };
    case 'Duration':
      return { type: 'string', format: 'duration' };
    default:
      // Reference to custom type
      return { $ref: `#/components/schemas/${islType}` };
  }
}

function generateYAML(obj: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent);
  
  if (obj === null || obj === undefined) {
    return 'null';
  }
  
  if (typeof obj === 'string') {
    if (obj.includes('\n') || obj.includes(':') || obj.includes('#')) {
      return `"${obj.replace(/"/g, '\\"')}"`;
    }
    return obj;
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj.map(item => {
      const value = generateYAML(item, indent + 1);
      if (typeof item === 'object' && item !== null) {
        return `${spaces}- ${value.trimStart()}`;
      }
      return `${spaces}- ${value}`;
    }).join('\n');
  }
  
  if (typeof obj === 'object') {
    const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '{}';
    
    return entries.map(([key, value]) => {
      const valueStr = generateYAML(value, indent + 1);
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return `${spaces}${key}:\n${valueStr}`;
      }
      if (Array.isArray(value) && value.length > 0) {
        return `${spaces}${key}:\n${valueStr}`;
      }
      return `${spaces}${key}: ${valueStr}`;
    }).join('\n');
  }
  
  return String(obj);
}

function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

// Type definitions for OpenAPI
interface OpenAPISpec {
  openapi: string;
  info: { title: string; version: string; description?: string };
  servers: { url: string; description?: string }[];
  paths: Record<string, PathItem>;
  components: {
    schemas: Record<string, SchemaObject>;
    securitySchemes?: Record<string, SecurityScheme>;
  };
  tags: { name: string; description?: string }[];
}

interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  delete?: Operation;
  patch?: Operation;
}

interface Operation {
  tags?: string[];
  summary?: string;
  operationId?: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, ResponseObject>;
}

interface Parameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required?: boolean;
  schema: SchemaObject;
}

interface RequestBody {
  required?: boolean;
  content: Record<string, MediaType>;
}

interface ResponseObject {
  description: string;
  content?: Record<string, MediaType>;
}

interface MediaType {
  schema: SchemaObject;
}

interface SchemaObject {
  type?: string;
  format?: string;
  description?: string;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  items?: SchemaObject;
  additionalProperties?: SchemaObject;
  $ref?: string;
  nullable?: boolean;
  enum?: string[];
  uniqueItems?: boolean;
}

interface SecurityScheme {
  type: string;
  scheme?: string;
  bearerFormat?: string;
}
