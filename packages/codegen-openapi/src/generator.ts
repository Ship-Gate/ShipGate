// ============================================================================
// OpenAPI Generator
// Transforms ISL domains into OpenAPI 3.1 specifications
// ============================================================================

import * as YAML from 'yaml';
import type {
  GenerateOptions,
  GeneratedFile,
  OpenAPISpec,
  OpenAPIPathItem,
  OpenAPIOperation,
  OpenAPIParameter,
  OpenAPIRequestBody,
  OpenAPIResponse,
  OpenAPISchema,
  OpenAPIComponents,
  OpenAPISecurityScheme,
  OpenAPITag,
} from './types';

// Simplified ISL AST types for this generator
// These are compatible with both the old and new AST structures
interface Domain {
  name: string;
  version: string;
  entities?: Entity[];
  types?: TypeDeclaration[];
  behaviors?: Behavior[];
  scenarios?: unknown[];
  policies?: unknown[];
  annotations?: unknown[];
}

interface Entity {
  name: string;
  fields: Field[];
  invariants?: unknown[];
  annotations?: Annotation[];
}

interface TypeDeclaration {
  name: string;
  definition?: {
    kind: 'enum' | 'struct' | 'primitive';
    name?: string;
    values?: { name: string }[];
    fields?: Field[];
  };
  // New AST structure
  baseType?: TypeExpression;
  constraints?: TypeConstraint[];
  annotations?: Annotation[];
}

interface Field {
  name: string;
  type: TypeExpression;
  optional: boolean;
  annotations?: Annotation[];
  constraints?: TypeConstraint[];
}

interface TypeConstraint {
  kind?: string;
  name?: string | { name: string };
  value?: unknown;
}

interface Annotation {
  name: string | { name: string };
  value?: unknown;
}

interface Behavior {
  name: string;
  description?: string;
  input?: {
    fields: Field[];
  };
  output?: {
    success?: TypeExpression;
    errors?: ErrorDefinition[];
  };
  preconditions?: unknown[];
  postconditions?: unknown[];
  annotations?: Annotation[];
}

interface ErrorDefinition {
  name: string | { name: string };
  fields?: Field[];
  when?: string;
  retriable?: boolean;
}

type TypeExpression =
  | { kind: 'primitive'; name: string }
  | { kind: 'reference'; name: string }
  | { kind: 'list'; elementType: TypeExpression }
  | { kind: 'map'; keyType?: TypeExpression; valueType: TypeExpression }
  | { kind: 'optional'; innerType: TypeExpression }
  | { kind: 'union'; variants: TypeExpression[] }
  | { kind: 'SimpleType'; name: string | { name: string } }
  | { kind: 'GenericType'; name: string | { name: string }; typeArguments: TypeExpression[] }
  | { kind: 'ObjectType'; fields: Field[] };

/**
 * Generate OpenAPI specification from ISL domain
 */
export function generate(
  domain: Domain,
  options: GenerateOptions = {}
): GeneratedFile[] {
  const spec = buildOpenAPISpec(domain, options);
  const format = options.format || 'yaml';

  const content =
    format === 'json'
      ? JSON.stringify(spec, null, 2)
      : YAML.stringify(spec, { lineWidth: 0 });

  return [
    {
      path: `openapi.${format}`,
      content,
      format,
    },
  ];
}

/**
 * Build OpenAPI specification from ISL domain
 */
