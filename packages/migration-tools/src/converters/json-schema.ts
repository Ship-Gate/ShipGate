/**
 * JSON Schema to ISL Converter
 * 
 * Convert JSON Schema definitions to ISL format.
 */

export interface JSONSchema {
  $schema?: string;
  $id?: string;
  title?: string;
  description?: string;
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: unknown[];
  const?: unknown;
  allOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  $ref?: string;
  definitions?: Record<string, JSONSchema>;
  $defs?: Record<string, JSONSchema>;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  additionalProperties?: boolean | JSONSchema;
}

export interface JSONSchemaConversionOptions {
  /** Domain name */
  domainName?: string;
  /** Root entity name */
  rootName?: string;
  /** Include constraints */
  includeConstraints?: boolean;
  /** Generate validation conditions */
  generateValidation?: boolean;
}

interface ISLEntity {
  name: string;
  description?: string;
  fields: ISLField[];
  invariants?: string[];
}

interface ISLType {
  name: string;
  baseType: string;
  constraints?: string[];
}

interface ISLEnum {
  name: string;
  variants: string[];
}

interface ISLField {
  name: string;
  type: string;
  optional?: boolean;
  description?: string;
}

export interface ISLDomain {
  name: string;
  description?: string;
  entities: ISLEntity[];
  behaviors: Array<{ name: string }>;
  types: ISLType[];
  enums: ISLEnum[];
}

/**
 * JSON Schema to ISL Converter
 */
export class JSONSchemaConverter {
  private options: Required<JSONSchemaConversionOptions>;
  private definitions = new Map<string, JSONSchema>();
  private generatedNames = new Set<string>();

  constructor(options: JSONSchemaConversionOptions = {}) {
    this.options = {
      domainName: options.domainName ?? 'Schema',
      rootName: options.rootName ?? 'Root',
      includeConstraints: options.includeConstraints ?? true,
      generateValidation: options.generateValidation ?? true,
    };
  }

  /**
   * Convert JSON Schema to ISL domain
   */
  convert(schema: JSONSchema): ISLDomain {
    // Reset state
    this.definitions.clear();
    this.generatedNames.clear();

    // Collect definitions
    const defs = schema.definitions ?? schema.$defs ?? {};
    for (const [name, def] of Object.entries(defs)) {
      this.definitions.set(name, def);
    }

    const entities: ISLEntity[] = [];
    const types: ISLType[] = [];
    const enums: ISLEnum[] = [];

    // Convert root schema
    if (schema.type === 'object' || schema.properties) {
      const rootEntity = this.convertToEntity(schema, schema.title ?? this.options.rootName);
      entities.push(rootEntity);
    }

    // Convert definitions
    for (const [name, def] of this.definitions) {
      if (def.enum) {
        enums.push(this.convertToEnum(def, name));
      } else if (def.type === 'object' || def.properties) {
        entities.push(this.convertToEntity(def, name));
      } else {
        const type = this.convertToType(def, name);
        if (type) types.push(type);
      }
    }

    return {
      name: this.options.domainName,
      description: schema.description,
      entities,
      behaviors: [],
      types,
      enums,
    };
  }

