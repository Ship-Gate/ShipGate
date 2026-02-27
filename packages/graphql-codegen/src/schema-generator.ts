/**
 * GraphQL Schema Generator
 *
 * Generate GraphQL schemas from ISL specifications.
 */

export interface SchemaGeneratorOptions {
  /** Include descriptions from ISL */
  includeDescriptions?: boolean;
  /** Include input validation directives */
  includeValidation?: boolean;
  /** Include federation directives */
  federation?: boolean;
  /** Custom scalar definitions */
  customScalars?: Record<string, string>;
  /** Generate mutations for behaviors */
  generateMutations?: boolean;
  /** Generate queries for entities */
  generateQueries?: boolean;
  /** Generate subscriptions for events */
  generateSubscriptions?: boolean;
}

interface ParsedDomain {
  name: string;
  version: string;
  entities: ParsedEntity[];
  behaviors: ParsedBehavior[];
  types: ParsedType[];
  enums: ParsedEnum[];
}

interface ParsedEntity {
  name: string;
  fields: ParsedField[];
  description?: string;
}

interface ParsedBehavior {
  name: string;
  description: string;
  input: ParsedField[];
  output: {
    success: string;
    errors: Array<{ name: string; description: string }>;
  };
}

interface ParsedField {
  name: string;
  type: string;
  optional: boolean;
  annotations: string[];
  description?: string;
}

interface ParsedType {
  name: string;
  baseType: string;
  constraints?: Record<string, unknown>;
}

interface ParsedEnum {
  name: string;
  values: string[];
  description?: string;
}

export class SchemaGenerator {
  private options: Required<SchemaGeneratorOptions>;
  private domain: ParsedDomain | null = null;

  constructor(options: SchemaGeneratorOptions = {}) {
    this.options = {
      includeDescriptions: options.includeDescriptions ?? true,
      includeValidation: options.includeValidation ?? true,
      federation: options.federation ?? false,
      customScalars: options.customScalars ?? {},
      generateMutations: options.generateMutations ?? true,
      generateQueries: options.generateQueries ?? true,
      generateSubscriptions: options.generateSubscriptions ?? true,
    };
  }

  /**
   * Generate GraphQL schema from ISL content
   */
  generate(islContent: string): string {
    this.domain = this.parseISL(islContent);
    const parts: string[] = [];

    // Schema directives
    parts.push(this.generateDirectives());

    // Custom scalars
    parts.push(this.generateScalars());

    // Enums
    for (const enumDef of this.domain.enums) {
      parts.push(this.generateEnum(enumDef));
    }

    // Types
    for (const entity of this.domain.entities) {
      parts.push(this.generateType(entity));
      parts.push(this.generateInputType(entity));
    }

    // Error types
    parts.push(this.generateErrorTypes());

    // Result union types
    for (const behavior of this.domain.behaviors) {
      parts.push(this.generateResultType(behavior));
    }

    // Query type
    if (this.options.generateQueries) {
      parts.push(this.generateQueryType());
    }

    // Mutation type
    if (this.options.generateMutations) {
      parts.push(this.generateMutationType());
    }

    // Subscription type
    if (this.options.generateSubscriptions) {
      parts.push(this.generateSubscriptionType());
    }

    // Schema definition
    parts.push(this.generateSchemaDefinition());

    return parts.filter(Boolean).join('\n\n');
  }

  /**
   * Generate directives
   */
  private generateDirectives(): string {
    const directives: string[] = [];

    if (this.options.includeValidation) {
      directives.push(`
directive @constraint(
  minLength: Int
  maxLength: Int
  min: Float
  max: Float
  pattern: String
  format: String
) on INPUT_FIELD_DEFINITION | ARGUMENT_DEFINITION`);
    }

    if (this.options.federation) {
      directives.push(`
directive @key(fields: String!) on OBJECT | INTERFACE
directive @extends on OBJECT | INTERFACE
directive @external on FIELD_DEFINITION
directive @requires(fields: String!) on FIELD_DEFINITION
directive @provides(fields: String!) on FIELD_DEFINITION`);
    }

    directives.push(`
directive @deprecated(reason: String) on FIELD_DEFINITION | ENUM_VALUE`);

    return directives.join('\n');
  }

