/**
 * GraphQL to ISL Converter
 * 
 * Convert GraphQL schemas to ISL format.
 */

export interface GraphQLSchema {
  types: GraphQLType[];
  queries: GraphQLField[];
  mutations: GraphQLField[];
  subscriptions?: GraphQLField[];
}

export interface GraphQLType {
  name: string;
  kind: 'OBJECT' | 'INPUT_OBJECT' | 'ENUM' | 'SCALAR' | 'INTERFACE' | 'UNION';
  description?: string;
  fields?: GraphQLField[];
  inputFields?: GraphQLInputValue[];
  enumValues?: GraphQLEnumValue[];
  interfaces?: string[];
  possibleTypes?: string[];
}

export interface GraphQLField {
  name: string;
  description?: string;
  type: GraphQLTypeRef;
  args?: GraphQLInputValue[];
  isDeprecated?: boolean;
  deprecationReason?: string;
}

export interface GraphQLInputValue {
  name: string;
  description?: string;
  type: GraphQLTypeRef;
  defaultValue?: string;
}

export interface GraphQLTypeRef {
  kind: 'NON_NULL' | 'LIST' | 'NAMED';
  name?: string;
  ofType?: GraphQLTypeRef;
}

export interface GraphQLEnumValue {
  name: string;
  description?: string;
  isDeprecated?: boolean;
}

export interface GraphQLConversionOptions {
  /** Domain name for generated ISL */
  domainName?: string;
  /** Include descriptions */
  includeDescriptions?: boolean;
  /** Convert queries to behaviors */
  convertQueries?: boolean;
  /** Convert mutations to behaviors */
  convertMutations?: boolean;
  /** Convert subscriptions to behaviors */
  convertSubscriptions?: boolean;
  /** Skip deprecated fields */
  skipDeprecated?: boolean;
}

interface ISLEntity {
  name: string;
  description?: string;
  fields: ISLField[];
}

interface ISLBehavior {
  name: string;
  description?: string;
  input?: ISLField[];
  output?: { success: string };
  temporal?: string[];
}

interface ISLEnum {
  name: string;
  description?: string;
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
  behaviors: ISLBehavior[];
  types: Array<{ name: string; baseType: string }>;
  enums: ISLEnum[];
}

/**
 * GraphQL to ISL Converter
 */
export class GraphQLConverter {
  private options: Required<GraphQLConversionOptions>;
  private typeMap = new Map<string, GraphQLType>();

  constructor(options: GraphQLConversionOptions = {}) {
    this.options = {
      domainName: options.domainName ?? 'GraphQLAPI',
      includeDescriptions: options.includeDescriptions ?? true,
      convertQueries: options.convertQueries ?? true,
      convertMutations: options.convertMutations ?? true,
      convertSubscriptions: options.convertSubscriptions ?? true,
      skipDeprecated: options.skipDeprecated ?? true,
    };
  }

  /**
   * Convert GraphQL schema to ISL domain
   */
  convert(schema: GraphQLSchema): ISLDomain {
    // Build type map
    this.typeMap.clear();
    for (const type of schema.types) {
      this.typeMap.set(type.name, type);
    }

    const entities: ISLEntity[] = [];
    const behaviors: ISLBehavior[] = [];
    const enums: ISLEnum[] = [];
    const types: Array<{ name: string; baseType: string }> = [];

    // Convert types
    for (const type of schema.types) {
      // Skip built-in types
      if (type.name.startsWith('__')) continue;
      if (['Query', 'Mutation', 'Subscription', 'String', 'Int', 'Float', 'Boolean', 'ID'].includes(type.name)) {
        continue;
      }

      if (type.kind === 'OBJECT' || type.kind === 'INTERFACE') {
        entities.push(this.convertToEntity(type));
      } else if (type.kind === 'INPUT_OBJECT') {
        entities.push(this.convertInputToEntity(type));
      } else if (type.kind === 'ENUM') {
        enums.push(this.convertToEnum(type));
      } else if (type.kind === 'SCALAR') {
        types.push({
          name: type.name,
          baseType: this.mapScalarType(type.name),
        });
      }
    }

    // Convert queries to behaviors
    if (this.options.convertQueries) {
      for (const query of schema.queries) {
        if (this.options.skipDeprecated && query.isDeprecated) continue;
        behaviors.push(this.convertQueryToBehavior(query));
      }
    }

    // Convert mutations to behaviors
    if (this.options.convertMutations) {
      for (const mutation of schema.mutations) {
        if (this.options.skipDeprecated && mutation.isDeprecated) continue;
        behaviors.push(this.convertMutationToBehavior(mutation));
      }
    }

    // Convert subscriptions to behaviors
    if (this.options.convertSubscriptions && schema.subscriptions) {
      for (const subscription of schema.subscriptions) {
        if (this.options.skipDeprecated && subscription.isDeprecated) continue;
        behaviors.push(this.convertSubscriptionToBehavior(subscription));
      }
    }

    return {
      name: this.options.domainName,
      entities,
      behaviors,
      types,
      enums,
    };
  }

