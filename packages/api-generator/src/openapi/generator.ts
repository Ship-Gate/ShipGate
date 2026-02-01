/**
 * OpenAPI Specification Generator
 * 
 * Generates OpenAPI 3.0 specs from ISL domains.
 */

import type { GeneratedFile, DomainSpec, BehaviorSpec, EntitySpec } from '../types.js';

// ============================================================================
// Types
// ============================================================================

export interface OpenAPIOptions {
  /** OpenAPI version */
  version?: '3.0.0' | '3.1.0';
  /** Server URLs */
  servers?: Array<{ url: string; description?: string }>;
  /** Include authentication */
  authentication?: boolean;
  /** Output format */
  format?: 'json' | 'yaml';
}

interface OpenAPISpec {
  openapi: string;
  info: { title: string; version: string; description?: string };
  servers?: Array<{ url: string; description?: string }>;
  paths: Record<string, Record<string, PathOperation>>;
  components: {
    schemas: Record<string, SchemaObject>;
    securitySchemes?: Record<string, SecurityScheme>;
  };
  security?: Array<Record<string, string[]>>;
}

interface PathOperation {
  operationId: string;
  summary: string;
  description?: string;
  tags: string[];
  requestBody?: { required: boolean; content: Record<string, { schema: { $ref: string } }> };
  responses: Record<string, { description: string; content?: Record<string, { schema: { $ref: string } }> }>;
  security?: Array<Record<string, string[]>>;
}

interface SchemaObject {
  type: string;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  enum?: string[];
  oneOf?: Array<{ $ref: string }>;
}

interface SchemaProperty {
  type?: string;
  format?: string;
  $ref?: string;
  items?: { $ref?: string; type?: string };
  description?: string;
}

interface SecurityScheme {
  type: string;
  scheme?: string;
  bearerFormat?: string;
  name?: string;
  in?: string;
}

// ============================================================================
// OpenAPI Generator
// ============================================================================

export class OpenAPIGenerator {
  private options: Required<OpenAPIOptions>;

  constructor(options: OpenAPIOptions = {}) {
    this.options = {
      version: options.version ?? '3.0.0',
      servers: options.servers ?? [{ url: '/api', description: 'API Server' }],
      authentication: options.authentication ?? true,
      format: options.format ?? 'json',
    };
  }

  /**
   * Generate OpenAPI specification
   */
  generate(domain: DomainSpec): GeneratedFile[] {
    const spec = this.buildSpec(domain);
    const content = this.options.format === 'yaml'
      ? this.toYAML(spec)
      : JSON.stringify(spec, null, 2);

    const ext = this.options.format === 'yaml' ? 'yaml' : 'json';

    return [{
      path: `openapi.${ext}`,
      content,
      type: 'schema',
    }];
  }

  /**
   * Build OpenAPI spec object
   */
  private buildSpec(domain: DomainSpec): OpenAPISpec {
    const spec: OpenAPISpec = {
      openapi: this.options.version,
      info: {
        title: `${domain.name} API`,
        version: domain.version,
        description: `Auto-generated API from ISL domain: ${domain.name}`,
      },
      servers: this.options.servers,
      paths: {},
      components: {
        schemas: {},
      },
    };

    // Add security schemes
    if (this.options.authentication) {
      spec.components.securitySchemes = {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      };
      spec.security = [{ bearerAuth: [] }];
    }

    // Generate schemas for entities
    for (const entity of domain.entities) {
      spec.components.schemas[entity.name] = this.entityToSchema(entity);
    }

    // Generate paths and schemas for behaviors
    for (const behavior of domain.behaviors) {
      const path = this.behaviorToPath(behavior.name);
      const method = this.inferMethod(behavior);

      if (!spec.paths[path]) {
        spec.paths[path] = {};
      }

      spec.paths[path][method] = this.behaviorToOperation(behavior, domain.name);

      // Add input/output schemas
      if (behavior.input) {
        spec.components.schemas[`${behavior.name}Input`] = this.inputToSchema(behavior);
      }
      if (behavior.output) {
        spec.components.schemas[`${behavior.name}Result`] = this.outputToSchema(behavior);
        if (behavior.output.errors.length > 0) {
          spec.components.schemas[`${behavior.name}Error`] = this.errorToSchema(behavior);
        }
      }
    }

    return spec;
  }