  /**
   * Generate scalar definitions
   */
  private generateScalars(): string {
    const scalars = [
      'scalar DateTime',
      'scalar Date',
      'scalar UUID',
      'scalar JSON',
      'scalar Decimal',
      'scalar Duration',
      'scalar Email',
      'scalar URL',
    ];

    // Add custom scalars
    for (const [name, description] of Object.entries(this.options.customScalars)) {
      scalars.push(`"""${description}"""\nscalar ${name}`);
    }

    return scalars.join('\n');
  }

  /**
   * Generate enum type
   */
  private generateEnum(enumDef: ParsedEnum): string {
    const description = this.options.includeDescriptions && enumDef.description
      ? `"""${enumDef.description}"""\n`
      : '';

    const values = enumDef.values.map((v) => `  ${v}`).join('\n');

    return `${description}enum ${enumDef.name} {\n${values}\n}`;
  }

  /**
   * Generate GraphQL type from entity
   */
  private generateType(entity: ParsedEntity): string {
    const description = this.options.includeDescriptions && entity.description
      ? `"""${entity.description}"""\n`
      : '';

    const fields = entity.fields.map((f) => this.generateField(f)).join('\n');

    let federationKey = '';
    if (this.options.federation) {
      const idField = entity.fields.find((f) => f.name === 'id');
      if (idField) {
        federationKey = ' @key(fields: "id")';
      }
    }

    return `${description}type ${entity.name}${federationKey} {\n${fields}\n}`;
  }

  /**
   * Generate input type for entity
   */
  private generateInputType(entity: ParsedEntity): string {
    const inputFields = entity.fields
      .filter((f) => !f.annotations.includes('computed') && !f.annotations.includes('immutable'))
      .map((f) => this.generateInputField(f))
      .join('\n');

    return `input ${entity.name}Input {\n${inputFields}\n}`;
  }

  /**
   * Generate field definition
   */
  private generateField(field: ParsedField): string {
    const description = this.options.includeDescriptions && field.description
      ? `  """${field.description}"""\n`
      : '';

    const graphqlType = this.convertType(field.type, !field.optional);
    const deprecated = field.annotations.includes('deprecated')
      ? ' @deprecated(reason: "No longer supported")'
      : '';

    return `${description}  ${field.name}: ${graphqlType}${deprecated}`;
  }

  /**
   * Generate input field with validation
   */
  private generateInputField(field: ParsedField): string {
    const graphqlType = this.convertType(field.type, !field.optional);
    let constraints = '';

    if (this.options.includeValidation) {
      const constraintParts: string[] = [];

      for (const annotation of field.annotations) {
        if (annotation.startsWith('min:')) {
          constraintParts.push(`min: ${annotation.slice(4)}`);
        }
        if (annotation.startsWith('max:')) {
          constraintParts.push(`max: ${annotation.slice(4)}`);
        }
        if (annotation.startsWith('minLength:')) {
          constraintParts.push(`minLength: ${annotation.slice(10)}`);
        }
        if (annotation.startsWith('maxLength:')) {
          constraintParts.push(`maxLength: ${annotation.slice(10)}`);
        }
        if (annotation.startsWith('pattern:')) {
          constraintParts.push(`pattern: "${annotation.slice(8)}"`);
        }
      }

      // Type-based constraints
      if (field.type === 'Email') {
        constraintParts.push('format: "email"');
      }
      if (field.type === 'URL') {
        constraintParts.push('format: "uri"');
      }

      if (constraintParts.length > 0) {
        constraints = ` @constraint(${constraintParts.join(', ')})`;
      }
    }

    return `  ${field.name}: ${graphqlType}${constraints}`;
  }

  /**
   * Convert ISL type to GraphQL type
   */
  private convertType(type: string, required: boolean): string {
    let graphqlType: string;

    switch (type) {
      case 'String':
        graphqlType = 'String';
        break;
      case 'Int':
        graphqlType = 'Int';
        break;
      case 'Float':
      case 'Decimal':
        graphqlType = 'Float';
        break;
      case 'Boolean':
        graphqlType = 'Boolean';
        break;
      case 'UUID':
        graphqlType = 'UUID';
        break;
      case 'Timestamp':
      case 'DateTime':
        graphqlType = 'DateTime';
        break;
      case 'Date':
        graphqlType = 'Date';
        break;
      case 'Duration':
        graphqlType = 'Duration';
        break;
      case 'Email':
        graphqlType = 'Email';
        break;
      case 'URL':
        graphqlType = 'URL';
        break;
      case 'JSON':
        graphqlType = 'JSON';
        break;
      default:
        // Handle List<T>
        if (type.startsWith('List<')) {
          const innerType = type.slice(5, -1);
          graphqlType = `[${this.convertType(innerType, true)}]`;
        } else {
          // Assume it's a custom type (entity or enum)
          graphqlType = type;
        }
    }

    return required ? `${graphqlType}!` : graphqlType;
  }