  /**
   * Convert GraphQL object type to ISL entity
   */
  private convertToEntity(type: GraphQLType): ISLEntity {
    const fields: ISLField[] = [];

    if (type.fields) {
      for (const field of type.fields) {
        if (this.options.skipDeprecated && field.isDeprecated) continue;

        fields.push({
          name: field.name,
          type: this.convertTypeRef(field.type),
          optional: this.isOptional(field.type),
          description: field.description,
        });
      }
    }

    return {
      name: type.name,
      description: type.description,
      fields,
    };
  }

  /**
   * Convert GraphQL input type to ISL entity
   */
  private convertInputToEntity(type: GraphQLType): ISLEntity {
    const fields: ISLField[] = [];

    if (type.inputFields) {
      for (const field of type.inputFields) {
        fields.push({
          name: field.name,
          type: this.convertTypeRef(field.type),
          optional: this.isOptional(field.type),
          description: field.description,
        });
      }
    }

    return {
      name: type.name,
      description: type.description,
      fields,
    };
  }

  /**
   * Convert GraphQL enum to ISL enum
   */
  private convertToEnum(type: GraphQLType): ISLEnum {
    const variants: string[] = [];

    if (type.enumValues) {
      for (const value of type.enumValues) {
        if (this.options.skipDeprecated && value.isDeprecated) continue;
        variants.push(value.name);
      }
    }

    return {
      name: type.name,
      description: type.description,
      variants,
    };
  }

  /**
   * Convert GraphQL query to ISL behavior
   */
  private convertQueryToBehavior(query: GraphQLField): ISLBehavior {
    const input = this.convertArgsToFields(query.args ?? []);
    const outputType = this.convertTypeRef(query.type);

    return {
      name: this.toPascalCase(query.name),
      description: query.description,
      input: input.length > 0 ? input : undefined,
      output: { success: outputType },
    };
  }

  /**
   * Convert GraphQL mutation to ISL behavior
   */
  private convertMutationToBehavior(mutation: GraphQLField): ISLBehavior {
    const input = this.convertArgsToFields(mutation.args ?? []);
    const outputType = this.convertTypeRef(mutation.type);

    return {
      name: this.toPascalCase(mutation.name),
      description: mutation.description,
      input: input.length > 0 ? input : undefined,
      output: { success: outputType },
    };
  }

  /**
   * Convert GraphQL subscription to ISL behavior with temporal
   */
  private convertSubscriptionToBehavior(subscription: GraphQLField): ISLBehavior {
    const input = this.convertArgsToFields(subscription.args ?? []);
    const outputType = this.convertTypeRef(subscription.type);

    return {
      name: this.toPascalCase(subscription.name),
      description: subscription.description,
      input: input.length > 0 ? input : undefined,
      output: { success: outputType },
      temporal: ['streaming: true'],
    };
  }

  /**
   * Convert args to ISL fields
   */
  private convertArgsToFields(args: GraphQLInputValue[]): ISLField[] {
    return args.map((arg) => ({
      name: arg.name,
      type: this.convertTypeRef(arg.type),
      optional: this.isOptional(arg.type),
      description: arg.description,
    }));
  }

