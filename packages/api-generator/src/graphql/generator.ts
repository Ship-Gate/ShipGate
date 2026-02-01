/**
 * GraphQL API Generator
 * 
 * Generates GraphQL schema and resolvers from ISL specs.
 */

import type { GeneratedFile, DomainSpec, BehaviorSpec, EntitySpec, TypeSpec } from '../types.js';

// ============================================================================
// Types
// ============================================================================

export interface GraphQLOptions {
  /** Include subscriptions */
  subscriptions?: boolean;
  /** Include input validation */
  validation?: boolean;
  /** Framework */
  framework?: 'apollo' | 'yoga' | 'mercurius';
  /** Output prefix */
  outputPrefix?: string;
}

// ============================================================================
// GraphQL Generator
// ============================================================================

export class GraphQLGenerator {
  private options: Required<GraphQLOptions>;

  constructor(options: GraphQLOptions = {}) {
    this.options = {
      subscriptions: options.subscriptions ?? false,
      validation: options.validation ?? true,
      framework: options.framework ?? 'apollo',
      outputPrefix: options.outputPrefix ?? '',
    };
  }

  /**
   * Generate GraphQL schema and resolvers
   */
  generate(domain: DomainSpec): GeneratedFile[] {
    return [
      {
        path: `${this.options.outputPrefix}schema.graphql`,
        content: this.generateSchema(domain),
        type: 'schema',
      },
      {
        path: `${this.options.outputPrefix}resolvers.ts`,
        content: this.generateResolvers(domain),
        type: 'handlers',
      },
      {
        path: `${this.options.outputPrefix}types.ts`,
        content: this.generateTypeScriptTypes(domain),
        type: 'types',
      },
    ];
  }

  /**
   * Generate GraphQL schema
   */
  private generateSchema(domain: DomainSpec): string {
    const lines = [
      '# ==========================================================',
      `# Generated GraphQL Schema for ${domain.name}`,
      '# DO NOT EDIT - Auto-generated from ISL',
      '# ==========================================================',
      '',
    ];

    // Generate types for entities
    for (const entity of domain.entities) {
      lines.push(`type ${entity.name} {`);
      for (const field of entity.fields) {
        const gqlType = this.toGraphQLType(field.type, field.optional);
        lines.push(`  ${field.name}: ${gqlType}`);
      }
      lines.push('}');
      lines.push('');
    }

    // Generate input types for behaviors
    for (const behavior of domain.behaviors) {
      if (behavior.input?.fields.length) {
        lines.push(`input ${behavior.name}Input {`);
        for (const field of behavior.input.fields) {
          const gqlType = this.toGraphQLType(field.type, field.optional);
          lines.push(`  ${field.name}: ${gqlType}`);
        }
        lines.push('}');
        lines.push('');
      }

      // Result types
      if (behavior.output) {
        lines.push(`type ${behavior.name}Result {`);
        lines.push('  success: Boolean!');
        lines.push(`  data: ${behavior.output.success}`);
        lines.push(`  error: ${behavior.name}Error`);
        lines.push('}');
        lines.push('');

        if (behavior.output.errors.length > 0) {
          lines.push(`type ${behavior.name}Error {`);
          lines.push(`  code: ${behavior.name}ErrorCode!`);
          lines.push('  message: String!');
          lines.push('}');
          lines.push('');

          lines.push(`enum ${behavior.name}ErrorCode {`);
          for (const error of behavior.output.errors) {
            lines.push(`  ${error.name}`);
          }
          lines.push('}');
          lines.push('');
        }
      }
    }

    // Generate Query type
    lines.push('type Query {');
    for (const behavior of domain.behaviors) {
      if (this.isQuery(behavior)) {
        const args = this.generateArgs(behavior);
        const returnType = behavior.output ? `${behavior.name}Result` : 'Boolean';
        lines.push(`  ${this.toCamelCase(behavior.name)}${args}: ${returnType}!`);
      }
    }
    lines.push('}');
    lines.push('');

    // Generate Mutation type
    const mutations = domain.behaviors.filter(b => !this.isQuery(b));
    if (mutations.length > 0) {
      lines.push('type Mutation {');
      for (const behavior of mutations) {
        const args = this.generateArgs(behavior);
        const returnType = behavior.output ? `${behavior.name}Result` : 'Boolean';
        lines.push(`  ${this.toCamelCase(behavior.name)}${args}: ${returnType}!`);
      }
      lines.push('}');
      lines.push('');
    }

    // Generate Subscription type if enabled
    if (this.options.subscriptions) {
      lines.push('type Subscription {');
      for (const entity of domain.entities) {
        lines.push(`  ${this.toCamelCase(entity.name)}Changed: ${entity.name}!`);
      }
      lines.push('}');
    }

    return lines.join('\n');
  }