function buildOpenAPISpec(domain: Domain, options: GenerateOptions): OpenAPISpec {
  const version = options.version || '3.1';
  const basePath = options.basePath || '';

  const spec: OpenAPISpec = {
    openapi: version === '3.1' ? '3.1.0' : '3.0.3',
    info: {
      title: `${domain.name} API`,
      description: `API generated from ISL domain: ${domain.name}`,
      version: domain.version,
    },
    paths: {},
    components: {
      schemas: {},
      responses: {},
      securitySchemes: {},
    },
    tags: [],
  };

  // Add servers
  if (options.servers && options.servers.length > 0) {
    spec.servers = options.servers.map((s) => ({
      url: s.url,
      description: s.description,
      variables: s.variables,
    }));
  }

  // Add security schemes
  if (options.auth && options.auth.length > 0) {
    for (const auth of options.auth) {
      spec.components!.securitySchemes![auth.name] = buildSecurityScheme(auth);
    }
    // Apply security globally
    spec.security = options.auth.map((a) => ({ [a.name]: [] }));
  }

  // Generate schemas from types and entities
  const schemas = spec.components!.schemas!;

  for (const typeDecl of domain.types || []) {
    const typeName = typeof typeDecl.name === 'string' ? typeDecl.name : (typeDecl.name as { name: string }).name;
    schemas[typeName] = buildSchemaFromType(typeDecl, options);
  }

  for (const entity of domain.entities || []) {
    const entityName = typeof entity.name === 'string' ? entity.name : (entity.name as { name: string }).name;
    schemas[entityName] = buildSchemaFromEntity(entity, options);
  }

  // Generate paths from behaviors
  for (const behavior of domain.behaviors || []) {
    const { path, method, operation } = buildOperationFromBehavior(
      behavior,
      domain,
      basePath,
      options
    );

    if (!spec.paths[path]) {
      spec.paths[path] = {};
    }

    (spec.paths[path] as Record<string, OpenAPIOperation>)[method] = operation;

    // Add input schema if exists
    if (behavior.input) {
      schemas[`${behavior.name}Input`] = buildInputSchema(behavior, options);
    }

    // Add output schema if exists
    if (behavior.output?.success) {
      const outputSchema = buildOutputSchema(behavior, options);
      if (outputSchema) {
        schemas[`${behavior.name}Output`] = outputSchema;
      }
    }

    // Add error schemas
    if (behavior.output?.errors) {
      for (const error of behavior.output.errors) {
        const errorName = typeof error.name === 'string' ? error.name : error.name.name;
        schemas[`${behavior.name}Error${errorName}`] = buildErrorSchema(error, options);
      }
    }
  }

  // Build tags from entities
  spec.tags = buildTags(domain);

  // Add standard error responses
  spec.components!.responses = {
    BadRequest: {
      description: 'Bad request - validation error',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
        },
      },
    },
    Unauthorized: {
      description: 'Authentication required',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
        },
      },
    },
    Forbidden: {
      description: 'Permission denied',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
        },
      },
    },
    NotFound: {
      description: 'Resource not found',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
        },
      },
    },
    InternalError: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponse' },
        },
      },
    },
  };

  // Add ErrorResponse schema
  schemas['ErrorResponse'] = {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'Error code' },
      message: { type: 'string', description: 'Error message' },
      details: {
        type: 'object',
        additionalProperties: true,
        description: 'Additional error details',
      },
    },
    required: ['code', 'message'],
  };

  return spec;
}

/**
 * Build security scheme from auth config
 */
function buildSecurityScheme(auth: NonNullable<GenerateOptions['auth']>[0]): OpenAPISecurityScheme {
  switch (auth.type) {
    case 'apiKey':
      return {
        type: 'apiKey',
        name: auth.name,
        in: auth.in || 'header',
      };
    case 'http':
      return {
        type: 'http',
        scheme: auth.scheme || 'bearer',
        bearerFormat: auth.scheme === 'bearer' ? 'JWT' : undefined,
      };
    case 'oauth2':
      return {
        type: 'oauth2',
        flows: auth.flows
          ? {
              authorizationCode: auth.flows.authorizationCode
                ? {
                    authorizationUrl: auth.flows.authorizationCode.authorizationUrl,
                    tokenUrl: auth.flows.authorizationCode.tokenUrl,
                    scopes: auth.flows.authorizationCode.scopes,
                  }
                : undefined,
              clientCredentials: auth.flows.clientCredentials
                ? {
                    tokenUrl: auth.flows.clientCredentials.tokenUrl,
                    scopes: auth.flows.clientCredentials.scopes,
                  }
                : undefined,
            }
          : undefined,
      };
    case 'openIdConnect':
      return {
        type: 'openIdConnect',
        openIdConnectUrl: auth.openIdConnectUrl,
      };
    default:
      return { type: 'apiKey', in: 'header' };
  }
}

/**
 * Build schema from ISL type declaration
 */
