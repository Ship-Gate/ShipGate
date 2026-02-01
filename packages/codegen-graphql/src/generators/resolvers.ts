/**
 * GraphQL Resolvers Generator
 * 
 * Generates resolver implementations for various GraphQL frameworks.
 */

import type {
  DomainDeclaration,
  EntityDeclaration,
  BehaviorDeclaration,
  FieldDeclaration,
} from '@isl-lang/isl-core';

import type {
  GraphQLGeneratorOptions,
  ResolverFramework,
  ResolverDefinition,
  ResolverMap,
} from '../types.js';

/**
 * Generate resolvers for a domain
 */
export function generateResolvers(
  domain: DomainDeclaration,
  options: Partial<GraphQLGeneratorOptions> = {}
): string {
  const framework = options.resolverFramework || 'apollo-server';
  
  switch (framework) {
    case 'apollo-server':
      return generateApolloResolvers(domain, options);
    case 'graphql-yoga':
      return generateYogaResolvers(domain, options);
    case 'pothos':
      return generatePothosResolvers(domain, options);
    case 'type-graphql':
      return generateTypeGraphQLResolvers(domain, options);
    default:
      return generateApolloResolvers(domain, options);
  }
}

/**
 * Generate Apollo Server resolvers
 */
function generateApolloResolvers(
  domain: DomainDeclaration,
  options: Partial<GraphQLGeneratorOptions>
): string {
  const lines: string[] = [];
  
  // Imports
  lines.push(`/**
 * GraphQL Resolvers
 * Generated from ISL domain: ${domain.name.name}
 */

import { GraphQLResolveInfo } from 'graphql';

// Context type - customize based on your application
export interface Context {
  userId?: string;
  dataSources: DataSources;
}

// Data sources - implement these based on your data layer
export interface DataSources {
${domain.entities.map(e => `  ${toCamelCase(e.name.name)}Service: ${e.name.name}Service;`).join('\n')}
}

// Service interfaces
${domain.entities.map(e => generateServiceInterface(e)).join('\n\n')}
`);
  
  // Resolvers object
  lines.push(`export const resolvers = {`);
  
  // Query resolvers
  lines.push('  Query: {');
  for (const entity of domain.entities) {
    lines.push(generateEntityQueryResolvers(entity, options));
  }
  // Behavior queries
  const queries = domain.behaviors.filter(b => !hasSideEffects(b) && !isSubscription(b));
  for (const behavior of queries) {
    lines.push(generateBehaviorResolver(behavior, 'query', options));
  }
  lines.push('  },');
  lines.push('');
  
  // Mutation resolvers
  lines.push('  Mutation: {');
  for (const entity of domain.entities) {
    lines.push(generateEntityMutationResolvers(entity, options));
  }
  // Behavior mutations
  const mutations = domain.behaviors.filter(b => hasSideEffects(b));
  for (const behavior of mutations) {
    lines.push(generateBehaviorResolver(behavior, 'mutation', options));
  }
  lines.push('  },');
  lines.push('');
  
  // Subscription resolvers
  const subscriptions = domain.behaviors.filter(b => isSubscription(b));
  if (subscriptions.length > 0) {
    lines.push('  Subscription: {');
    for (const sub of subscriptions) {
      lines.push(generateSubscriptionResolver(sub, options));
    }
    lines.push('  },');
    lines.push('');
  }
  
  // Type resolvers for relationships
  for (const entity of domain.entities) {
    const relationFields = entity.fields.filter(f => isRelationField(f, domain));
    if (relationFields.length > 0) {
      lines.push(`  ${entity.name.name}: {`);
      for (const field of relationFields) {
        lines.push(generateRelationResolver(entity, field, domain, options));
      }
      lines.push('  },');
    }
  }
  
  lines.push('};');
  
  return lines.join('\n');
}

/**
 * Generate service interface for entity
 */
function generateServiceInterface(entity: EntityDeclaration): string {
  const name = entity.name.name;
  
  return `export interface ${name}Service {
  findById(id: string): Promise<${name} | null>;
  findMany(args: FindManyArgs): Promise<${name}[]>;
  count(where?: ${name}Filter): Promise<number>;
  create(data: ${name}Input): Promise<${name}>;
  update(id: string, data: Partial<${name}Input>): Promise<${name}>;
  delete(id: string): Promise<boolean>;
}`;
}

/**
 * Generate query resolvers for entity
 */
