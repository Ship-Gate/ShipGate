/**
 * OpenAPI error schemas generator
 */

import type { ErrorCatalog } from '../catalog.js';
import type {
  ErrorDefinition,
  GeneratorOutput,
  OpenAPIConfig,
} from '../types.js';

/**
 * OpenAPI generator class
 */
export class OpenAPIGenerator {
  private config: OpenAPIConfig;

  constructor(config: OpenAPIConfig) {
    this.config = {
      version: '3.1',
      includeSchemas: true,
      includeResponses: true,
      ...config,
    };
  }

  /**
   * Generate OpenAPI spec
   */
  async generate(catalog: ErrorCatalog): Promise<GeneratorOutput[]> {
    const errors = catalog.getAllErrors();
    const groups = catalog.getGroups();

    const spec: OpenAPISpec = {
      openapi: this.config.version === '3.0' ? '3.0.3' : '3.1.0',
      info: {
        title: 'Error Definitions',
        version: '1.0.0',
        description: 'Auto-generated error schemas from ISL definitions',
      },
      components: {
        schemas: {},
        responses: {},
      },
    };

    // Add base error schema
    spec.components.schemas['ErrorResponse'] = this.generateBaseSchema();

    if (this.config.includeSchemas) {
      // Add individual error schemas
      for (const error of errors) {
        const schemaName = this.toSchemaName(error.id);
        spec.components.schemas[schemaName] = this.generateErrorSchema(error);
      }

      // Add error code enum
      spec.components.schemas['ErrorCode'] = this.generateErrorCodeEnum(errors);
    }

    if (this.config.includeResponses) {
      // Add response definitions grouped by HTTP status
      const byStatus = this.groupByStatus(errors);
      for (const [status, statusErrors] of Object.entries(byStatus)) {
        spec.components.responses[`Error${status}`] =
          this.generateStatusResponse(parseInt(status), statusErrors);
      }
    }

    const content = this.config.outputFile.endsWith('.json')
      ? JSON.stringify(spec, null, 2)
      : this.toYaml(spec);

    return [
      {
        path: this.config.outputFile,
        content,
        type: this.config.outputFile.endsWith('.json') ? 'json' : 'yaml',
      },
    ];
  }

  /**
   * Generate base error response schema
   */
  private generateBaseSchema(): OpenAPISchema {
    return {
      type: 'object',
      required: ['error'],
      properties: {
        error: {
          type: 'object',
          required: ['code', 'type', 'message'],
          properties: {
            code: {
              type: 'string',
              description: 'Machine-readable error code',
              example: 'AUTH_001',
            },
            type: {
              type: 'string',
              description: 'Error type identifier',
              example: 'DUPLICATE_EMAIL',
            },
            message: {
              type: 'string',
              description: 'Human-readable error message',
              example: 'Email address is already registered',
            },
            details: {
              type: 'object',
              description: 'Additional error context',
              additionalProperties: true,
            },
            retriable: {
              type: 'boolean',
              description: 'Whether the operation can be retried',
            },
            retryAfter: {
              type: 'integer',
              description: 'Seconds to wait before retrying (if retriable)',
            },
          },
        },
      },
    };
  }