  /**
   * Generate error types
   */
  private generateErrorTypes(): string {
    return `
interface Error {
  code: String!
  message: String!
  path: [String!]
}

type ValidationError implements Error {
  code: String!
  message: String!
  path: [String!]
  field: String!
  constraint: String!
}

type BusinessError implements Error {
  code: String!
  message: String!
  path: [String!]
  retriable: Boolean!
}`;
  }

  /**
   * Generate result union type for behavior
   */
  private generateResultType(behavior: ParsedBehavior): string {
    const successType = behavior.output.success;
    const errorTypes = behavior.output.errors.map((e) => `${behavior.name}${e.name}Error`);

    // Generate error types for this behavior
    const errorTypeDefs = behavior.output.errors.map((e) => `
type ${behavior.name}${e.name}Error implements Error {
  code: String!
  message: String!
  path: [String!]
}`).join('\n');

    const unionMembers = [successType, ...errorTypes].join(' | ');

    return `${errorTypeDefs}

union ${behavior.name}Result = ${unionMembers}`;
  }

  /**
   * Generate Query type
   */
  private generateQueryType(): string {
    const queries: string[] = [];

    // Entity queries
    for (const entity of this.domain!.entities) {
      const entityName = entity.name;
      const entityNameLower = entityName.charAt(0).toLowerCase() + entityName.slice(1);

      queries.push(`  """Get ${entityName} by ID"""\n  ${entityNameLower}(id: UUID!): ${entityName}`);
      queries.push(`  """List all ${entityName}s"""\n  ${entityNameLower}s(first: Int, after: String, filter: ${entityName}Filter): ${entityName}Connection!`);
    }

    // Generate filter input types
    const filterTypes = this.domain!.entities.map((e) => this.generateFilterType(e)).join('\n\n');

    // Generate connection types
    const connectionTypes = this.domain!.entities.map((e) => this.generateConnectionType(e)).join('\n\n');

    return `${filterTypes}

${connectionTypes}

type Query {
${queries.join('\n')}
}`;
  }

  /**
   * Generate filter input type
   */
  private generateFilterType(entity: ParsedEntity): string {
    const filterFields = entity.fields
      .filter((f) => ['String', 'Int', 'Boolean', 'UUID'].includes(f.type) || 
                     this.domain!.enums.some((e) => e.name === f.type))
      .map((f) => {
        if (f.type === 'String') {
          return `  ${f.name}: StringFilter`;
        }
        if (f.type === 'Int') {
          return `  ${f.name}: IntFilter`;
        }
        if (f.type === 'Boolean') {
          return `  ${f.name}: Boolean`;
        }
        return `  ${f.name}: ${f.type}`;
      })
      .join('\n');

    return `input ${entity.name}Filter {
${filterFields}
  AND: [${entity.name}Filter!]
  OR: [${entity.name}Filter!]
}

input StringFilter {
  eq: String
  ne: String
  contains: String
  startsWith: String
  endsWith: String
  in: [String!]
}

input IntFilter {
  eq: Int
  ne: Int
  gt: Int
  gte: Int
  lt: Int
  lte: Int
  in: [Int!]
}`;
  }

  /**
   * Generate connection type for pagination
   */
  private generateConnectionType(entity: ParsedEntity): string {
    return `type ${entity.name}Connection {
  edges: [${entity.name}Edge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type ${entity.name}Edge {
  node: ${entity.name}!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}`;
  }

  /**
   * Generate Mutation type
   */
  private generateMutationType(): string {
    const mutations: string[] = [];

    for (const behavior of this.domain!.behaviors) {
      const inputTypeName = `${behavior.name}Input`;
      const resultTypeName = `${behavior.name}Result`;

      // Generate input type for behavior
      const inputFields = behavior.input.map((f) => this.generateInputField(f)).join('\n');

      mutations.push(`input ${inputTypeName} {\n${inputFields}\n}`);

      const description = this.options.includeDescriptions
        ? `  """${behavior.description}"""\n`
        : '';

      mutations.push(`${description}  ${this.toCamelCase(behavior.name)}(input: ${inputTypeName}!): ${resultTypeName}!`);
    }

    const mutationDefs = mutations.filter((m) => m.startsWith('input')).join('\n\n');
    const mutationFields = mutations.filter((m) => !m.startsWith('input')).join('\n');

    return `${mutationDefs}

type Mutation {
${mutationFields}
}`;
  }