function generateEntityQueryResolvers(
  entity: EntityDeclaration,
  options: Partial<GraphQLGeneratorOptions>
): string {
  const name = entity.name.name;
  const fieldName = toCamelCase(name);
  const pluralName = pluralize(fieldName);
  const serviceName = `${fieldName}Service`;
  
  return `    // ${name} queries
    ${fieldName}: async (_: unknown, { id }: { id: string }, { dataSources }: Context) => {
      return dataSources.${serviceName}.findById(id);
    },

    ${pluralName}: async (
      _: unknown,
      { where, orderBy, first, after, last, before }: ConnectionArgs,
      { dataSources }: Context
    ) => {
      const items = await dataSources.${serviceName}.findMany({
        where,
        orderBy,
        first,
        after,
        last,
        before,
      });
      
      const totalCount = await dataSources.${serviceName}.count(where);
      
      return {
        edges: items.map((item, index) => ({
          node: item,
          cursor: encodeCursor(item.id, index),
        })),
        pageInfo: {
          hasNextPage: first ? items.length === first : false,
          hasPreviousPage: last ? items.length === last : false,
          startCursor: items.length > 0 ? encodeCursor(items[0].id, 0) : null,
          endCursor: items.length > 0 ? encodeCursor(items[items.length - 1].id, items.length - 1) : null,
        },
        totalCount,
      };
    },
`;
}

/**
 * Generate mutation resolvers for entity
 */
function generateEntityMutationResolvers(
  entity: EntityDeclaration,
  options: Partial<GraphQLGeneratorOptions>
): string {
  const name = entity.name.name;
  const fieldName = toCamelCase(name);
  const serviceName = `${fieldName}Service`;
  
  return `    // ${name} mutations
    create${name}: async (
      _: unknown,
      { input }: { input: ${name}Input },
      { dataSources, userId }: Context
    ) => {
      // Add validation/authorization here
      return dataSources.${serviceName}.create(input);
    },

    update${name}: async (
      _: unknown,
      { id, input }: { id: string; input: Partial<${name}Input> },
      { dataSources, userId }: Context
    ) => {
      // Add validation/authorization here
      return dataSources.${serviceName}.update(id, input);
    },

    delete${name}: async (
      _: unknown,
      { id }: { id: string },
      { dataSources, userId }: Context
    ) => {
      // Add validation/authorization here
      return dataSources.${serviceName}.delete(id);
    },
`;
}

/**
 * Generate resolver for behavior
 */
function generateBehaviorResolver(
  behavior: BehaviorDeclaration,
  type: 'query' | 'mutation',
  options: Partial<GraphQLGeneratorOptions>
): string {
  const fieldName = toCamelCase(behavior.name.name);
  
  // Generate args type from input block
  let argsType = 'unknown';
  let argsDestructure = '';
  if (behavior.input?.fields && behavior.input.fields.length > 0) {
    const argNames = behavior.input.fields.map(f => f.name.name);
    argsDestructure = `{ ${argNames.join(', ')} }`;
    argsType = `{ ${argNames.map(n => `${n}: any`).join('; ')} }`;
  }
  
  const description = behavior.description?.value 
    ? `// ${behavior.description.value}` 
    : '';
  
  return `    ${description}
    ${fieldName}: async (
      _: unknown,
      ${argsDestructure || 'args'}: ${argsType},
      { dataSources, userId }: Context,
      info: GraphQLResolveInfo
    ) => {
      // TODO: Implement ${behavior.name.name} logic
      // Preconditions: ${behavior.preconditions?.conditions?.map(c => 'check condition').join(', ') || 'none'}
      // Postconditions: ${behavior.postconditions?.conditions?.map(c => 'verify condition').join(', ') || 'none'}
      throw new Error('Not implemented: ${fieldName}');
    },
`;
}

/**
 * Generate subscription resolver
 */
function generateSubscriptionResolver(
  behavior: BehaviorDeclaration,
  options: Partial<GraphQLGeneratorOptions>
): string {
  const fieldName = toCamelCase(behavior.name.name);
  const topic = toSnakeCase(behavior.name.name).toUpperCase();
  
  return `    ${fieldName}: {
      subscribe: (_: unknown, args: unknown, { pubsub }: Context) => {
        return pubsub.asyncIterator(['${topic}']);
      },
    },
`;
}

/**
 * Generate relation field resolver
 */
function generateRelationResolver(
  entity: EntityDeclaration,
  field: FieldDeclaration,
  domain: DomainDeclaration,
  options: Partial<GraphQLGeneratorOptions>
): string {
  const fieldName = field.name.name;
  const relatedType = getBaseTypeName(field.type);
  const relatedService = `${toCamelCase(relatedType)}Service`;
  
  return `    ${fieldName}: async (parent: ${entity.name.name}, _: unknown, { dataSources }: Context) => {
      // Resolve ${fieldName} relation
      const id = parent.${fieldName}Id || parent.${fieldName};
      if (!id) return null;
      return dataSources.${relatedService}.findById(id);
    },
`;
}