function buildSchemaFromType(typeDecl: TypeDeclaration, options: GenerateOptions): OpenAPISchema {
  const typeName = typeof typeDecl.name === 'string' ? typeDecl.name : (typeDecl.name as { name: string }).name;
  const schema: OpenAPISchema = {
    title: typeName,
  };

  // Handle old-style definition
  if (typeDecl.definition) {
    if (typeDecl.definition.kind === 'enum') {
      schema.type = 'string';
      schema.enum = typeDecl.definition.values?.map((v) => v.name) || [];
    } else if (typeDecl.definition.kind === 'struct') {
      schema.type = 'object';
      schema.properties = {};
      schema.required = [];

      for (const field of typeDecl.definition.fields || []) {
        const fieldSchema = buildSchemaFromTypeExpr(field.type, options);
        // Apply field-level constraints
        if (field.constraints) {
          applyTypeConstraints(fieldSchema, field.constraints);
        }
        schema.properties[field.name] = fieldSchema;
        if (!field.optional) {
          schema.required.push(field.name);
        }
      }
    } else if (typeDecl.definition.kind === 'primitive') {
      Object.assign(schema, mapPrimitiveToSchema(typeDecl.definition.name || ''));
    }
  }

  // Handle new-style AST with baseType
  if (typeDecl.baseType) {
    const baseSchema = buildSchemaFromTypeExpr(typeDecl.baseType, options);
    Object.assign(schema, baseSchema);
  }

  // Apply constraints (handle both old and new format)
  if (typeDecl.constraints) {
    applyTypeConstraints(schema, typeDecl.constraints);
  }

  return schema;
}

/**
 * Build schema from ISL entity
 */
function buildSchemaFromEntity(entity: Entity, options: GenerateOptions): OpenAPISchema {
  const entityName = typeof entity.name === 'string' ? entity.name : (entity.name as { name: string }).name;
  const schema: OpenAPISchema = {
    type: 'object',
    title: entityName,
    properties: {},
    required: [],
  };

  for (const field of entity.fields) {
    const fieldName = typeof field.name === 'string' ? field.name : (field.name as { name: string }).name;
    const fieldSchema = buildSchemaFromTypeExpr(field.type, options);

    // Handle annotations
    for (const annotation of field.annotations || []) {
      const annotationName = typeof annotation.name === 'string' 
        ? annotation.name 
        : annotation.name.name;
      if (annotationName === 'immutable') {
        fieldSchema.readOnly = true;
      }
      if (annotationName === 'sensitive' || annotationName === 'secret') {
        fieldSchema.writeOnly = true;
      }
      if (annotationName === 'unique') {
        fieldSchema.description = (fieldSchema.description || '') + ' Must be unique.';
      }
    }

    // Apply field-level constraints
    if (field.constraints) {
      applyTypeConstraints(fieldSchema, field.constraints);
    }

    schema.properties![fieldName] = fieldSchema;

    if (!field.optional) {
      schema.required!.push(fieldName);
    }
  }

  return schema;
}

/**
 * Build schema from ISL type expression
 */
