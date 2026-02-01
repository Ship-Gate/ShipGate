// ============================================================================
// OpenAPI 3.0 Specification Generator
// ============================================================================

import type * as AST from '../../../master_contracts/ast';

// ============================================================================
// TYPES
// ============================================================================

export interface OpenAPIOptions {
  baseUrl: string;
  title: string;
  description?: string;
  version?: string;
}

interface OpenAPISpec {
  openapi: string;
  info: OpenAPIInfo;
  servers: OpenAPIServer[];
  paths: Record<string, OpenAPIPathItem>;
  components: OpenAPIComponents;
  tags: OpenAPITag[];
}

interface OpenAPIInfo {
  title: string;
  description: string;
  version: string;
}

interface OpenAPIServer {
  url: string;
  description: string;
}

interface OpenAPIPathItem {
  post?: OpenAPIOperation;
  get?: OpenAPIOperation;
}

interface OpenAPIOperation {
  operationId: string;
  summary: string;
  description?: string;
  tags: string[];
  requestBody?: OpenAPIRequestBody;
  responses: Record<string, OpenAPIResponse>;
  security?: Array<Record<string, string[]>>;
}

interface OpenAPIRequestBody {
  required: boolean;
  content: {
    'application/json': {
      schema: OpenAPISchema;
    };
  };
}

interface OpenAPIResponse {
  description: string;
  content?: {
    'application/json': {
      schema: OpenAPISchema;
    };
  };
}

interface OpenAPISchema {
  type?: string;
  format?: string;
  description?: string;
  properties?: Record<string, OpenAPISchema>;
  required?: string[];
  items?: OpenAPISchema;
  additionalProperties?: OpenAPISchema;
  enum?: string[];
  oneOf?: OpenAPISchema[];
  $ref?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  nullable?: boolean;
}

interface OpenAPIComponents {
  schemas: Record<string, OpenAPISchema>;
  securitySchemes?: Record<string, OpenAPISecurityScheme>;
}

interface OpenAPISecurityScheme {
  type: string;
  scheme?: string;
  bearerFormat?: string;
  in?: string;
  name?: string;
}

interface OpenAPITag {
  name: string;
  description: string;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate OpenAPI 3.0 specification from an ISL domain
 */
export function generateOpenAPI(domain: AST.Domain, options: OpenAPIOptions): string {
  const spec: OpenAPISpec = {
    openapi: '3.0.3',
    info: {
      title: options.title,
      description: options.description ?? `API specification for ${domain.name.name} domain`,
      version: options.version ?? domain.version.value,
    },
    servers: [
      {
        url: options.baseUrl,
        description: 'API Server',
      },
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
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
      },
    },
    tags: [],
  };

  // Generate schemas for types
  for (const type of domain.types) {
    spec.components.schemas[type.name.name] = typeToSchema(type.definition);
  }

  // Generate schemas for entities
  for (const entity of domain.entities) {
    spec.components.schemas[entity.name.name] = entityToSchema(entity);
    spec.tags.push({
      name: entity.name.name,
      description: `Operations related to ${entity.name.name}`,
    });
  }

  // Generate paths for behaviors
  for (const behavior of domain.behaviors) {
    const path = `/${toKebabCase(behavior.name.name)}`;
    spec.paths[path] = behaviorToPathItem(behavior, domain, spec.components.schemas);
  }

  // Generate error schemas
  spec.components.schemas['Error'] = {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'Error code' },
      message: { type: 'string', description: 'Error message' },
      details: { type: 'object', description: 'Additional error details' },
    },
    required: ['code', 'message'],
  };

  return toYAML(spec);
}

// ============================================================================
// TYPE CONVERSION
// ============================================================================

function typeToSchema(def: AST.TypeDefinition): OpenAPISchema {
  switch (def.kind) {
    case 'PrimitiveType':
      return primitiveToSchema(def.name);

    case 'ConstrainedType': {
      const base = typeToSchema(def.base);
      for (const constraint of def.constraints) {
        applyConstraint(base, constraint);
      }
      return base;
    }

    case 'EnumType':
      return {
        type: 'string',
        enum: def.variants.map(v => v.name.name),
      };

    case 'StructType':
      return structToSchema(def.fields);

    case 'UnionType':
      return {
        oneOf: def.variants.map(v => ({
          type: 'object',
          properties: {
            type: { type: 'string', enum: [v.name.name] },
            ...v.fields.reduce((acc, f) => {
              acc[f.name.name] = typeToSchema(f.type);
              return acc;
            }, {} as Record<string, OpenAPISchema>),
          },
          required: ['type', ...v.fields.filter(f => !f.optional).map(f => f.name.name)],
        })),
      };

    case 'ListType':
      return {
        type: 'array',
        items: typeToSchema(def.element),
      };

    case 'MapType':
      return {
        type: 'object',
        additionalProperties: typeToSchema(def.value),
      };

    case 'OptionalType':
      return {
        ...typeToSchema(def.inner),
        nullable: true,
      };

    case 'ReferenceType':
      return {
        $ref: `#/components/schemas/${def.name.parts.map(p => p.name).join('_')}`,
      };

    default:
      return { type: 'object' };
  }
}