/**
 * Generate GraphQL Yoga resolvers
 */
function generateYogaResolvers(
  domain: DomainDeclaration,
  options: Partial<GraphQLGeneratorOptions>
): string {
  // Similar to Apollo but with Yoga-specific patterns
  const lines: string[] = [];
  
  lines.push(`/**
 * GraphQL Yoga Resolvers
 * Generated from ISL domain: ${domain.name.name}
 */

import { createSchema, createYoga } from 'graphql-yoga';
import { GraphQLError } from 'graphql';

// Your schema would be imported/defined here
// import { typeDefs } from './schema';

export function createResolvers(dataSources: DataSources) {
  return {
    Query: {
${domain.entities.map(e => generateYogaQueryResolver(e)).join('\n')}
    },
    Mutation: {
${domain.entities.map(e => generateYogaMutationResolver(e)).join('\n')}
    },
  };
}
`);
  
  return lines.join('\n');
}

/**
 * Generate Pothos schema builder
 */
function generatePothosResolvers(
  domain: DomainDeclaration,
  options: Partial<GraphQLGeneratorOptions>
): string {
  const lines: string[] = [];
  
  lines.push(`/**
 * Pothos Schema Builder
 * Generated from ISL domain: ${domain.name.name}
 */

import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';

// Initialize builder
const builder = new SchemaBuilder<{
  Context: Context;
  Scalars: {
    DateTime: { Input: Date; Output: Date };
    UUID: { Input: string; Output: string };
  };
}>({
  plugins: [RelayPlugin],
  relayOptions: {
    clientMutationId: 'omit',
    cursorType: 'String',
  },
});

// Add base types
builder.queryType({});
builder.mutationType({});

`);
  
  // Generate types for each entity
  for (const entity of domain.entities) {
    lines.push(generatePothosType(entity, domain));
  }
  
  // Generate queries
  for (const entity of domain.entities) {
    lines.push(generatePothosQueries(entity));
  }
  
  // Generate mutations
  for (const entity of domain.entities) {
    lines.push(generatePothosMutations(entity));
  }
  
  lines.push(`
// Build and export schema
export const schema = builder.toSchema();
`);
  
  return lines.join('\n');
}

/**
 * Generate TypeGraphQL resolvers
 */
function generateTypeGraphQLResolvers(
  domain: DomainDeclaration,
  options: Partial<GraphQLGeneratorOptions>
): string {
  const lines: string[] = [];
  
  lines.push(`/**
 * TypeGraphQL Resolvers
 * Generated from ISL domain: ${domain.name.name}
 */

import {
  Resolver,
  Query,
  Mutation,
  Arg,
  Ctx,
  ID,
  FieldResolver,
  Root,
} from 'type-graphql';

`);
  
  // Generate resolver classes for each entity
  for (const entity of domain.entities) {
    lines.push(generateTypeGraphQLResolver(entity, domain));
  }
  
  return lines.join('\n');
}

// ============================================
// Helper Generators
// ============================================

function generateYogaQueryResolver(entity: EntityDeclaration): string {
  const name = entity.name.name;
  const fieldName = toCamelCase(name);
  
  return `      ${fieldName}: async (_, { id }, context) => {
        return context.dataSources.${fieldName}Service.findById(id);
      },
      ${pluralize(fieldName)}: async (_, args, context) => {
        return context.dataSources.${fieldName}Service.findMany(args);
      },`;
}

function generateYogaMutationResolver(entity: EntityDeclaration): string {
  const name = entity.name.name;
  const fieldName = toCamelCase(name);
  
  return `      create${name}: async (_, { input }, context) => {
        return context.dataSources.${fieldName}Service.create(input);
      },
      update${name}: async (_, { id, input }, context) => {
        return context.dataSources.${fieldName}Service.update(id, input);
      },
      delete${name}: async (_, { id }, context) => {
        return context.dataSources.${fieldName}Service.delete(id);
      },`;
}

function generatePothosType(entity: EntityDeclaration, domain: DomainDeclaration): string {
  const name = entity.name.name;
  
  const fields = entity.fields.map(f => {
    const fieldName = f.name.name;
    const fieldType = getPothosFieldType(f);
    const nullable = f.optional ? 'true' : 'false';
    return `    ${fieldName}: t.expose('${fieldName}', { type: ${fieldType}, nullable: ${nullable} }),`;
  }).join('\n');
  
  return `// ${name} type
builder.objectType('${name}', {
  fields: (t) => ({
${fields}
  }),
});

`;
}