  /**
   * Generate schema for specific error
   */
  private generateErrorSchema(error: ErrorDefinition): OpenAPISchema {
    const schema: OpenAPISchema = {
      allOf: [
        { $ref: '#/components/schemas/ErrorResponse' },
        {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  enum: [error.code],
                },
                type: {
                  type: 'string',
                  enum: [error.id],
                },
              },
            },
          },
        },
      ],
      description: error.description || error.message,
    };

    // Add example if available
    if (error.example) {
      schema.example = error.example.response.body;
    } else {
      schema.example = {
        error: {
          code: error.code,
          type: error.id,
          message: error.message,
          retriable: error.retriable || undefined,
          retryAfter: error.retryAfter,
        },
      };
    }

    return schema;
  }

  /**
   * Generate error code enum schema
   */
  private generateErrorCodeEnum(errors: ErrorDefinition[]): OpenAPISchema {
    return {
      type: 'string',
      enum: errors.map((e) => e.code),
      description: 'All possible error codes',
      'x-enum-descriptions': errors.reduce(
        (acc, e) => ({ ...acc, [e.code]: e.message }),
        {} as Record<string, string>
      ),
    };
  }

  /**
   * Generate response for HTTP status
   */
  private generateStatusResponse(
    status: number,
    errors: ErrorDefinition[]
  ): OpenAPIResponse {
    return {
      description: this.getStatusDescription(status),
      content: {
        'application/json': {
          schema: {
            oneOf: errors.map((e) => ({
              $ref: `#/components/schemas/${this.toSchemaName(e.id)}`,
            })),
          },
          examples: errors.reduce(
            (acc, e) => ({
              ...acc,
              [e.id]: {
                summary: e.message,
                value: e.example?.response.body ?? {
                  error: {
                    code: e.code,
                    type: e.id,
                    message: e.message,
                  },
                },
              },
            }),
            {} as Record<string, OpenAPIExample>
          ),
        },
      },
    };
  }

  /**
   * Group errors by HTTP status
   */
  private groupByStatus(
    errors: ErrorDefinition[]
  ): Record<number, ErrorDefinition[]> {
    const grouped: Record<number, ErrorDefinition[]> = {};

    for (const error of errors) {
      if (!grouped[error.httpStatus]) {
        grouped[error.httpStatus] = [];
      }
      grouped[error.httpStatus].push(error);
    }

    return grouped;
  }

  /**
   * Convert error ID to schema name
   */
  private toSchemaName(id: string): string {
    return (
      id
        .split('_')
        .map(
          (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
        )
        .join('') + 'Error'
    );
  }

  /**
   * Get HTTP status description
   */
  private getStatusDescription(status: number): string {
    const descriptions: Record<number, string> = {
      400: 'Bad Request - The request was invalid or cannot be served',
      401: 'Unauthorized - Authentication is required',
      403: 'Forbidden - The request is not allowed',
      404: 'Not Found - The requested resource does not exist',
      408: 'Request Timeout - The request took too long',
      409: 'Conflict - The request conflicts with current state',
      422: 'Unprocessable Entity - The request was well-formed but invalid',
      429: 'Too Many Requests - Rate limit exceeded',
      500: 'Internal Server Error - Something went wrong on the server',
      502: 'Bad Gateway - Invalid response from upstream server',
      503: 'Service Unavailable - The server is temporarily unavailable',
      504: 'Gateway Timeout - Upstream server did not respond in time',
    };
    return descriptions[status] ?? `HTTP ${status} Error`;
  }

  /**
   * Convert object to YAML string
   */
  private toYaml(obj: unknown, indent = 0): string {
    const spaces = '  '.repeat(indent);

    if (obj === null || obj === undefined) {
      return 'null';
    }

    if (typeof obj === 'string') {
      if (obj.includes('\n') || obj.includes(':') || obj.includes('#')) {
        return `|\n${obj.split('\n').map((l) => spaces + '  ' + l).join('\n')}`;
      }
      return obj;
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return String(obj);
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      return obj
        .map((item) => `${spaces}- ${this.toYaml(item, indent + 1).trimStart()}`)
        .join('\n');
    }

    if (typeof obj === 'object') {
      const entries = Object.entries(obj);
      if (entries.length === 0) return '{}';

      return entries
        .map(([key, value]) => {
          const yamlValue = this.toYaml(value, indent + 1);
          if (
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value)
          ) {
            return `${spaces}${key}:\n${yamlValue}`;
          }
          if (Array.isArray(value) && value.length > 0) {
            return `${spaces}${key}:\n${yamlValue}`;
          }
          return `${spaces}${key}: ${yamlValue}`;
        })
        .join('\n');
    }

    return String(obj);
  }
}

/**
 * OpenAPI spec types
 */
interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  components: {
    schemas: Record<string, OpenAPISchema>;
    responses: Record<string, OpenAPIResponse>;
  };
}

interface OpenAPISchema {
  type?: string;
  required?: string[];
  properties?: Record<string, OpenAPISchema>;
  additionalProperties?: boolean | OpenAPISchema;
  allOf?: OpenAPISchema[];
  oneOf?: OpenAPISchema[];
  anyOf?: OpenAPISchema[];
  $ref?: string;
  enum?: string[];
  description?: string;
  example?: unknown;
  'x-enum-descriptions'?: Record<string, string>;
}

interface OpenAPIResponse {
  description: string;
  content: {
    [mediaType: string]: {
      schema: OpenAPISchema;
      examples?: Record<string, OpenAPIExample>;
    };
  };
}

interface OpenAPIExample {
  summary: string;
  value: unknown;
}