function primitiveToSchema(name: string): OpenAPISchema {
  switch (name) {
    case 'String':
      return { type: 'string' };
    case 'Int':
      return { type: 'integer' };
    case 'Decimal':
      return { type: 'number', format: 'double' };
    case 'Boolean':
      return { type: 'boolean' };
    case 'Timestamp':
      return { type: 'string', format: 'date-time' };
    case 'UUID':
      return { type: 'string', format: 'uuid' };
    case 'Duration':
      return { type: 'string', description: 'ISO 8601 duration' };
    default:
      return { type: 'string' };
  }
}

function applyConstraint(schema: OpenAPISchema, constraint: AST.Constraint): void {
  const value = extractConstraintValue(constraint.value);
  
  switch (constraint.name) {
    case 'min':
    case 'minimum':
      if (schema.type === 'integer' || schema.type === 'number') {
        schema.minimum = value as number;
      } else if (schema.type === 'string') {
        schema.minLength = value as number;
      }
      break;
    case 'max':
    case 'maximum':
      if (schema.type === 'integer' || schema.type === 'number') {
        schema.maximum = value as number;
      } else if (schema.type === 'string') {
        schema.maxLength = value as number;
      }
      break;
    case 'min_length':
    case 'minLength':
      schema.minLength = value as number;
      break;
    case 'max_length':
    case 'maxLength':
      schema.maxLength = value as number;
      break;
    case 'length':
      schema.minLength = value as number;
      schema.maxLength = value as number;
      break;
    case 'pattern':
    case 'format':
      if (typeof value === 'string') {
        schema.pattern = value;
      }
      break;
    case 'precision':
      schema.description = `Precision: ${value} decimal places`;
      break;
  }
}

function extractConstraintValue(expr: AST.Expression): unknown {
  switch (expr.kind) {
    case 'NumberLiteral':
      return expr.value;
    case 'StringLiteral':
      return expr.value;
    case 'BooleanLiteral':
      return expr.value;
    case 'RegexLiteral':
      return expr.pattern;
    default:
      return null;
  }
}

