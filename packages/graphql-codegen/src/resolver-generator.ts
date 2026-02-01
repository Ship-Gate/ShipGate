/**
 * GraphQL Resolver Generator
 *
 * Generate resolver implementations from ISL specifications.
 */

export interface ResolverGeneratorOptions {
  /** Output language */
  language?: 'typescript' | 'javascript';
  /** Include validation */
  includeValidation?: boolean;
  /** Include authorization checks */
  includeAuth?: boolean;
  /** Include error handling */
  includeErrorHandling?: boolean;
  /** Include DataLoader usage */
  includeDataLoaders?: boolean;
  /** Include tracing */
  includeTracing?: boolean;
}

interface ParsedDomain {
  name: string;
  entities: ParsedEntity[];
  behaviors: ParsedBehavior[];
  enums: ParsedEnum[];
}

interface ParsedEntity {
  name: string;
  fields: ParsedField[];
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
}

interface ParsedEnum {
  name: string;
  values: string[];
}

export class ResolverGenerator {
  private options: Required<ResolverGeneratorOptions>;
  private domain: ParsedDomain | null = null;

  constructor(options: ResolverGeneratorOptions = {}) {
    this.options = {
      language: options.language ?? 'typescript',
      includeValidation: options.includeValidation ?? true,
      includeAuth: options.includeAuth ?? true,
      includeErrorHandling: options.includeErrorHandling ?? true,
      includeDataLoaders: options.includeDataLoaders ?? true,
      includeTracing: options.includeTracing ?? true,
    };
  }

  /**
   * Generate resolvers from ISL content
   */
  generate(islContent: string): string {
    this.domain = this.parseISL(islContent);
    const parts: string[] = [];

    // Imports
    parts.push(this.generateImports());

    // Types
    parts.push(this.generateTypes());

    // Query resolvers
    parts.push(this.generateQueryResolvers());

    // Mutation resolvers
    parts.push(this.generateMutationResolvers());

    // Subscription resolvers
    parts.push(this.generateSubscriptionResolvers());

    // Entity resolvers
    for (const entity of this.domain.entities) {
      parts.push(this.generateEntityResolvers(entity));
    }

    // Main resolver export
    parts.push(this.generateResolverExport());

    return parts.filter(Boolean).join('\n\n');
  }

  /**
   * Generate imports
   */
  private generateImports(): string {
    const imports: string[] = [];

    if (this.options.language === 'typescript') {
      imports.push(`import { GraphQLResolveInfo } from 'graphql';`);
      imports.push(`import { PubSub } from 'graphql-subscriptions';`);

      if (this.options.includeDataLoaders) {
        imports.push(`import DataLoader from 'dataloader';`);
      }

      if (this.options.includeTracing) {
        imports.push(`import { trace, SpanKind } from '@opentelemetry/api';`);
      }
    }

    return imports.join('\n');
  }

  /**
   * Generate TypeScript types
   */
  private generateTypes(): string {
    if (this.options.language !== 'typescript') return '';

    const types: string[] = [];

    // Context type
    types.push(`
export interface Context {
  user?: {
    id: string;
    roles: string[];
  };
  dataSources: DataSources;
  loaders: DataLoaders;
  pubsub: PubSub;
}

export interface DataSources {
  ${this.domain!.entities.map((e) => `${this.toCamelCase(e.name)}Service: ${e.name}Service;`).join('\n  ')}
}

export interface DataLoaders {
  ${this.domain!.entities.map((e) => `${this.toCamelCase(e.name)}Loader: DataLoader<string, ${e.name} | null>;`).join('\n  ')}
}`);

    // Entity types
    for (const entity of this.domain!.entities) {
      const fields = entity.fields
        .map((f) => `  ${f.name}${f.optional ? '?' : ''}: ${this.toTsType(f.type)};`)
        .join('\n');

      types.push(`
export interface ${entity.name} {
${fields}
}`);
    }

    // Input types
    for (const behavior of this.domain!.behaviors) {
      const fields = behavior.input
        .map((f) => `  ${f.name}${f.optional ? '?' : ''}: ${this.toTsType(f.type)};`)
        .join('\n');

      types.push(`
export interface ${behavior.name}Input {
${fields}
}`);
    }

    return types.join('\n');
  }

  /**
   * Generate Query resolvers
   */
  private generateQueryResolvers(): string {
    const resolvers: string[] = [];

    for (const entity of this.domain!.entities) {
      const entityName = entity.name;
      const entityNameLower = this.toCamelCase(entityName);

      // Single entity query
      resolvers.push(`
  async ${entityNameLower}(
    _parent: unknown,
    args: { id: string },
    context: Context,
    info: GraphQLResolveInfo
  ): Promise<${entityName} | null> {
    ${this.generateTracingStart(`Query.${entityNameLower}`)}
    ${this.generateAuthCheck('read', entityName)}
    
    try {
      const result = await context.loaders.${entityNameLower}Loader.load(args.id);
      ${this.generateTracingEnd()}
      return result;
    } catch (error) {
      ${this.generateErrorHandling()}
      throw error;
    }
  }`);

      // List query with pagination
      resolvers.push(`
  async ${entityNameLower}s(
    _parent: unknown,
    args: { first?: number; after?: string; filter?: ${entityName}Filter },
    context: Context,
    info: GraphQLResolveInfo
  ): Promise<${entityName}Connection> {
    ${this.generateTracingStart(`Query.${entityNameLower}s`)}
    ${this.generateAuthCheck('list', entityName)}
    
    try {
      const { first = 20, after, filter } = args;
      const result = await context.dataSources.${entityNameLower}Service.list({
        first,
        after,
        filter,
      });
      ${this.generateTracingEnd()}
      return result;
    } catch (error) {
      ${this.generateErrorHandling()}
      throw error;
    }
  }`);
    }

    return `const Query = {
${resolvers.join(',\n')}
};`;
  }

