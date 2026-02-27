/**
 * OpenAPI Source Adapter
 *
 * Extracts types and operations from OpenAPI 3.x specifications.
 */

import type {
  SourceAdapter,
  MigrationSource,
  ExtractedType,
  ExtractedOperation,
  ExtractedProperty,
  ExtractedError,
  TypeConstraints,
} from '../types.js';

// ============================================================================
// OpenAPI Schema Types
// ============================================================================

interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  info: { title: string; version: string; description?: string };
  paths?: Record<string, OpenAPIPathItem>;
  components?: { schemas?: Record<string, OpenAPISchema> };
}

interface OpenAPIPathItem {
  get?: OpenAPIOperation;
  post?: OpenAPIOperation;
  put?: OpenAPIOperation;
  patch?: OpenAPIOperation;
  delete?: OpenAPIOperation;
  parameters?: OpenAPIParameter[];
}

interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: OpenAPISchema }>;
  };
  responses?: Record<string, OpenAPIResponse>;
  security?: Array<Record<string, string[]>>;
  tags?: string[];
}

interface OpenAPIParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  schema?: OpenAPISchema;
  description?: string;
}

interface OpenAPIResponse {
  description?: string;
  content?: Record<string, { schema?: OpenAPISchema }>;
}

interface OpenAPISchema {
  type?: string;
  format?: string;
  properties?: Record<string, OpenAPISchema>;
  items?: OpenAPISchema;
  required?: string[];
  enum?: Array<string | number>;
  $ref?: string;
  allOf?: OpenAPISchema[];
  oneOf?: OpenAPISchema[];
  anyOf?: OpenAPISchema[];
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  description?: string;
  default?: unknown;
}

// ============================================================================
// Adapter Implementation
// ============================================================================

class OpenAPIAdapter implements SourceAdapter {
  readonly sourceType = 'openapi' as const;

  extractTypes(source: MigrationSource): ExtractedType[] {
    const spec = this.parse(source.content);
    const types: ExtractedType[] = [];

    const schemas = spec.components?.schemas ?? {};
    for (const [name, schema] of Object.entries(schemas)) {
      types.push(this.schemaToExtractedType(schema, name, schemas));
    }

    return types;
  }

  extractOperations(source: MigrationSource): ExtractedOperation[] {
    const spec = this.parse(source.content);
    const operations: ExtractedOperation[] = [];
    const schemas = spec.components?.schemas ?? {};

    for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
      const methods: Array<[string, OpenAPIOperation | undefined]> = [
        ['get', pathItem.get],
        ['post', pathItem.post],
        ['put', pathItem.put],
        ['patch', pathItem.patch],
        ['delete', pathItem.delete],
      ];

      for (const [method, operation] of methods) {
        if (!operation) continue;

        const op = this.operationToExtracted(
          operation,
          method,
          path,
          pathItem.parameters ?? [],
          schemas
        );
        operations.push(op);
      }
    }

