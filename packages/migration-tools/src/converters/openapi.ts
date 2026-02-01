/**
 * OpenAPI to ISL Converter
 * 
 * Convert OpenAPI 3.x specifications to ISL format.
 */

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{ url: string; description?: string }>;
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    securitySchemes?: Record<string, SecurityScheme>;
  };
  security?: SecurityRequirement[];
}

export interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
  parameters?: Parameter[];
}

export interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  security?: SecurityRequirement[];
}

export interface Parameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  schema: SchemaObject;
}

export interface RequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, MediaType>;
}

export interface Response {
  description: string;
  content?: Record<string, MediaType>;
}

export interface MediaType {
  schema: SchemaObject;
}

export interface SchemaObject {
  type?: string;
  format?: string;
  items?: SchemaObject;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  enum?: string[];
  $ref?: string;
  allOf?: SchemaObject[];
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
  description?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface SecurityScheme {
  type: string;
  scheme?: string;
  bearerFormat?: string;
  flows?: Record<string, unknown>;
}

export type SecurityRequirement = Record<string, string[]>;

export interface OpenAPIConversionOptions {
  /** Domain name for generated ISL */
  domainName?: string;
  /** Include descriptions as comments */
  includeDescriptions?: boolean;
  /** Generate security requirements */
  generateSecurity?: boolean;
  /** Generate compliance annotations */
  generateCompliance?: boolean;
  /** Infer preconditions from validation */
  inferPreconditions?: boolean;
  /** Infer postconditions from responses */
  inferPostconditions?: boolean;
}

export interface ISLDomain {
  name: string;
  description?: string;
  entities: ISLEntity[];
  behaviors: ISLBehavior[];
  types: ISLType[];
  enums: ISLEnum[];
}

export interface ISLEntity {
  name: string;
  description?: string;
  fields: ISLField[];
}

export interface ISLBehavior {
  name: string;
  description?: string;
  input?: ISLField[];
  output?: { success: string; failure?: string };
  preconditions?: string[];
  postconditions?: string[];
  security?: string[];
}

export interface ISLType {
  name: string;
  baseType: string;
  constraints?: string[];
}

export interface ISLEnum {
  name: string;
  variants: string[];
}

export interface ISLField {
  name: string;
  type: string;
  optional?: boolean;
  description?: string;
}

/**
 * OpenAPI to ISL Converter
 */
export class OpenAPIConverter {
  private options: Required<OpenAPIConversionOptions>;
  private schemas = new Map<string, SchemaObject>();
  private generatedTypes = new Set<string>();

  constructor(options: OpenAPIConversionOptions = {}) {
    this.options = {
      domainName: options.domainName ?? 'API',
      includeDescriptions: options.includeDescriptions ?? true,
      generateSecurity: options.generateSecurity ?? true,
      generateCompliance: options.generateCompliance ?? false,
      inferPreconditions: options.inferPreconditions ?? true,
      inferPostconditions: options.inferPostconditions ?? true,
    };
  }

  /**
   * Convert OpenAPI spec to ISL domain
   */
  convert(spec: OpenAPISpec): ISLDomain {
    // Reset state
    this.schemas.clear();
    this.generatedTypes.clear();

    // Extract schemas
    if (spec.components?.schemas) {
      for (const [name, schema] of Object.entries(spec.components.schemas)) {
        this.schemas.set(name, schema);
      }
    }

    const entities: ISLEntity[] = [];
    const behaviors: ISLBehavior[] = [];
    const types: ISLType[] = [];
    const enums: ISLEnum[] = [];

    // Convert schemas to entities/types/enums
    for (const [name, schema] of this.schemas) {
      if (schema.enum) {
        enums.push(this.convertToEnum(name, schema));
      } else if (schema.type === 'object' || schema.properties) {
        entities.push(this.convertToEntity(name, schema));
      } else {
        const type = this.convertToType(name, schema);
        if (type) types.push(type);
      }
    }

    // Convert paths to behaviors
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      const pathBehaviors = this.convertPathToBehaviors(path, pathItem, spec);
      behaviors.push(...pathBehaviors);
    }