  /**
   * Generate Mutation resolvers
   */
  private generateMutationResolvers(): string {
    const resolvers: string[] = [];

    for (const behavior of this.domain!.behaviors) {
      const methodName = this.toCamelCase(behavior.name);

      resolvers.push(`
  async ${methodName}(
    _parent: unknown,
    args: { input: ${behavior.name}Input },
    context: Context,
    info: GraphQLResolveInfo
  ): Promise<${behavior.name}Result> {
    ${this.generateTracingStart(`Mutation.${methodName}`)}
    ${this.generateAuthCheck('execute', behavior.name)}
    ${this.generateValidation(behavior)}
    
    try {
      const result = await context.dataSources.${this.getServiceName(behavior)}.${methodName}(args.input);
      
      // Publish subscription event
      context.pubsub.publish('${behavior.name.toUpperCase()}_EXECUTED', {
        ${methodName}Executed: result,
      });
      
      ${this.generateTracingEnd()}
      return result;
    } catch (error) {
      ${this.generateErrorHandling()}
      return this.handleError(error, '${behavior.name}');
    }
  }`);
    }

    resolvers.push(`
  handleError(error: unknown, behavior: string): BusinessError {
    const err = error as Error;
    return {
      __typename: \`\${behavior}Error\`,
      code: err.name ?? 'INTERNAL_ERROR',
      message: err.message ?? 'An unexpected error occurred',
      path: [],
      retriable: false,
    };
  }`);

    return `const Mutation = {
${resolvers.join(',\n')}
};`;
  }

  /**
   * Generate Subscription resolvers
   */
  private generateSubscriptionResolvers(): string {
    const resolvers: string[] = [];

    for (const entity of this.domain!.entities) {
      const entityNameLower = this.toCamelCase(entity.name);

      resolvers.push(`
  ${entityNameLower}Created: {
    subscribe: (_: unknown, __: unknown, context: Context) => {
      ${this.generateAuthCheck('subscribe', entity.name)}
      return context.pubsub.asyncIterator(['${entity.name.toUpperCase()}_CREATED']);
    },
  }`);

      resolvers.push(`
  ${entityNameLower}Updated: {
    subscribe: (_: unknown, args: { id: string }, context: Context) => {
      ${this.generateAuthCheck('subscribe', entity.name)}
      return context.pubsub.asyncIterator([\`${entity.name.toUpperCase()}_UPDATED_\${args.id}\`]);
    },
  }`);

      resolvers.push(`
  ${entityNameLower}Deleted: {
    subscribe: (_: unknown, args: { id: string }, context: Context) => {
      ${this.generateAuthCheck('subscribe', entity.name)}
      return context.pubsub.asyncIterator([\`${entity.name.toUpperCase()}_DELETED_\${args.id}\`]);
    },
  }`);
    }

    return `const Subscription = {
${resolvers.join(',\n')}
};`;
  }

  /**
   * Generate entity resolvers for relationships
   */
  private generateEntityResolvers(entity: ParsedEntity): string {
    const resolvers: string[] = [];

    // Find reference fields
    for (const field of entity.fields) {
      const refEntity = this.domain!.entities.find((e) => e.name === field.type);
      if (refEntity) {
        const fieldNameLower = this.toCamelCase(refEntity.name);

        resolvers.push(`
  ${field.name}: async (
    parent: ${entity.name},
    _args: unknown,
    context: Context
  ): Promise<${refEntity.name} | null> => {
    if (!parent.${field.name}) return null;
    return context.loaders.${fieldNameLower}Loader.load(parent.${field.name});
  }`);
      }

      // Handle List<EntityType>
      if (field.type.startsWith('List<')) {
        const innerType = field.type.slice(5, -1);
        const refEntity = this.domain!.entities.find((e) => e.name === innerType);
        if (refEntity) {
          const fieldNameLower = this.toCamelCase(refEntity.name);

          resolvers.push(`
  ${field.name}: async (
    parent: ${entity.name},
    _args: unknown,
    context: Context
  ): Promise<${refEntity.name}[]> => {
    if (!parent.${field.name} || parent.${field.name}.length === 0) return [];
    return context.loaders.${fieldNameLower}Loader.loadMany(parent.${field.name});
  }`);
        }
      }
    }

    if (resolvers.length === 0) return '';

    return `const ${entity.name} = {
${resolvers.join(',\n')}
};`;
  }