  /**
   * Generate Subscription type
   */
  private generateSubscriptionType(): string {
    const subscriptions: string[] = [];

    for (const entity of this.domain!.entities) {
      const entityName = entity.name;
      subscriptions.push(`  ${this.toCamelCase(entityName)}Created: ${entityName}!`);
      subscriptions.push(`  ${this.toCamelCase(entityName)}Updated(id: UUID!): ${entityName}!`);
      subscriptions.push(`  ${this.toCamelCase(entityName)}Deleted(id: UUID!): UUID!`);
    }

    return `type Subscription {
${subscriptions.join('\n')}
}`;
  }

  /**
   * Generate schema definition
   */
  private generateSchemaDefinition(): string {
    const types: string[] = [];
    
    if (this.options.generateQueries) types.push('query: Query');
    if (this.options.generateMutations) types.push('mutation: Mutation');
    if (this.options.generateSubscriptions) types.push('subscription: Subscription');

    return `schema {
  ${types.join('\n  ')}
}`;
  }

  private toCamelCase(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  /**
   * Parse ISL content
   */
  private parseISL(content: string): ParsedDomain {
    const domain: ParsedDomain = {
      name: '',
      version: '1.0.0',
      entities: [],
      behaviors: [],
      types: [],
      enums: [],
    };

    // Extract domain name
    const domainMatch = content.match(/domain\s+(\w+)\s*\{/);
    if (domainMatch) {
      domain.name = domainMatch[1];
    }

    // Extract entities
    const entityRegex = /entity\s+(\w+)\s*\{([^}]+)\}/g;
    let entityMatch;
    while ((entityMatch = entityRegex.exec(content)) !== null) {
      const name = entityMatch[1];
      const body = entityMatch[2];
      const fields = this.parseFields(body);
      domain.entities.push({ name, fields });
    }

    // Extract behaviors
    const behaviorRegex = /behavior\s+(\w+)\s*\{([\s\S]*?)(?=\n\s*(?:behavior|entity|enum|type|invariants|\}))/g;
    let behaviorMatch;
    while ((behaviorMatch = behaviorRegex.exec(content)) !== null) {
      const name = behaviorMatch[1];
      const body = behaviorMatch[2];
      const behavior = this.parseBehavior(name, body);
      domain.behaviors.push(behavior);
    }

    // Extract enums
    const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g;
    let enumMatch;
    while ((enumMatch = enumRegex.exec(content)) !== null) {
      const name = enumMatch[1];
      const body = enumMatch[2];
      const values = body.match(/\b[A-Z][A-Z0-9_]+\b/g) ?? [];
      domain.enums.push({ name, values });
    }

    return domain;
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

  private parseBehavior(name: string, body: string): ParsedBehavior {
    const behavior: ParsedBehavior = {
      name,
      description: name,
      input: [],
      output: { success: 'Boolean', errors: [] },
    };

    const descMatch = body.match(/description\s*:\s*"([^"]+)"/);
    if (descMatch) {
      behavior.description = descMatch[1];
    }

    const inputMatch = body.match(/input\s*\{([^}]+)\}/);
    if (inputMatch) {
      behavior.input = this.parseFields(inputMatch[1]);
    }

    const outputMatch = body.match(/output\s*\{([\s\S]*?)\n\s*\}/);
    if (outputMatch) {
      const outputBody = outputMatch[1];

      const successMatch = outputBody.match(/success\s*:\s*(\w+)/);
      if (successMatch) {
        behavior.output.success = successMatch[1];
      }

      const errorRegex = /(\w+)\s*\{[^}]*when\s*:\s*"([^"]+)"[^}]*\}/g;
      let errorMatch;
      while ((errorMatch = errorRegex.exec(outputBody)) !== null) {
        behavior.output.errors.push({
          name: errorMatch[1],
          description: errorMatch[2],
        });
      }
    }

    return behavior;
  }
}

/**
 * Generate GraphQL schema from ISL
 */
export function generateSchema(
  islContent: string,
  options?: SchemaGeneratorOptions
): string {
  const generator = new SchemaGenerator(options);
  return generator.generate(islContent);
}