  /**
   * Convert entity to schema
   */
  private entityToSchema(entity: EntitySpec): SchemaObject {
    const properties: Record<string, SchemaProperty> = {};
    const required: string[] = [];

    for (const field of entity.fields) {
      properties[field.name] = this.fieldToProperty(field.type);
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

  /**
   * Convert behavior input to schema
   */
  private inputToSchema(behavior: BehaviorSpec): SchemaObject {
    const properties: Record<string, SchemaProperty> = {};
    const required: string[] = [];

    for (const field of behavior.input?.fields || []) {
      properties[field.name] = this.fieldToProperty(field.type);
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

  /**
   * Convert behavior output to schema
   */
  private outputToSchema(behavior: BehaviorSpec): SchemaObject {
    return {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { $ref: `#/components/schemas/${behavior.output?.success}` },
        error: behavior.output?.errors.length
          ? { $ref: `#/components/schemas/${behavior.name}Error` }
          : undefined,
      },
      required: ['success'],
    };
  }

  /**
   * Convert errors to schema
   */
  private errorToSchema(behavior: BehaviorSpec): SchemaObject {
    return {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          enum: behavior.output?.errors.map(e => e.name),
        } as unknown as SchemaProperty,
        message: { type: 'string' },
      },
      required: ['code', 'message'],
    };
  }

  /**
   * Convert field type to property
   */
  private fieldToProperty(type: string): SchemaProperty {
    switch (type) {
      case 'String': return { type: 'string' };
      case 'Int': return { type: 'integer' };
      case 'Decimal': return { type: 'number' };
      case 'Boolean': return { type: 'boolean' };
      case 'UUID': return { type: 'string', format: 'uuid' };
      case 'Timestamp': return { type: 'string', format: 'date-time' };
      default: return { $ref: `#/components/schemas/${type}` };
    }
  }

  /**
   * Convert behavior to operation
   */
  private behaviorToOperation(behavior: BehaviorSpec, tag: string): PathOperation {
    const op: PathOperation = {
      operationId: this.toCamelCase(behavior.name),
      summary: behavior.description || behavior.name,
      tags: [tag],
      responses: {
        '200': {
          description: 'Success',
          content: behavior.output ? {
            'application/json': {
              schema: { $ref: `#/components/schemas/${behavior.name}Result` },
            },
          } : undefined,
        },
        '400': { description: 'Bad Request' },
        '401': { description: 'Unauthorized' },
        '500': { description: 'Internal Server Error' },
      },
    };

    if (behavior.input) {
      op.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${behavior.name}Input` },
          },
        },
      };
    }

    return op;
  }

  /**
   * Convert behavior name to path
   */
  private behaviorToPath(name: string): string {
    return '/' + name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
  }

  /**
   * Infer HTTP method from behavior name
   */
  private inferMethod(behavior: BehaviorSpec): string {
    const name = behavior.name.toLowerCase();
    if (name.startsWith('get') || name.startsWith('list')) return 'get';
    if (name.startsWith('create')) return 'post';
    if (name.startsWith('update')) return 'put';
    if (name.startsWith('delete')) return 'delete';
    return 'post';
  }

  private toCamelCase(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  /**
   * Convert to YAML (simplified)
   */
  private toYAML(obj: unknown, indent = 0): string {
    const spaces = '  '.repeat(indent);
    
    if (obj === null || obj === undefined) return 'null';
    if (typeof obj === 'boolean') return obj.toString();
    if (typeof obj === 'number') return obj.toString();
    if (typeof obj === 'string') return obj.includes(':') || obj.includes('#') ? `"${obj}"` : obj;
    
    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      return obj.map(item => `${spaces}- ${this.toYAML(item, indent + 1).trim()}`).join('\n');
    }
    
    if (typeof obj === 'object') {
      const entries = Object.entries(obj).filter(([_, v]) => v !== undefined);
      if (entries.length === 0) return '{}';
      return entries.map(([key, value]) => {
        const val = this.toYAML(value, indent + 1);
        return typeof value === 'object' && value !== null && !Array.isArray(value)
          ? `${spaces}${key}:\n${val}`
          : `${spaces}${key}: ${val.trim()}`;
      }).join('\n');
    }
    
    return String(obj);
  }
}

export function generateOpenAPISpec(domain: DomainSpec, options?: OpenAPIOptions): GeneratedFile[] {
  return new OpenAPIGenerator(options).generate(domain);
}