function buildSchemaFromTypeExpr(type: TypeExpression, options: GenerateOptions): OpenAPISchema {
  switch (type.kind) {
    case 'primitive':
      return mapPrimitiveToSchema(type.name);

    case 'reference':
      return { $ref: `#/components/schemas/${type.name}` };

    case 'SimpleType': {
      const name = typeof type.name === 'string' ? type.name : type.name.name;
      // Check if it's a primitive
      const primitiveSchema = mapPrimitiveToSchema(name);
      if (primitiveSchema.type !== 'string' || primitiveSchema.format) {
        return primitiveSchema;
      }
      // Assume it's a reference
      return { $ref: `#/components/schemas/${name}` };
    }

    case 'GenericType': {
      const name = typeof type.name === 'string' ? type.name : type.name.name;
      if (name === 'List' || name === 'Array') {
        return {
          type: 'array',
          items: type.typeArguments[0] 
            ? buildSchemaFromTypeExpr(type.typeArguments[0], options)
            : { type: 'object' },
        };
      }
      if (name === 'Map') {
        return {
          type: 'object',
          additionalProperties: type.typeArguments[1]
            ? buildSchemaFromTypeExpr(type.typeArguments[1], options)
            : { type: 'string' },
        };
      }
      if (name === 'Optional') {
        const innerSchema = type.typeArguments[0]
          ? buildSchemaFromTypeExpr(type.typeArguments[0], options)
          : { type: 'object' };
        if (options.version === '3.1') {
          if (innerSchema.type && !innerSchema.$ref) {
            return { ...innerSchema, type: [innerSchema.type as string, 'null'] };
          }
          return { oneOf: [innerSchema, { type: 'null' }] };
        }
        return { ...innerSchema, nullable: true };
      }
      return { $ref: `#/components/schemas/${name}` };
    }

    case 'ObjectType': {
      const schema: OpenAPISchema = {
        type: 'object',
        properties: {},
        required: [],
      };
      for (const field of type.fields || []) {
        const fieldName = typeof field.name === 'string' ? field.name : (field.name as { name: string }).name;
        const fieldSchema = buildSchemaFromTypeExpr(field.type, options);
        if (field.constraints) {
          applyTypeConstraints(fieldSchema, field.constraints);
        }
        schema.properties![fieldName] = fieldSchema;
        if (!field.optional) {
          schema.required!.push(fieldName);
        }
      }
      return schema;
    }

    case 'list':
      return {
        type: 'array',
        items: buildSchemaFromTypeExpr(type.elementType, options),
      };

    case 'map':
      return {
        type: 'object',
        additionalProperties: buildSchemaFromTypeExpr(type.valueType, options),
      };

    case 'optional': {
      const innerSchema = buildSchemaFromTypeExpr(type.innerType, options);
      if (options.version === '3.1') {
        // OpenAPI 3.1 uses JSON Schema's type array
        if (innerSchema.type && !innerSchema.$ref) {
          return { ...innerSchema, type: [innerSchema.type as string, 'null'] };
        }
        return { oneOf: [innerSchema, { type: 'null' }] };
      } else {
        // OpenAPI 3.0 uses nullable
        return { ...innerSchema, nullable: true };
      }
    }

    case 'union':
      return {
        oneOf: type.variants.map((v) => buildSchemaFromTypeExpr(v, options)),
      };

    default:
      return { type: 'object' };
  }
}

/**
 * Map ISL primitive type to OpenAPI schema
 */
function mapPrimitiveToSchema(name: string): OpenAPISchema {
  const primitiveMap: Record<string, OpenAPISchema> = {
    String: { type: 'string' },
    Int: { type: 'integer' },
    Integer: { type: 'integer' },
    Float: { type: 'number', format: 'float' },
    Double: { type: 'number', format: 'double' },
    Decimal: { type: 'number' },
    Boolean: { type: 'boolean' },
    Bool: { type: 'boolean' },
    UUID: { type: 'string', format: 'uuid' },
    Timestamp: { type: 'string', format: 'date-time' },
    Date: { type: 'string', format: 'date' },
    DateTime: { type: 'string', format: 'date-time' },
    Money: { type: 'number', description: 'Monetary value' },
    Email: { type: 'string', format: 'email' },
    URL: { type: 'string', format: 'uri' },
    Phone: { type: 'string' },
  };

  return primitiveMap[name] || { type: 'string' };
}

/**
 * Apply ISL constraints to OpenAPI schema (legacy format)
 */
function applyConstraints(schema: OpenAPISchema, constraints: { kind: string; value: unknown }[]): void {
  for (const constraint of constraints) {
    switch (constraint.kind) {
      case 'min':
        schema.minimum = constraint.value as number;
        break;
      case 'max':
        schema.maximum = constraint.value as number;
        break;
      case 'minLength':
        schema.minLength = constraint.value as number;
        break;
      case 'maxLength':
        schema.maxLength = constraint.value as number;
        break;
      case 'pattern':
        if (constraint.value instanceof RegExp) {
          schema.pattern = constraint.value.source;
        } else if (typeof constraint.value === 'string') {
          schema.pattern = constraint.value;
        }
        break;
      case 'format':
        if (constraint.value instanceof RegExp) {
          schema.pattern = constraint.value.source;
        } else if (typeof constraint.value === 'string') {
          schema.format = constraint.value;
        }
        break;
    }
  }
}

/**
 * Apply TypeConstraint objects to OpenAPI schema (new AST format)
 */