    return operations;
  }

  private parse(content: string): OpenAPISpec {
    return JSON.parse(content) as OpenAPISpec;
  }

  private schemaToExtractedType(
    schema: OpenAPISchema,
    name?: string,
    allSchemas: Record<string, OpenAPISchema> = {}
  ): ExtractedType {
    // Handle $ref
    if (schema.$ref) {
      const refName = this.resolveRefName(schema.$ref);
      return {
        kind: 'reference',
        name,
        refName,
        description: schema.description,
      };
    }

    // Handle allOf (inheritance/composition)
    if (schema.allOf && schema.allOf.length > 0) {
      const merged = this.mergeAllOf(schema.allOf, allSchemas);
      return { ...merged, name };
    }

    // Handle oneOf/anyOf (union types)
    if (schema.oneOf || schema.anyOf) {
      const variants = (schema.oneOf ?? schema.anyOf ?? []).map((s, i) =>
        this.schemaToExtractedType(s, `Variant${i + 1}`, allSchemas)
      );
      return {
        kind: 'union',
        name,
        unionTypes: variants,
        nullable: schema.nullable,
        description: schema.description,
      };
    }

    // Handle enums
    if (schema.enum) {
      return {
        kind: 'enum',
        name,
        enumValues: schema.enum,
        description: schema.description,
      };
    }

    // Handle arrays
    if (schema.type === 'array') {
      return {
        kind: 'array',
        name,
        itemType: schema.items
          ? this.schemaToExtractedType(schema.items, undefined, allSchemas)
          : { kind: 'unknown' },
        nullable: schema.nullable,
        description: schema.description,
      };
    }

    // Handle objects
    if (schema.type === 'object' || schema.properties) {
      const properties: ExtractedProperty[] = [];
      const required = new Set(schema.required ?? []);

      for (const [propName, propSchema] of Object.entries(schema.properties ?? {})) {
        properties.push({
          name: propName,
          type: this.schemaToExtractedType(propSchema, undefined, allSchemas),
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
        description: schema.description,
      };
    }

    // Handle primitives
    const primitiveType = this.mapPrimitiveType(schema.type, schema.format);
    const constraints = this.extractConstraints(schema);

    return {
      kind: 'primitive',
      name,
      primitiveType,
      constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
      nullable: schema.nullable,
      description: schema.description,
    };
  }

  private operationToExtracted(
    operation: OpenAPIOperation,
    method: string,
    path: string,
    pathParams: OpenAPIParameter[],
    schemas: Record<string, OpenAPISchema>
  ): ExtractedOperation {
    const inputs: ExtractedProperty[] = [];

    // Combine path-level and operation-level parameters
    const allParams = [...pathParams, ...(operation.parameters ?? [])];
    for (const param of allParams) {
      inputs.push({
        name: param.name,
        type: param.schema
          ? this.schemaToExtractedType(param.schema, undefined, schemas)
          : { kind: 'primitive', primitiveType: 'string' },
        required: param.required ?? false,
        description: param.description,
        source: param.in,
      });
    }

    // Extract request body
    if (operation.requestBody?.content) {
      const jsonContent = operation.requestBody.content['application/json'];
      if (jsonContent?.schema) {
        const bodyType = this.schemaToExtractedType(jsonContent.schema, undefined, schemas);
        if (bodyType.kind === 'object' && bodyType.properties) {
          for (const prop of bodyType.properties) {
            inputs.push({ ...prop, source: 'body' });
          }
        } else {
          inputs.push({
            name: 'body',
            type: bodyType,
            required: operation.requestBody.required ?? false,
            source: 'body',
          });
        }
      }
    }

    // Extract success response
    let output: ExtractedType | undefined;
    const successResponse = operation.responses?.['200'] ?? operation.responses?.['201'];
    if (successResponse?.content) {
      const jsonContent = successResponse.content['application/json'];
      if (jsonContent?.schema) {
        output = this.schemaToExtractedType(jsonContent.schema, undefined, schemas);
      }
    }

    // Extract errors
    const errors: ExtractedError[] = [];
    for (const [code, response] of Object.entries(operation.responses ?? {})) {
      if (code.startsWith('2')) continue; // Skip success codes
      const statusCode = parseInt(code, 10);
      errors.push({
        name: this.generateErrorName(statusCode),
        statusCode: isNaN(statusCode) ? undefined : statusCode,
        description: response.description,
      });
    }

    // Extract security requirements
    const security = operation.security?.flatMap((s) => Object.keys(s)) ?? [];

    return {
      name: operation.operationId ?? this.generateOperationName(method, path),
      method,
      path,
      description: operation.description ?? operation.summary,
      inputs,
      output,
      errors,
      security: security.length > 0 ? security : undefined,
      tags: operation.tags,
    };
  }

  private resolveRefName(ref: string): string {
    // #/components/schemas/User -> User
    return ref.split('/').pop() ?? ref;
  }

  private mergeAllOf(
    schemas: OpenAPISchema[],
    allSchemas: Record<string, OpenAPISchema>
  ): ExtractedType {
    const properties: ExtractedProperty[] = [];
    let description: string | undefined;

    for (const schema of schemas) {
      const resolved = schema.$ref
        ? allSchemas[this.resolveRefName(schema.$ref)] ?? schema
        : schema;

      if (resolved.description) description = resolved.description;

      const extracted = this.schemaToExtractedType(resolved, undefined, allSchemas);
      if (extracted.kind === 'object' && extracted.properties) {
        properties.push(...extracted.properties);
      }
    }

    return {
      kind: 'object',
      properties,
      description,
    };
  }

  private mapPrimitiveType(type?: string, format?: string): string {
    if (format === 'date-time' || format === 'date') return 'Timestamp';
    if (format === 'uuid') return 'UUID';
    if (type === 'integer') return 'Int';
    if (type === 'number') return 'Decimal';
    if (type === 'boolean') return 'Boolean';
    return 'String';
  }

  private extractConstraints(schema: OpenAPISchema): TypeConstraints {
    const constraints: TypeConstraints = {};
    if (schema.minLength !== undefined) constraints.minLength = schema.minLength;
    if (schema.maxLength !== undefined) constraints.maxLength = schema.maxLength;
    if (schema.minimum !== undefined) constraints.minimum = schema.minimum;
    if (schema.maximum !== undefined) constraints.maximum = schema.maximum;
    if (schema.pattern !== undefined) constraints.pattern = schema.pattern;
    if (schema.format !== undefined) constraints.format = schema.format;
    return constraints;
  }

  private generateOperationName(method: string, path: string): string {
    // Convert /users/{id} GET -> GetUsersById
    const parts = path
      .split('/')
      .filter(Boolean)
      .map((part) =>
        part.startsWith('{') ? 'By' + this.capitalize(part.slice(1, -1)) : this.capitalize(part)
      );
    return this.capitalize(method) + parts.join('');
  }

  private generateErrorName(statusCode: number): string {
    const errorMap: Record<number, string> = {
      400: 'BadRequest',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'NotFound',
      409: 'Conflict',
      422: 'UnprocessableEntity',
      429: 'TooManyRequests',
      500: 'InternalError',
      502: 'BadGateway',
      503: 'ServiceUnavailable',
    };
    return errorMap[statusCode] ?? `Error${statusCode}`;
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }
}

export const openAPIAdapter = new OpenAPIAdapter();