  /**
   * Convert GraphQL type reference to ISL type string
   */
  private convertTypeRef(typeRef: GraphQLTypeRef): string {
    if (typeRef.kind === 'NON_NULL' && typeRef.ofType) {
      return this.convertTypeRef(typeRef.ofType);
    }

    if (typeRef.kind === 'LIST' && typeRef.ofType) {
      const innerType = this.convertTypeRef(typeRef.ofType);
      return `List<${innerType}>`;
    }

    if (typeRef.name) {
      return this.mapScalarType(typeRef.name);
    }

    return 'unknown';
  }

  /**
   * Check if type is optional
   */
  private isOptional(typeRef: GraphQLTypeRef): boolean {
    return typeRef.kind !== 'NON_NULL';
  }

  /**
   * Map GraphQL scalar to ISL type
   */
  private mapScalarType(name: string): string {
    switch (name) {
      case 'String':
        return 'String';
      case 'Int':
        return 'Int';
      case 'Float':
        return 'Decimal';
      case 'Boolean':
        return 'Boolean';
      case 'ID':
        return 'UUID';
      case 'DateTime':
        return 'Timestamp';
      case 'Date':
        return 'Date';
      case 'JSON':
        return 'Map<String, unknown>';
      default:
        return name;
    }
  }

  /**
   * Convert to PascalCase
   */
  private toPascalCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Parse GraphQL SDL to schema
   */
  static parseSDL(sdl: string): GraphQLSchema {
    // Simplified SDL parser - production would use graphql-js
    const types: GraphQLType[] = [];
    const queries: GraphQLField[] = [];
    const mutations: GraphQLField[] = [];

    // Parse type definitions (simplified)
    const typeRegex = /type\s+(\w+)(?:\s+implements\s+[\w\s,]+)?\s*\{([^}]+)\}/g;
    let match;

    while ((match = typeRegex.exec(sdl)) !== null) {
      const [, name, body] = match;
      const fields = GraphQLConverter.parseFields(body);

      if (name === 'Query') {
        queries.push(...fields);
      } else if (name === 'Mutation') {
        mutations.push(...fields);
      } else {
        types.push({
          name,
          kind: 'OBJECT',
          fields,
        });
      }
    }

    // Parse enums
    const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g;
    while ((match = enumRegex.exec(sdl)) !== null) {
      const [, name, body] = match;
      const values = body
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'));

      types.push({
        name,
        kind: 'ENUM',
        enumValues: values.map((v) => ({ name: v })),
      });
    }

    return { types, queries, mutations };
  }

  /**
   * Parse field definitions from body
   */
  private static parseFields(body: string): GraphQLField[] {
    const fields: GraphQLField[] = [];
    const lines = body.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

    for (const line of lines) {
      const match = line.match(/(\w+)(?:\([^)]*\))?\s*:\s*(.+)/);
      if (match) {
        const [, name, typeStr] = match;
        fields.push({
          name,
          type: GraphQLConverter.parseTypeString(typeStr),
        });
      }
    }

    return fields;
  }

  /**
   * Parse type string to TypeRef
   */
  private static parseTypeString(typeStr: string): GraphQLTypeRef {
    typeStr = typeStr.trim();

    if (typeStr.endsWith('!')) {
      return {
        kind: 'NON_NULL',
        ofType: GraphQLConverter.parseTypeString(typeStr.slice(0, -1)),
      };
    }

    if (typeStr.startsWith('[') && typeStr.endsWith(']')) {
      return {
        kind: 'LIST',
        ofType: GraphQLConverter.parseTypeString(typeStr.slice(1, -1)),
      };
    }

    return { kind: 'NAMED', name: typeStr };
  }
}

/**
 * Convert GraphQL schema to ISL
 */
export function convertGraphQL(
  schema: GraphQLSchema | string,
  options?: GraphQLConversionOptions
): ISLDomain {
  const converter = new GraphQLConverter(options);

  if (typeof schema === 'string') {
    schema = GraphQLConverter.parseSDL(schema);
  }

  return converter.convert(schema);
}