  /**
   * Generate resolvers
   */
  private generateResolvers(domain: DomainSpec): string {
    const lines = [
      '/**',
      ` * Generated GraphQL resolvers for ${domain.name}`,
      ' */',
      '',
      "import type { Resolvers } from './types.js';",
      '',
      'export const resolvers: Resolvers = {',
      '  Query: {',
    ];

    // Query resolvers
    for (const behavior of domain.behaviors) {
      if (this.isQuery(behavior)) {
        lines.push(`    ${this.toCamelCase(behavior.name)}: async (_parent, args, context) => {`);
        lines.push('      // TODO: Implement query logic');
        lines.push('      return { success: true, data: null };');
        lines.push('    },');
      }
    }
    lines.push('  },');

    // Mutation resolvers
    const mutations = domain.behaviors.filter(b => !this.isQuery(b));
    if (mutations.length > 0) {
      lines.push('  Mutation: {');
      for (const behavior of mutations) {
        lines.push(`    ${this.toCamelCase(behavior.name)}: async (_parent, args, context) => {`);
        lines.push('      // TODO: Implement mutation logic');
        lines.push('      return { success: true, data: null };');
        lines.push('    },');
      }
      lines.push('  },');
    }

    lines.push('};');

    return lines.join('\n');
  }

  /**
   * Generate TypeScript types for resolvers
   */
  private generateTypeScriptTypes(domain: DomainSpec): string {
    const lines = [
      '/**',
      ` * Generated types for ${domain.name} GraphQL API`,
      ' */',
      '',
      "import { GraphQLResolveInfo } from 'graphql';",
      '',
      'export interface Context {',
      '  // Add your context type here',
      '}',
      '',
    ];

    // Entity types
    for (const entity of domain.entities) {
      lines.push(`export interface ${entity.name} {`);
      for (const field of entity.fields) {
        const tsType = this.toTypeScriptType(field.type);
        const optional = field.optional ? '?' : '';
        lines.push(`  ${field.name}${optional}: ${tsType};`);
      }
      lines.push('}');
      lines.push('');
    }

    // Resolver types
    lines.push('export interface Resolvers {');
    lines.push('  Query: QueryResolvers;');
    if (domain.behaviors.some(b => !this.isQuery(b))) {
      lines.push('  Mutation: MutationResolvers;');
    }
    lines.push('}');
    lines.push('');

    lines.push('export interface QueryResolvers {');
    for (const behavior of domain.behaviors) {
      if (this.isQuery(behavior)) {
        const inputType = behavior.input ? `${behavior.name}Input` : '{}';
        lines.push(`  ${this.toCamelCase(behavior.name)}: (parent: unknown, args: ${inputType}, context: Context, info: GraphQLResolveInfo) => Promise<unknown>;`);
      }
    }
    lines.push('}');

    return lines.join('\n');
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private toGraphQLType(type: string, optional: boolean): string {
    const gqlType = this.mapToGraphQL(type);
    return optional ? gqlType : `${gqlType}!`;
  }

  private mapToGraphQL(type: string): string {
    switch (type) {
      case 'String': return 'String';
      case 'Int': return 'Int';
      case 'Decimal': return 'Float';
      case 'Boolean': return 'Boolean';
      case 'UUID': return 'ID';
      case 'Timestamp': return 'String';
      default: return type;
    }
  }

  private toTypeScriptType(type: string): string {
    switch (type) {
      case 'String': case 'UUID': case 'Timestamp': return 'string';
      case 'Int': case 'Decimal': return 'number';
      case 'Boolean': return 'boolean';
      default: return type;
    }
  }

  private isQuery(behavior: BehaviorSpec): boolean {
    const name = behavior.name.toLowerCase();
    return name.startsWith('get') || name.startsWith('list') || name.startsWith('find');
  }

  private generateArgs(behavior: BehaviorSpec): string {
    if (!behavior.input?.fields.length) return '';
    return `(input: ${behavior.name}Input!)`;
  }

  private toCamelCase(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }
}

export function generateGraphQLApi(domain: DomainSpec, options?: GraphQLOptions): GeneratedFile[] {
  return new GraphQLGenerator(options).generate(domain);
}