function applyTypeConstraints(schema: OpenAPISchema, constraints: TypeConstraint[]): void {
  for (const constraint of constraints) {
    // Handle new AST format with name as object or string
    const constraintName = constraint.name 
      ? (typeof constraint.name === 'string' ? constraint.name : constraint.name.name)
      : constraint.kind;
    
    // Extract value - handle NumberLiteral, StringLiteral, etc.
    let value = constraint.value;
    if (value && typeof value === 'object' && 'value' in value) {
      value = (value as { value: unknown }).value;
    }
    
    switch (constraintName?.toLowerCase()) {
      case 'min':
        if (typeof value === 'number') {
          schema.minimum = value;
        }
        break;
      case 'max':
        if (typeof value === 'number') {
          schema.maximum = value;
        }
        break;
      case 'min_length':
      case 'minlength':
        if (typeof value === 'number') {
          schema.minLength = value;
        }
        break;
      case 'max_length':
      case 'maxlength':
        if (typeof value === 'number') {
          schema.maxLength = value;
        }
        break;
      case 'pattern':
        if (typeof value === 'string') {
          schema.pattern = value;
        } else if (value instanceof RegExp) {
          schema.pattern = value.source;
        }
        break;
      case 'format':
        if (typeof value === 'string') {
          schema.format = value;
          // Also map common formats to patterns if needed
          if (value === 'email') {
            schema.format = 'email';
          } else if (value === 'uri' || value === 'url') {
            schema.format = 'uri';
          } else if (value === 'uuid') {
            schema.format = 'uuid';
          }
        }
        break;
      case 'precision':
        // Decimal precision doesn't map directly to OpenAPI, add to description
        if (typeof value === 'number') {
          schema.description = (schema.description || '') + ` Decimal precision: ${value}.`;
        }
        break;
      case 'unique':
        schema.description = (schema.description || '') + ' Must be unique.';
        break;
      case 'immutable':
        schema.readOnly = true;
        break;
    }
  }
}

/**
 * Build operation from ISL behavior
 */