  /**
   * Convert schema to entity
   */
  private convertToEntity(schema: JSONSchema, name: string): ISLEntity {
    const fields: ISLField[] = [];
    const invariants: string[] = [];

    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const isRequired = schema.required?.includes(propName) ?? false;

        fields.push({
          name: propName,
          type: this.schemaToType(propSchema, `${name}${this.toPascalCase(propName)}`),
          optional: !isRequired,
          description: propSchema.description,
        });

        // Generate invariants from constraints
        if (this.options.generateValidation) {
          const constraints = this.extractConstraints(propName, propSchema);
          invariants.push(...constraints);
        }
      }
    }

    return {
      name: this.toPascalCase(name),
      description: schema.description,
      fields,
      invariants: invariants.length > 0 ? invariants : undefined,
    };
  }

  /**
   * Convert schema to type
   */
  private convertToType(schema: JSONSchema, name: string): ISLType | null {
    const baseType = this.mapSchemaType(schema);
    const constraints: string[] = [];

    if (this.options.includeConstraints) {
      if (schema.minimum !== undefined) constraints.push(`min: ${schema.minimum}`);
      if (schema.maximum !== undefined) constraints.push(`max: ${schema.maximum}`);
      if (schema.minLength !== undefined) constraints.push(`minLength: ${schema.minLength}`);
      if (schema.maxLength !== undefined) constraints.push(`maxLength: ${schema.maxLength}`);
      if (schema.pattern) constraints.push(`pattern: "${schema.pattern}"`);
      if (schema.format) constraints.push(`format: "${schema.format}"`);
    }

    if (constraints.length === 0 && baseType === 'String') {
      return null;
    }

    return {
      name: this.toPascalCase(name),
      baseType,
      constraints: constraints.length > 0 ? constraints : undefined,
    };
  }

  /**
   * Convert schema to enum
   */
  private convertToEnum(schema: JSONSchema, name: string): ISLEnum {
    return {
      name: this.toPascalCase(name),
      variants: (schema.enum ?? []).map((v) => String(v)),
    };
  }

  /**
   * Convert schema to ISL type string
   */
  private schemaToType(schema: JSONSchema, nameHint: string): string {
    // Handle $ref
    if (schema.$ref) {
      const refName = schema.$ref.split('/').pop()!;
      return this.toPascalCase(refName);
    }

    // Handle enum
    if (schema.enum) {
      // Create inline enum
      return `enum { ${schema.enum.map((v) => String(v)).join(', ')} }`;
    }

    // Handle const
    if (schema.const !== undefined) {
      return `const(${JSON.stringify(schema.const)})`;
    }

    // Handle allOf/anyOf/oneOf
    if (schema.allOf) {
      const types = schema.allOf.map((s, i) => this.schemaToType(s, `${nameHint}Part${i}`));
      return types.join(' & ');
    }

    if (schema.oneOf || schema.anyOf) {
      const schemas = schema.oneOf ?? schema.anyOf!;
      const types = schemas.map((s, i) => this.schemaToType(s, `${nameHint}Variant${i}`));
      return types.join(' | ');
    }

    // Handle type
    return this.mapSchemaType(schema);
  }

  /**
   * Map JSON Schema type to ISL type
   */
  private mapSchemaType(schema: JSONSchema): string {
    const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;

    switch (type) {
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

      case 'array':
        if (schema.items) {
          const itemType = this.schemaToType(schema.items, 'Item');
          return `List<${itemType}>`;
        }
        return 'List<unknown>';

      case 'object':
        if (schema.additionalProperties) {
          const valueType = typeof schema.additionalProperties === 'object'
            ? this.schemaToType(schema.additionalProperties, 'Value')
            : 'unknown';
          return `Map<String, ${valueType}>`;
        }
        return 'Map<String, unknown>';

      case 'null':
        return 'void';

      default:
        return 'unknown';
    }
  }

  /**
   * Extract validation constraints
   */
  private extractConstraints(fieldName: string, schema: JSONSchema): string[] {
    const constraints: string[] = [];

    if (schema.minimum !== undefined) {
      constraints.push(`${fieldName} >= ${schema.minimum}`);
    }
    if (schema.maximum !== undefined) {
      constraints.push(`${fieldName} <= ${schema.maximum}`);
    }
    if (schema.minLength !== undefined) {
      constraints.push(`${fieldName}.length >= ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined) {
      constraints.push(`${fieldName}.length <= ${schema.maxLength}`);
    }
    if (schema.pattern) {
      constraints.push(`${fieldName}.matches("${schema.pattern}")`);
    }

    return constraints;
  }

  /**
   * Convert to PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
      .replace(/^./, (c) => c.toUpperCase());
  }
}

/**
 * Convert JSON Schema to ISL
 */
export function convertJSONSchema(
  schema: JSONSchema,
  options?: JSONSchemaConversionOptions
): ISLDomain {
  const converter = new JSONSchemaConverter(options);
  return converter.convert(schema);
}
