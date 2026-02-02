/**
 * Schema Validator
 *
 * Validate data against ISL-derived JSON schemas.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
import AjvDefault from 'ajv';
import type { ValidateFunction, ErrorObject } from 'ajv';

// Get the actual Ajv constructor
const Ajv = AjvDefault.default ?? AjvDefault;
type AjvInstance = InstanceType<typeof Ajv>;

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  keyword: string;
  params: Record<string, unknown>;
}

export interface JSONSchema {
  $schema?: string;
  $id?: string;
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: unknown[];
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  additionalProperties?: boolean | JSONSchema;
}

export class SchemaValidator {
  private ajv: AjvInstance;
  private validators: Map<string, ValidateFunction>;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
    });

    // Add custom formats
    this.ajv.addFormat('uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    this.ajv.addFormat('email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    this.ajv.addFormat('uri', /^https?:\/\/.+/);
    this.ajv.addFormat('iso-date-time', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    this.ajv.addFormat('iso-date', /^\d{4}-\d{2}-\d{2}$/);
    this.ajv.addFormat('duration', /^P?(\d+Y)?(\d+M)?(\d+D)?(T(\d+H)?(\d+M)?(\d+S)?)?$|^\d+[smhd]$/);

    this.validators = new Map();
  }

  /**
   * Generate JSON Schema from ISL entity
   */
  generateSchema(entity: ParsedEntity): JSONSchema {
    const properties: Record<string, JSONSchema> = {};
    const required: string[] = [];

    for (const field of entity.fields) {
      properties[field.name] = this.fieldToSchema(field);
      if (!field.optional) {
        required.push(field.name);
      }
    }

    return {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: `#/definitions/${entity.name}`,
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
      additionalProperties: false,
    };
  }

  /**
   * Convert field to JSON Schema
   */
  private fieldToSchema(field: ParsedField): JSONSchema {
    const schema = this.typeToSchema(field.type);

    // Apply annotation constraints
    for (const annotation of field.annotations) {
      if (annotation.startsWith('min:')) {
        const value = parseInt(annotation.slice(4));
        if (schema.type === 'string') {
          schema.minLength = value;
        } else if (schema.type === 'number' || schema.type === 'integer') {
          schema.minimum = value;
        }
      }
      if (annotation.startsWith('max:')) {
        const value = parseInt(annotation.slice(4));
        if (schema.type === 'string') {
          schema.maxLength = value;
        } else if (schema.type === 'number' || schema.type === 'integer') {
          schema.maximum = value;
        }
      }
      if (annotation.startsWith('pattern:')) {
        schema.pattern = annotation.slice(8);
      }
    }

    return schema;
  }

  /**
   * Convert ISL type to JSON Schema type
   */
  private typeToSchema(type: string): JSONSchema {
    switch (type) {
      case 'String':
        return { type: 'string' };
      case 'Int':
        return { type: 'integer' };
      case 'Float':
      case 'Decimal':
        return { type: 'number' };
      case 'Boolean':
        return { type: 'boolean' };
      case 'UUID':
        return { type: 'string', format: 'uuid' };
      case 'Email':
        return { type: 'string', format: 'email' };
      case 'URL':
        return { type: 'string', format: 'uri' };
      case 'Timestamp':
      case 'DateTime':
        return { type: 'string', format: 'iso-date-time' };
      case 'Date':
        return { type: 'string', format: 'iso-date' };
      case 'Duration':
        return { type: 'string', format: 'duration' };
      case 'JSON':
        return { type: 'object' };
      default:
        // Handle List<T>
        if (type.startsWith('List<')) {
          const innerType = type.slice(5, -1);
          return {
            type: 'array',
            items: this.typeToSchema(innerType),
          };
        }
        // Handle Map<K, V>
        if (type.startsWith('Map<')) {
          return {
            type: 'object',
            additionalProperties: true,
          };
        }
        // Default to string for unknown types
        return { type: 'string' };
    }
  }

  /**
   * Register a schema
   */
  registerSchema(name: string, schema: JSONSchema): void {
    try {
      const validate = this.ajv.compile(schema);
      this.validators.set(name, validate);
    } catch (error) {
      throw new Error(`Invalid schema for ${name}: ${error}`);
    }
  }

  /**
   * Validate data against a registered schema
   */
  validate(name: string, data: unknown): ValidationResult {
    const validator = this.validators.get(name);
    if (!validator) {
      throw new Error(`Schema not found: ${name}`);
    }

    const valid = validator(data);
    const errors: ValidationError[] = [];

    if (!valid && validator.errors) {
      for (const error of validator.errors) {
        errors.push(this.formatError(error));
      }
    }

    return { valid: !!valid, errors };
  }

  /**
   * Validate data against a schema directly
   */
  validateSchema(schema: JSONSchema, data: unknown): ValidationResult {
    const validate = this.ajv.compile(schema);
    const valid = validate(data);
    const errors: ValidationError[] = [];

    if (!valid && validate.errors) {
      for (const error of validate.errors) {
        errors.push(this.formatError(error));
      }
    }

    return { valid: !!valid, errors };
  }

  /**
   * Format AJV error
   */
  private formatError(error: ErrorObject): ValidationError {
    return {
      path: error.instancePath || '/',
      message: error.message ?? 'Validation failed',
      keyword: error.keyword,
      params: error.params as Record<string, unknown>,
    };
  }

  /**
   * Generate schemas from ISL content
   */
  generateSchemasFromISL(islContent: string): Map<string, JSONSchema> {
    const schemas = new Map<string, JSONSchema>();
    const domain = this.parseISL(islContent);

    for (const entity of domain.entities) {
      const schema = this.generateSchema(entity);
      schemas.set(entity.name, schema);
      this.registerSchema(entity.name, schema);
    }

    return schemas;
  }

  /**
   * Parse ISL content
   */
  private parseISL(content: string): { entities: ParsedEntity[] } {
    const entities: ParsedEntity[] = [];

    const entityRegex = /entity\s+(\w+)\s*\{([^}]+)\}/g;
    let match;
    while ((match = entityRegex.exec(content)) !== null) {
      const name = match[1];
      const body = match[2];
      const fields = this.parseFields(body);
      entities.push({ name, fields });
    }

    return { entities };
  }

  private parseFields(body: string): ParsedField[] {
    const fields: ParsedField[] = [];
    const fieldRegex = /(\w+)\s*:\s*(\w+(?:<[^>]+>)?)(\?)?(?:\s*\[([^\]]+)\])?/g;
    let match;

    while ((match = fieldRegex.exec(body)) !== null) {
      fields.push({
        name: match[1],
        type: match[2],
        optional: match[3] === '?',
        annotations: match[4]?.split(',').map((a) => a.trim()) ?? [],
      });
    }

    return fields;
  }

  /**
   * List registered schemas
   */
  listSchemas(): string[] {
    return Array.from(this.validators.keys());
  }

  /**
   * Get a registered schema
   */
  getSchema(name: string): JSONSchema | undefined {
    // Note: AJV doesn't expose compiled schemas directly
    // This would need to be stored separately
    return undefined;
  }
}

interface ParsedEntity {
  name: string;
  fields: ParsedField[];
}

interface ParsedField {
  name: string;
  type: string;
  optional: boolean;
  annotations: string[];
}