function buildOperationFromBehavior(
  behavior: Behavior,
  domain: Domain,
  basePath: string,
  options: GenerateOptions
): { path: string; method: string; operation: OpenAPIOperation } {
  const httpMethod = inferHttpMethod(behavior.name).toLowerCase();
  const path = basePath + inferPath(behavior.name);

  const operation: OpenAPIOperation = {
    operationId: toCamelCase(behavior.name),
    summary: behavior.description || behavior.name,
    tags: [inferTag(behavior.name, domain)],
    responses: {},
  };

  // Add parameters for GET/DELETE with path params
  if (httpMethod === 'get' || httpMethod === 'delete') {
    operation.parameters = extractPathParameters(path, behavior, options);
  }

  // Add request body for POST/PUT/PATCH
  if (
    (httpMethod === 'post' || httpMethod === 'put' || httpMethod === 'patch') &&
    behavior.input
  ) {
    operation.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: `#/components/schemas/${behavior.name}Input` },
        },
      },
    };
  }

  // Add query parameters for GET with complex input
  if (httpMethod === 'get' && behavior.input) {
    const queryParams = extractQueryParameters(behavior, options);
    operation.parameters = [...(operation.parameters || []), ...queryParams];
  }

  // Success response
  if (behavior.output?.success) {
    const successSchema = buildSuccessResponseSchema(behavior, options);
    operation.responses['200'] = {
      description: 'Successful response',
      content: {
        'application/json': {
          schema: successSchema,
        },
      },
    };
  } else {
    operation.responses['204'] = {
      description: 'No content',
    };
  }

  // Error responses
  if (behavior.output?.errors) {
    for (const error of behavior.output.errors) {
      const errorName = typeof error.name === 'string' ? error.name : error.name.name;
      const statusCode = inferErrorStatusCode(errorName);
      operation.responses[statusCode] = {
        description: errorName.replace(/_/g, ' '),
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${behavior.name}Error${errorName}` },
          },
        },
      };
    }
  }

  // Standard error responses
  operation.responses['400'] = { $ref: '#/components/responses/BadRequest' };
  operation.responses['401'] = { $ref: '#/components/responses/Unauthorized' };
  operation.responses['500'] = { $ref: '#/components/responses/InternalError' };

  return { path, method: httpMethod, operation };
}

/**
 * Build input schema from behavior
 */
function buildInputSchema(behavior: Behavior, options: GenerateOptions): OpenAPISchema {
  if (!behavior.input) {
    return { type: 'object' };
  }

  const schema: OpenAPISchema = {
    type: 'object',
    title: `${behavior.name}Input`,
    properties: {},
    required: [],
  };

  for (const field of behavior.input.fields) {
    const fieldName = typeof field.name === 'string' ? field.name : (field.name as { name: string }).name;
    const fieldSchema = buildSchemaFromTypeExpr(field.type, options);
    
    // Apply field-level constraints
    if (field.constraints) {
      applyTypeConstraints(fieldSchema, field.constraints);
    }
    
    // Handle annotations
    for (const annotation of field.annotations || []) {
      const annotationName = typeof annotation.name === 'string' 
        ? annotation.name 
        : annotation.name.name;
      if (annotationName === 'sensitive' || annotationName === 'secret') {
        fieldSchema.writeOnly = true;
      }
    }
    
    schema.properties![fieldName] = fieldSchema;
    if (!field.optional) {
      schema.required!.push(fieldName);
    }
  }

  return schema;
}

/**
 * Build output schema from behavior
 */
function buildOutputSchema(behavior: Behavior, options: GenerateOptions): OpenAPISchema | null {
  if (!behavior.output?.success) {
    return null;
  }

  return buildSchemaFromTypeExpr(behavior.output.success, options);
}

/**
 * Build success response schema
 */
function buildSuccessResponseSchema(behavior: Behavior, options: GenerateOptions): OpenAPISchema {
  if (!behavior.output?.success) {
    return { type: 'object' };
  }

  const successType = behavior.output.success;

  if (successType.kind === 'reference') {
    return { $ref: `#/components/schemas/${successType.name}` };
  }

  if (successType.kind === 'SimpleType') {
    const name = typeof successType.name === 'string' ? successType.name : successType.name.name;
    const primitiveSchema = mapPrimitiveToSchema(name);
    if (primitiveSchema.type !== 'string' || primitiveSchema.format) {
      return primitiveSchema;
    }
    return { $ref: `#/components/schemas/${name}` };
  }

  if (successType.kind === 'list') {
    return {
      type: 'array',
      items: buildSchemaFromTypeExpr(successType.elementType, options),
    };
  }

  if (successType.kind === 'GenericType') {
    const name = typeof successType.name === 'string' ? successType.name : successType.name.name;
    if (name === 'List' || name === 'Array') {
      return {
        type: 'array',
        items: successType.typeArguments[0] 
          ? buildSchemaFromTypeExpr(successType.typeArguments[0], options)
          : { type: 'object' },
      };
    }
  }

  return buildSchemaFromTypeExpr(successType, options);
}

/**
 * Build error schema
 */
function buildErrorSchema(error: ErrorDefinition, options: GenerateOptions): OpenAPISchema {
  const errorName = typeof error.name === 'string' ? error.name : error.name.name;
  const schema: OpenAPISchema = {
    type: 'object',
    title: errorName,
    properties: {
      code: { type: 'string', const: errorName },
      message: { type: 'string' },
    },
    required: ['code', 'message'],
  };

  if (error.fields && error.fields.length > 0) {
    schema.properties!['details'] = {
      type: 'object',
      properties: {},
    };

    for (const field of error.fields) {
      const fieldName = typeof field.name === 'string' ? field.name : (field.name as { name: string }).name;
      schema.properties!['details']!.properties![fieldName] = buildSchemaFromTypeExpr(
        field.type,
        options
      );
    }
  }

  return schema;
}

/**
 * Extract path parameters from path
 */
function extractPathParameters(
  path: string,
  behavior: Behavior,
  options: GenerateOptions
): OpenAPIParameter[] {
  const params: OpenAPIParameter[] = [];
  const pathParams = path.match(/:(\w+)/g) || [];

  for (const param of pathParams) {
    const paramName = param.slice(1);
    const field = behavior.input?.fields.find((f) => {
      const fieldName = typeof f.name === 'string' ? f.name : (f.name as { name: string }).name;
      return fieldName === paramName;
    });

    params.push({
      name: paramName,
      in: 'path',
      required: true,
      schema: field
        ? buildSchemaFromTypeExpr(field.type, options)
        : { type: 'string' },
    });
  }

  return params;
}

/**
 * Extract query parameters from behavior input
 */
function extractQueryParameters(
  behavior: Behavior,
  options: GenerateOptions
): OpenAPIParameter[] {
  if (!behavior.input) return [];

  const params: OpenAPIParameter[] = [];

  for (const field of behavior.input.fields) {
    const fieldName = typeof field.name === 'string' ? field.name : (field.name as { name: string }).name;
    // Skip fields that are likely path params
    if (['id', 'userId', 'entityId'].includes(fieldName)) continue;

    const paramSchema = buildSchemaFromTypeExpr(field.type, options);
    
    // Apply constraints to query parameter schema
    if (field.constraints) {
      applyTypeConstraints(paramSchema, field.constraints);
    }

    params.push({
      name: fieldName,
      in: 'query',
      required: !field.optional,
      schema: paramSchema,
    });
  }

  return params;
}

/**
 * Build tags from domain
 */
function buildTags(domain: Domain): OpenAPITag[] {
  const tags: OpenAPITag[] = [];

  // Add a tag for each entity
  for (const entity of domain.entities || []) {
    const entityName = typeof entity.name === 'string' ? entity.name : (entity.name as { name: string }).name;
    tags.push({
      name: entityName,
      description: `Operations related to ${entityName}`,
    });
  }

  return tags;
}

/**
 * Infer HTTP method from behavior name
 */
function inferHttpMethod(name: string): string {
  const lowerName = name.toLowerCase();

  if (lowerName.startsWith('get') || lowerName.startsWith('list') || lowerName.startsWith('find')) {
    return 'GET';
  }
  if (lowerName.startsWith('create') || lowerName.startsWith('add') || lowerName.startsWith('register')) {
    return 'POST';
  }
  if (lowerName.startsWith('update') || lowerName.startsWith('modify')) {
    return 'PUT';
  }
  if (lowerName.startsWith('patch') || lowerName.startsWith('partial')) {
    return 'PATCH';
  }
  if (lowerName.startsWith('delete') || lowerName.startsWith('remove') || lowerName.startsWith('cancel')) {
    return 'DELETE';
  }

  return 'POST';
}

/**
 * Infer API path from behavior name
 */
function inferPath(name: string): string {
  const match = name.match(/^(Get|Create|Update|Delete|List|Find|Search|Add|Remove|Patch)(.+)$/i);

  if (match) {
    const [, action, resource] = match;
    const resourcePath = `/${toKebabCase(resource)}s`;

    switch (action.toLowerCase()) {
      case 'get':
      case 'delete':
      case 'update':
      case 'patch':
        return `${resourcePath}/:id`;
      default:
        return resourcePath;
    }
  }

  return `/${toKebabCase(name)}`;
}

/**
 * Infer tag from behavior name
 */
function inferTag(name: string, domain: Domain): string {
  const match = name.match(/^(Get|Create|Update|Delete|List|Find|Search|Add|Remove)(.+)$/i);

  if (match) {
    const [, , resource] = match;
    // Find matching entity
    const entity = (domain.entities || []).find((e) => {
      const entityName = typeof e.name === 'string' ? e.name : (e.name as { name: string }).name;
      return entityName.toLowerCase() === resource.toLowerCase();
    });
    if (entity) {
      const entityName = typeof entity.name === 'string' ? entity.name : (entity.name as { name: string }).name;
      return entityName;
    }
  }

  return domain.name;
}

/**
 * Infer error status code from error name
 */
function inferErrorStatusCode(name: string): string {
  const lowerName = name.toLowerCase();

  if (lowerName.includes('not_found') || lowerName.includes('notfound')) {
    return '404';
  }
  if (lowerName.includes('unauthorized') || lowerName.includes('unauthenticated')) {
    return '401';
  }
  if (lowerName.includes('forbidden') || lowerName.includes('permission')) {
    return '403';
  }
  if (lowerName.includes('conflict') || lowerName.includes('exists')) {
    return '409';
  }
  if (lowerName.includes('invalid') || lowerName.includes('validation')) {
    return '400';
  }
  if (lowerName.includes('rate') || lowerName.includes('throttle')) {
    return '429';
  }

  return '400';
}

// String utilities
function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function toKebabCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');
}