function generatePothosQueries(entity: EntityDeclaration): string {
  const name = entity.name.name;
  const fieldName = toCamelCase(name);
  
  return `// ${name} queries
builder.queryField('${fieldName}', (t) =>
  t.field({
    type: '${name}',
    nullable: true,
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_, { id }, ctx) => {
      return ctx.dataSources.${fieldName}Service.findById(id);
    },
  })
);

builder.queryField('${pluralize(fieldName)}', (t) =>
  t.connection({
    type: '${name}',
    resolve: async (_, args, ctx) => {
      const items = await ctx.dataSources.${fieldName}Service.findMany(args);
      return { edges: items.map(item => ({ node: item })) };
    },
  })
);

`;
}

function generatePothosMutations(entity: EntityDeclaration): string {
  const name = entity.name.name;
  const fieldName = toCamelCase(name);
  
  return `// ${name} mutations
builder.mutationField('create${name}', (t) =>
  t.field({
    type: '${name}',
    args: { input: t.arg({ type: '${name}Input', required: true }) },
    resolve: async (_, { input }, ctx) => {
      return ctx.dataSources.${fieldName}Service.create(input);
    },
  })
);

`;
}

function generateTypeGraphQLResolver(entity: EntityDeclaration, domain: DomainDeclaration): string {
  const name = entity.name.name;
  const fieldName = toCamelCase(name);
  
  return `@Resolver(of => ${name})
export class ${name}Resolver {
  @Query(returns => ${name}, { nullable: true })
  async ${fieldName}(
    @Arg('id', type => ID) id: string,
    @Ctx() ctx: Context
  ): Promise<${name} | null> {
    return ctx.dataSources.${fieldName}Service.findById(id);
  }

  @Query(returns => [${name}])
  async ${pluralize(fieldName)}(@Ctx() ctx: Context): Promise<${name}[]> {
    return ctx.dataSources.${fieldName}Service.findMany({});
  }

  @Mutation(returns => ${name})
  async create${name}(
    @Arg('input') input: ${name}Input,
    @Ctx() ctx: Context
  ): Promise<${name}> {
    return ctx.dataSources.${fieldName}Service.create(input);
  }

  @Mutation(returns => ${name})
  async update${name}(
    @Arg('id', type => ID) id: string,
    @Arg('input') input: ${name}Input,
    @Ctx() ctx: Context
  ): Promise<${name}> {
    return ctx.dataSources.${fieldName}Service.update(id, input);
  }

  @Mutation(returns => Boolean)
  async delete${name}(
    @Arg('id', type => ID) id: string,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    return ctx.dataSources.${fieldName}Service.delete(id);
  }
}

`;
}

// ============================================
// Utility Functions
// ============================================

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

function pluralize(str: string): string {
  if (str.endsWith('s')) return str + 'es';
  if (str.endsWith('y')) return str.slice(0, -1) + 'ies';
  return str + 's';
}

function getBaseTypeName(type: any): string {
  if (type.kind === 'SimpleType') return type.name.name;
  if (type.kind === 'ArrayType') return getBaseTypeName(type.elementType);
  if (type.kind === 'GenericType' && type.typeArguments?.length > 0) {
    return getBaseTypeName(type.typeArguments[0]);
  }
  return 'String';
}

function isRelationField(field: FieldDeclaration, domain: DomainDeclaration): boolean {
  const typeName = getBaseTypeName(field.type);
  return domain.entities.some(e => e.name.name === typeName);
}

function hasSideEffects(behavior: BehaviorDeclaration): boolean {
  if (behavior.postconditions?.conditions) return true;
  const name = behavior.name.name.toLowerCase();
  return name.startsWith('create') || name.startsWith('update') || 
         name.startsWith('delete') || name.startsWith('add') ||
         name.startsWith('remove') || name.startsWith('set');
}

function isSubscription(behavior: BehaviorDeclaration): boolean {
  const name = behavior.name.name.toLowerCase();
  return name.startsWith('on') || name.includes('subscribe') || name.includes('watch');
}

function getPothosFieldType(field: FieldDeclaration): string {
  const typeName = getBaseTypeName(field.type);
  const typeMap: Record<string, string> = {
    String: "'String'",
    Int: "'Int'",
    Float: "'Float'",
    Boolean: "'Boolean'",
    ID: "'ID'",
    UUID: "'UUID'",
    DateTime: "'DateTime'",
  };
  return typeMap[typeName] || `'${typeName}'`;
}