    return {
      name: this.options.domainName,
      description: spec.info.description,
      entities,
      behaviors,
      types,
      enums,
    };
  }

  /**
   * Convert schema to entity
   */
  private convertToEntity(name: string, schema: SchemaObject): ISLEntity {
    const fields: ISLField[] = [];

    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        fields.push({
          name: propName,
          type: this.mapSchemaToType(propSchema),
          optional: !schema.required?.includes(propName),
          description: propSchema.description,
        });
      }
    }

    return {
      name: this.toPascalCase(name),
      description: schema.description,
      fields,
    };
  }

  /**
   * Convert schema to enum
   */
  private convertToEnum(name: string, schema: SchemaObject): ISLEnum {
    return {
      name: this.toPascalCase(name),
      variants: schema.enum ?? [],
    };
  }

  /**
   * Convert schema to type alias
   */
  private convertToType(name: string, schema: SchemaObject): ISLType | null {
    const baseType = this.mapSchemaToType(schema);
    const constraints: string[] = [];

    // Extract constraints
    if (schema.minLength !== undefined) {
      constraints.push(`minLength: ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined) {
      constraints.push(`maxLength: ${schema.maxLength}`);
    }
    if (schema.minimum !== undefined) {
      constraints.push(`min: ${schema.minimum}`);
    }
    if (schema.maximum !== undefined) {
      constraints.push(`max: ${schema.maximum}`);
    }
    if (schema.pattern) {
      constraints.push(`pattern: "${schema.pattern}"`);
    }

    if (constraints.length === 0 && baseType === 'String') {
      return null; // Don't create type for simple strings
    }

    return {
      name: this.toPascalCase(name),
      baseType,
      constraints,
    };
  }

  /**
   * Convert path to behaviors
   */
  private convertPathToBehaviors(
    path: string,
    pathItem: PathItem,
    spec: OpenAPISpec
  ): ISLBehavior[] {
    const behaviors: ISLBehavior[] = [];
    const methods: Array<[string, Operation | undefined]> = [
      ['get', pathItem.get],
      ['post', pathItem.post],
      ['put', pathItem.put],
      ['patch', pathItem.patch],
      ['delete', pathItem.delete],
    ];

    for (const [method, operation] of methods) {
      if (!operation) continue;

      const behavior = this.convertOperationToBehavior(
        path,
        method,
        operation,
        pathItem.parameters ?? [],
        spec
      );
      behaviors.push(behavior);
    }

    return behaviors;
  }

  /**
   * Convert operation to behavior
   */
  private convertOperationToBehavior(
    path: string,
    method: string,
    operation: Operation,
    pathParams: Parameter[],
    spec: OpenAPISpec
  ): ISLBehavior {
    // Generate behavior name
    const name = operation.operationId
      ? this.toPascalCase(operation.operationId)
      : this.generateBehaviorName(method, path);

    // Collect input fields
    const input: ISLField[] = [];

    // Path and query parameters
    const allParams = [...pathParams, ...(operation.parameters ?? [])];
    for (const param of allParams) {
      input.push({
        name: param.name,
        type: this.mapSchemaToType(param.schema),
        optional: !param.required,
        description: param.description,
      });
    }

    // Request body
    if (operation.requestBody) {
      const jsonContent = operation.requestBody.content['application/json'];
      if (jsonContent?.schema) {
        const bodyFields = this.extractFieldsFromSchema(jsonContent.schema);
        input.push(...bodyFields);
      }
    }

    // Output type
    const successResponse = operation.responses['200'] ?? operation.responses['201'];
    let outputType = 'void';
    
    if (successResponse?.content?.['application/json']?.schema) {
      outputType = this.mapSchemaToType(successResponse.content['application/json'].schema);
    }

    // Generate preconditions
    const preconditions: string[] = [];
    if (this.options.inferPreconditions) {
      for (const param of allParams) {
        if (param.required) {
          preconditions.push(`${param.name}.is_defined`);
        }
        if (param.schema.pattern) {
          preconditions.push(`${param.name}.matches("${param.schema.pattern}")`);
        }
      }
    }

    // Generate postconditions
    const postconditions: string[] = [];
    if (this.options.inferPostconditions && outputType !== 'void') {
      postconditions.push(`result.is_defined`);
    }

    // Security requirements
    const security: string[] = [];
    if (this.options.generateSecurity) {
      const secReqs = operation.security ?? spec.security ?? [];
      for (const req of secReqs) {
        for (const [scheme, scopes] of Object.entries(req)) {
          if (scopes.length > 0) {
            security.push(`requires_scopes: [${scopes.join(', ')}]`);
          } else {
            security.push(`requires_auth: ${scheme}`);
          }
        }
      }
    }

    return {
      name,
      description: operation.summary ?? operation.description,
      input: input.length > 0 ? input : undefined,
      output: outputType !== 'void' ? { success: outputType } : undefined,
      preconditions: preconditions.length > 0 ? preconditions : undefined,
      postconditions: postconditions.length > 0 ? postconditions : undefined,
      security: security.length > 0 ? security : undefined,
    };
  }

  /**
   * Extract fields from schema
   */
  private extractFieldsFromSchema(schema: SchemaObject): ISLField[] {
    // Handle $ref
    if (schema.$ref) {
      const refName = schema.$ref.split('/').pop()!;
      const refSchema = this.schemas.get(refName);
      if (refSchema) {
        return this.extractFieldsFromSchema(refSchema);
      }
    }

    const fields: ISLField[] = [];

    if (schema.properties) {
      for (const [name, propSchema] of Object.entries(schema.properties)) {
        fields.push({
          name,
          type: this.mapSchemaToType(propSchema),
          optional: !schema.required?.includes(name),
          description: propSchema.description,
        });
      }
    }

    return fields;
  }

  /**
   * Map OpenAPI schema to ISL type
   */
  private mapSchemaToType(schema: SchemaObject): string {
    // Handle $ref
    if (schema.$ref) {
      const refName = schema.$ref.split('/').pop()!;
      return this.toPascalCase(refName);
    }

    // Handle array
    if (schema.type === 'array' && schema.items) {
      const itemType = this.mapSchemaToType(schema.items);
      return `List<${itemType}>`;
    }

    // Handle type
    switch (schema.type) {
      case 'string':
        if (schema.format === 'uuid') return 'UUID';
        if (schema.format === 'date-time') return 'Timestamp';
        if (schema.format === 'date') return 'Date';
        if (schema.format === 'email') return 'Email';
        if (schema.format === 'uri') return 'URL';
        return 'String';

      case 'integer':
        return 'Int';

      case 'number':
        return 'Decimal';

      case 'boolean':
        return 'Boolean';

      case 'object':
        return 'Map<String, unknown>';

      default:
        return 'unknown';
    }
  }

  /**
   * Generate behavior name from method and path
   */
  private generateBehaviorName(method: string, path: string): string {
    // Extract resource name from path
    const segments = path.split('/').filter((s) => s && !s.startsWith('{'));
    const resource = segments[segments.length - 1] ?? 'Resource';

    // Map method to action
    const actions: Record<string, string> = {
      get: path.includes('{') ? 'Get' : 'List',
      post: 'Create',
      put: 'Update',
      patch: 'Patch',
      delete: 'Delete',
    };

    const action = actions[method] ?? 'Process';
    return `${action}${this.toPascalCase(this.singularize(resource))}`;
  }

  /**
   * Convert string to PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
      .replace(/^./, (c) => c.toUpperCase());
  }

  /**
   * Simple singularize (basic cases)
   */
  private singularize(str: string): string {
    if (str.endsWith('ies')) return str.slice(0, -3) + 'y';
    if (str.endsWith('es')) return str.slice(0, -2);
    if (str.endsWith('s')) return str.slice(0, -1);
    return str;
  }
}

/**
 * Convert OpenAPI spec to ISL
 */
export function convertOpenAPI(
  spec: OpenAPISpec,
  options?: OpenAPIConversionOptions
): ISLDomain {
  const converter = new OpenAPIConverter(options);
  return converter.convert(spec);
}
