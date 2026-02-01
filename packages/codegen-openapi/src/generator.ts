// ============================================================================
// OpenAPI Generator
// Transforms ISL domains into OpenAPI 3.1 specifications
// ============================================================================

import * as YAML from 'yaml';
import type * as AST from '@isl-lang/isl-core';
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

/**
 * Generate OpenAPI specification from ISL domain
 */
export function generate(
  domain: AST.Domain,
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
function buildOpenAPISpec(domain: AST.Domain, options: GenerateOptions): OpenAPISpec {
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
    schemas[typeDecl.name] = buildSchemaFromType(typeDecl, options);
  }

  for (const entity of domain.entities || []) {
    schemas[entity.name] = buildSchemaFromEntity(entity, options);
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
        schemas[`${behavior.name}Error${error.name}`] = buildErrorSchema(error, options);
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
function buildSecurityScheme(auth: GenerateOptions['auth'][0]): OpenAPISecurityScheme {
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
function buildSchemaFromType(typeDecl: AST.TypeDeclaration, options: GenerateOptions): OpenAPISchema {
  const schema: OpenAPISchema = {
    title: typeDecl.name,
  };

  if (typeDecl.definition.kind === 'enum') {
    schema.type = 'string';
    schema.enum = typeDecl.definition.values.map((v) => v.name);
  } else if (typeDecl.definition.kind === 'struct') {
    schema.type = 'object';
    schema.properties = {};
    schema.required = [];

    for (const field of typeDecl.definition.fields) {
      schema.properties[field.name] = buildSchemaFromTypeExpr(field.type, options);
      if (!field.optional) {
        schema.required.push(field.name);
      }
    }
  } else if (typeDecl.definition.kind === 'primitive') {
    Object.assign(schema, mapPrimitiveToSchema(typeDecl.definition.name));
  }

  // Apply constraints
  if (typeDecl.constraints) {
    applyConstraints(schema, typeDecl.constraints);
  }

  return schema;
}

/**
 * Build schema from ISL entity
 */
function buildSchemaFromEntity(entity: AST.Entity, options: GenerateOptions): OpenAPISchema {
  const schema: OpenAPISchema = {
    type: 'object',
    title: entity.name,
    properties: {},
    required: [],
  };

  for (const field of entity.fields) {
    const fieldSchema = buildSchemaFromTypeExpr(field.type, options);

    // Handle annotations
    for (const annotation of field.annotations || []) {
      if (annotation.name === 'immutable') {
        fieldSchema.readOnly = true;
      }
      if (annotation.name === 'sensitive') {
        fieldSchema.writeOnly = true;
      }
    }

    schema.properties![field.name] = fieldSchema;

    if (!field.optional) {
      schema.required!.push(field.name);
    }
  }

  return schema;
}

/**
 * Build schema from ISL type expression
 */
function buildSchemaFromTypeExpr(type: AST.TypeExpression, options: GenerateOptions): OpenAPISchema {
  switch (type.kind) {
    case 'primitive':
      return mapPrimitiveToSchema(type.name);

    case 'reference':
      return { $ref: `#/components/schemas/${type.name}` };

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

    case 'optional':
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
 * Apply ISL constraints to OpenAPI schema
 */
function applyConstraints(schema: OpenAPISchema, constraints: AST.Constraint[]): void {
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
        schema.pattern = (constraint.value as RegExp).source;
        break;
      case 'format':
        schema.pattern = (constraint.value as RegExp).source;
        break;
    }
  }
}

/**
 * Build operation from ISL behavior
 */
function buildOperationFromBehavior(
  behavior: AST.Behavior,
  domain: AST.Domain,
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
      const statusCode = inferErrorStatusCode(error.name);
      operation.responses[statusCode] = {
        description: error.name.replace(/_/g, ' '),
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${behavior.name}Error${error.name}` },
          },
        },
      };
    }
  }

  // Standard error responses
  operation.responses['400'] = { $ref: '#/components/responses/BadRequest' } as OpenAPIResponse;
  operation.responses['401'] = { $ref: '#/components/responses/Unauthorized' } as OpenAPIResponse;
  operation.responses['500'] = { $ref: '#/components/responses/InternalError' } as OpenAPIResponse;

  return { path, method: httpMethod, operation };
}

/**
 * Build input schema from behavior
 */
function buildInputSchema(behavior: AST.Behavior, options: GenerateOptions): OpenAPISchema {
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
    schema.properties![field.name] = buildSchemaFromTypeExpr(field.type, options);
    if (!field.optional) {
      schema.required!.push(field.name);
    }
  }

  return schema;
}

/**
 * Build output schema from behavior
 */
function buildOutputSchema(behavior: AST.Behavior, options: GenerateOptions): OpenAPISchema | null {
  if (!behavior.output?.success) {
    return null;
  }

  return buildSchemaFromTypeExpr(behavior.output.success, options);
}

/**
 * Build success response schema
 */
function buildSuccessResponseSchema(behavior: AST.Behavior, options: GenerateOptions): OpenAPISchema {
  if (!behavior.output?.success) {
    return { type: 'object' };
  }

  const successType = behavior.output.success;

  if (successType.kind === 'reference') {
    return { $ref: `#/components/schemas/${successType.name}` };
  }

  if (successType.kind === 'list') {
    return {
      type: 'array',
      items: buildSchemaFromTypeExpr(successType.elementType, options),
    };
  }

  return buildSchemaFromTypeExpr(successType, options);
}

/**
 * Build error schema
 */
function buildErrorSchema(error: AST.ErrorDefinition, options: GenerateOptions): OpenAPISchema {
  const schema: OpenAPISchema = {
    type: 'object',
    title: error.name,
    properties: {
      code: { type: 'string', const: error.name },
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
      schema.properties!['details']!.properties![field.name] = buildSchemaFromTypeExpr(
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
  behavior: AST.Behavior,
  options: GenerateOptions
): OpenAPIParameter[] {
  const params: OpenAPIParameter[] = [];
  const pathParams = path.match(/:(\w+)/g) || [];

  for (const param of pathParams) {
    const paramName = param.slice(1);
    const field = behavior.input?.fields.find((f) => f.name === paramName);

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
  behavior: AST.Behavior,
  options: GenerateOptions
): OpenAPIParameter[] {
  if (!behavior.input) return [];

  const params: OpenAPIParameter[] = [];

  for (const field of behavior.input.fields) {
    // Skip fields that are likely path params
    if (['id', 'userId', 'entityId'].includes(field.name)) continue;

    params.push({
      name: field.name,
      in: 'query',
      required: !field.optional,
      schema: buildSchemaFromTypeExpr(field.type, options),
    });
  }

  return params;
}

/**
 * Build tags from domain
 */
function buildTags(domain: AST.Domain): OpenAPITag[] {
  const tags: OpenAPITag[] = [];

  // Add a tag for each entity
  for (const entity of domain.entities || []) {
    tags.push({
      name: entity.name,
      description: `Operations related to ${entity.name}`,
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
function inferTag(name: string, domain: AST.Domain): string {
  const match = name.match(/^(Get|Create|Update|Delete|List|Find|Search|Add|Remove)(.+)$/i);

  if (match) {
    const [, , resource] = match;
    // Find matching entity
    const entity = (domain.entities || []).find(
      (e) => e.name.toLowerCase() === resource.toLowerCase()
    );
    if (entity) return entity.name;
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