  /**
   * Generate main resolver export
   */
  private generateResolverExport(): string {
    const entityResolverNames = this.domain!.entities
      .filter((e) => this.hasRelationships(e))
      .map((e) => e.name);

    return `export const resolvers = {
  Query,
  Mutation,
  Subscription,
  ${entityResolverNames.join(',\n  ')}
};`;
  }

  private hasRelationships(entity: ParsedEntity): boolean {
    return entity.fields.some((f) => 
      this.domain!.entities.some((e) => e.name === f.type) ||
      (f.type.startsWith('List<') && 
        this.domain!.entities.some((e) => e.name === f.type.slice(5, -1)))
    );
  }

  private generateTracingStart(operationName: string): string {
    if (!this.options.includeTracing) return '';
    return `
    const tracer = trace.getTracer('graphql');
    const span = tracer.startSpan('${operationName}', { kind: SpanKind.SERVER });`;
  }

  private generateTracingEnd(): string {
    if (!this.options.includeTracing) return '';
    return `
      span.end();`;
  }

  private generateAuthCheck(action: string, resource: string): string {
    if (!this.options.includeAuth) return '';
    return `
    if (!context.user) {
      throw new Error('Authentication required');
    }
    // TODO: Add authorization check for ${action} on ${resource}`;
  }

  private generateValidation(behavior: ParsedBehavior): string {
    if (!this.options.includeValidation) return '';
    return `
    // Validate input
    const validationErrors = validate${behavior.name}Input(args.input);
    if (validationErrors.length > 0) {
      return {
        __typename: '${behavior.name}ValidationError',
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        path: [],
        fields: validationErrors,
      };
    }`;
  }

  private generateErrorHandling(): string {
    if (!this.options.includeErrorHandling) return '';
    return `
      ${this.options.includeTracing ? 'span.recordException(error as Error); span.end();' : ''}
      console.error('Resolver error:', error);`;
  }

  private getServiceName(behavior: ParsedBehavior): string {
    // Infer service from success type
    const successType = behavior.output.success;
    const entity = this.domain!.entities.find((e) => e.name === successType);
    return entity ? this.toCamelCase(entity.name) + 'Service' : 'mainService';
  }

  private toCamelCase(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  private toTsType(type: string): string {
    switch (type) {
      case 'String':
      case 'UUID':
      case 'Email':
      case 'URL':
        return 'string';
      case 'Int':
      case 'Float':
      case 'Decimal':
        return 'number';
      case 'Boolean':
        return 'boolean';
      case 'Timestamp':
      case 'DateTime':
      case 'Date':
        return 'string';
      case 'JSON':
        return 'Record<string, unknown>';
      default:
        if (type.startsWith('List<')) {
          const innerType = type.slice(5, -1);
          return `${this.toTsType(innerType)}[]`;
        }
        return type;
    }
  }

  /**
   * Parse ISL content
   */
  private parseISL(content: string): ParsedDomain {
    const domain: ParsedDomain = {
      name: '',
      entities: [],
      behaviors: [],
      enums: [],
    };

    const domainMatch = content.match(/domain\s+(\w+)\s*\{/);
    if (domainMatch) {
      domain.name = domainMatch[1];
    }

    const entityRegex = /entity\s+(\w+)\s*\{([^}]+)\}/g;
    let entityMatch;
    while ((entityMatch = entityRegex.exec(content)) !== null) {
      domain.entities.push({
        name: entityMatch[1],
        fields: this.parseFields(entityMatch[2]),
      });
    }

    const behaviorRegex = /behavior\s+(\w+)\s*\{([\s\S]*?)(?=\n\s*(?:behavior|entity|enum|type|invariants|\}))/g;
    let behaviorMatch;
    while ((behaviorMatch = behaviorRegex.exec(content)) !== null) {
      domain.behaviors.push(this.parseBehavior(behaviorMatch[1], behaviorMatch[2]));
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
    if (descMatch) behavior.description = descMatch[1];

    const inputMatch = body.match(/input\s*\{([^}]+)\}/);
    if (inputMatch) behavior.input = this.parseFields(inputMatch[1]);

    const outputMatch = body.match(/output\s*\{([\s\S]*?)\n\s*\}/);
    if (outputMatch) {
      const outputBody = outputMatch[1];
      const successMatch = outputBody.match(/success\s*:\s*(\w+)/);
      if (successMatch) behavior.output.success = successMatch[1];

      const errorRegex = /(\w+)\s*\{[^}]*when\s*:\s*"([^"]+)"[^}]*\}/g;
      let errorMatch;
      while ((errorMatch = errorRegex.exec(outputBody)) !== null) {
        behavior.output.errors.push({ name: errorMatch[1], description: errorMatch[2] });
      }
    }

    return behavior;
  }
}

/**
 * Generate resolvers from ISL
 */
export function generateResolvers(
  islContent: string,
  options?: ResolverGeneratorOptions
): string {
  const generator = new ResolverGenerator(options);
  return generator.generate(islContent);
}