function structToSchema(fields: AST.Field[]): OpenAPISchema {
  const properties: Record<string, OpenAPISchema> = {};
  const required: string[] = [];

  for (const field of fields) {
    properties[field.name.name] = typeToSchema(field.type);
    if (!field.optional) {
      required.push(field.name.name);
    }
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

// ============================================================================
// ENTITY CONVERSION
// ============================================================================

function entityToSchema(entity: AST.Entity): OpenAPISchema {
  const properties: Record<string, OpenAPISchema> = {};
  const required: string[] = [];

  for (const field of entity.fields) {
    const schema = typeToSchema(field.type);
    
    // Add annotation info to description
    const annotations = field.annotations.map(a => a.name.name);
    if (annotations.length > 0) {
      schema.description = `Modifiers: ${annotations.join(', ')}`;
    }
    
    properties[field.name.name] = schema;
    if (!field.optional) {
      required.push(field.name.name);
    }
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

// ============================================================================
// BEHAVIOR CONVERSION
// ============================================================================

function behaviorToPathItem(
  behavior: AST.Behavior,
  domain: AST.Domain,
  schemas: Record<string, OpenAPISchema>
): OpenAPIPathItem {
  const name = behavior.name.name;
  const description = behavior.description?.value ?? `${name} operation`;

  // Generate request body schema
  const requestSchemaName = `${name}Request`;
  schemas[requestSchemaName] = structToSchema(behavior.input.fields);

  // Generate response schema
  const responseSchemaName = `${name}Response`;
  schemas[responseSchemaName] = typeToSchema(behavior.output.success);

  // Build responses
  const responses: Record<string, OpenAPIResponse> = {
    '200': {
      description: 'Successful operation',
      content: {
        'application/json': {
          schema: { $ref: `#/components/schemas/${responseSchemaName}` },
        },
      },
    },
  };

  // Add error responses
  for (const error of behavior.output.errors) {
    const errorCode = getHttpStatusForError(error.name.name);
    const errorDescription = error.when?.value ?? `${error.name.name} error`;
    
    if (!responses[errorCode]) {
      responses[errorCode] = {
        description: errorDescription,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                error: { type: 'string', enum: [error.name.name] },
                message: { type: 'string' },
                retriable: { type: 'boolean', description: error.retriable ? 'This error can be retried' : 'This error cannot be retried' },
              },
              required: ['error', 'message'],
            },
          },
        },
      };
    }
  }

  // Determine security requirements
  const security = getSecurityRequirements(behavior);

  // Find related entity for tags
  const relatedEntities = findRelatedEntities(behavior, domain);
  const tags = relatedEntities.length > 0 ? relatedEntities : [domain.name.name];

  const operation: OpenAPIOperation = {
    operationId: toCamelCase(name),
    summary: description,
    description: generateOperationDescription(behavior),
    tags,
    requestBody: behavior.input.fields.length > 0
      ? {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${requestSchemaName}` },
            },
          },
        }
      : undefined,
    responses,
  };

  if (security.length > 0) {
    operation.security = security;
  }

  return { post: operation };
}

function getHttpStatusForError(errorName: string): string {
  const name = errorName.toUpperCase();
  
  if (name.includes('NOT_FOUND') || name.includes('NOTFOUND')) return '404';
  if (name.includes('UNAUTHORIZED') || name.includes('INVALID_CREDENTIALS')) return '401';
  if (name.includes('FORBIDDEN') || name.includes('SUSPENDED')) return '403';
  if (name.includes('CONFLICT') || name.includes('DUPLICATE')) return '409';
  if (name.includes('RATE_LIMIT') || name.includes('LOCKED')) return '429';
  if (name.includes('VALIDATION') || name.includes('INVALID')) return '400';
  if (name.includes('INSUFFICIENT') || name.includes('UNAVAILABLE')) return '422';
  
  return '400';
}

function getSecurityRequirements(behavior: AST.Behavior): Array<Record<string, string[]>> {
  const requirements: Array<Record<string, string[]>> = [];

  // Check if behavior requires authentication
  const requiresAuth = behavior.actors?.some(a => 
    a.constraints.some(c => {
      if (c.kind === 'Identifier') return c.name === 'authenticated';
      return false;
    })
  );

  if (requiresAuth) {
    requirements.push({ bearerAuth: [] });
  }

  // Check security specs
  for (const sec of behavior.security) {
    if (sec.type === 'requires') {
      requirements.push({ bearerAuth: [] });
      break;
    }
  }

  return requirements;
}

function findRelatedEntities(behavior: AST.Behavior, domain: AST.Domain): string[] {
  const entities: Set<string> = new Set();
  
  // Check output type
  const outputTypeName = getTypeName(behavior.output.success);
  if (domain.entities.some(e => e.name.name === outputTypeName)) {
    entities.add(outputTypeName);
  }

  return [...entities];
}

function getTypeName(def: AST.TypeDefinition): string {
  switch (def.kind) {
    case 'ReferenceType':
      return def.name.parts[def.name.parts.length - 1].name;
    case 'ListType':
      return getTypeName(def.element);
    default:
      return '';
  }
}

function generateOperationDescription(behavior: AST.Behavior): string {
  const lines: string[] = [];

  if (behavior.description) {
    lines.push(behavior.description.value);
    lines.push('');
  }

  if (behavior.preconditions.length > 0) {
    lines.push('**Preconditions:**');
    for (const pre of behavior.preconditions) {
      lines.push(`- ${formatExprSimple(pre)}`);
    }
    lines.push('');
  }

  if (behavior.temporal.length > 0) {
    lines.push('**Performance:**');
    for (const spec of behavior.temporal) {
      if (spec.duration) {
        lines.push(`- ${spec.operator} ${spec.duration.value}${spec.duration.unit}`);
      }
    }
  }

  return lines.join('\n');
}

function formatExprSimple(expr: AST.Expression): string {
  switch (expr.kind) {
    case 'Identifier':
      return expr.name;
    case 'QualifiedName':
      return expr.parts.map(p => p.name).join('.');
    case 'MemberExpr':
      return `${formatExprSimple(expr.object)}.${expr.property.name}`;
    case 'CallExpr':
      return `${formatExprSimple(expr.callee)}(...)`;
    case 'BinaryExpr':
      return `${formatExprSimple(expr.left)} ${expr.operator} ${formatExprSimple(expr.right)}`;
    default:
      return '...';
  }
}

// ============================================================================
// YAML SERIALIZATION
// ============================================================================

function toYAML(obj: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent);
  
  if (obj === null || obj === undefined) {
    return 'null';
  }
  
  if (typeof obj === 'string') {
    // Check if string needs quoting
    if (
      obj.includes('\n') ||
      obj.includes(':') ||
      obj.includes('#') ||
      obj.startsWith(' ') ||
      obj.endsWith(' ') ||
      obj === ''
    ) {
      return `"${obj.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
    }
    return obj;
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    
    // Check if simple array of strings/numbers
    if (obj.every(item => typeof item === 'string' || typeof item === 'number')) {
      return `[${obj.map(item => typeof item === 'string' ? `"${item}"` : item).join(', ')}]`;
    }
    
    return obj.map(item => {
      const itemYaml = toYAML(item, indent + 1);
      if (typeof item === 'object' && item !== null) {
        const firstLine = itemYaml.split('\n')[0];
        const rest = itemYaml.split('\n').slice(1).join('\n');
        return `${spaces}- ${firstLine}${rest ? '\n' + rest : ''}`;
      }
      return `${spaces}- ${itemYaml}`;
    }).join('\n');
  }
  
  if (typeof obj === 'object') {
    const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '{}';
    
    return entries.map(([key, value]) => {
      const valueYaml = toYAML(value, indent + 1);
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return `${spaces}${key}:\n${valueYaml}`;
      }
      
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
        return `${spaces}${key}:\n${valueYaml}`;
      }
      
      return `${spaces}${key}: ${valueYaml}`;
    }).join('\n');
  }
  
  return String(obj);
}

// ============================================================================
// HELPERS
// ============================================================================

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}
