// ============================================================================
// GraphQL Code Generator
// ============================================================================

import type {
  GraphQLGeneratorOptions,
  GeneratedFile,
  GenerationResult,
} from './types';
import { DEFAULT_OPTIONS, ISL_TO_GRAPHQL_TYPES } from './types';

/**
 * ISL AST types
 */
interface ISLEntity {
  name: string;
  properties: ISLProperty[];
  behaviors?: ISLBehavior[];
  invariants?: string[];
  description?: string;
}

interface ISLProperty {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
  constraints?: string[];
}

interface ISLBehavior {
  name: string;
  preconditions?: string[];
  postconditions?: string[];
  input?: ISLProperty[];
  output?: string;
  description?: string;
}

interface ISLDomain {
  name: string;
  entities: ISLEntity[];
  behaviors?: ISLBehavior[];
}

/**
 * Generate GraphQL code from ISL domain
 */
export function generate(
  domain: ISLDomain,
  options: Partial<GraphQLGeneratorOptions> = {}
): GenerationResult {
  const mergedOptions: GraphQLGeneratorOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const files: GeneratedFile[] = [];
  const warnings: string[] = [];
  const statistics = {
    types: 0,
    queries: 0,
    mutations: 0,
    subscriptions: 0,
    totalLines: 0,
  };

  // Generate SDL schema
  const schema = generateSchema(domain, mergedOptions);
  statistics.types = domain.entities.length;
  statistics.queries = domain.entities.length; // One query per entity
  statistics.mutations = domain.entities.length * 3; // CRUD mutations
  statistics.totalLines = schema.split('\n').length;

  if (mergedOptions.generateSDL) {
    files.push({
      path: 'schema.graphql',
      content: schema,
      type: 'schema',
    });
  }

  // Generate TypeScript types
  if (mergedOptions.generateTypes) {
    const typesContent = generateTypeScriptTypes(domain, mergedOptions);
    files.push({
      path: 'types.ts',
      content: typesContent,
      type: 'types',
    });
    statistics.totalLines += typesContent.split('\n').length;
  }

  // Generate resolvers
  if (mergedOptions.generateResolvers) {
    const resolversContent = generateResolvers(domain, mergedOptions);
    files.push({
      path: 'resolvers.ts',
      content: resolversContent,
      type: 'resolver',
    });
    statistics.totalLines += resolversContent.split('\n').length;

    // Generate individual resolver files
    for (const entity of domain.entities) {
      const entityResolverContent = generateEntityResolver(entity, mergedOptions);
      files.push({
        path: `resolvers/${camelCase(entity.name)}.ts`,
        content: entityResolverContent,
        type: 'resolver',
      });
      statistics.totalLines += entityResolverContent.split('\n').length;
    }
  }

  // Generate DataLoaders
  if (mergedOptions.generateDataLoader) {
    const dataLoaderContent = generateDataLoaders(domain, mergedOptions);
    files.push({
      path: 'dataloaders.ts',
      content: dataLoaderContent,
      type: 'dataloader',
    });
    statistics.totalLines += dataLoaderContent.split('\n').length;
  }

  // Generate client hooks
  if (mergedOptions.generateClientHooks) {
    const hooksContent = generateClientHooks(domain, mergedOptions);
    files.push({
      path: 'hooks.ts',
      content: hooksContent,
      type: 'hooks',
    });
    statistics.totalLines += hooksContent.split('\n').length;
  }

  // Generate server setup
  const serverContent = generateServerSetup(domain, mergedOptions);
  files.push({
    path: 'server.ts',
    content: serverContent,
    type: 'config',
  });
  statistics.totalLines += serverContent.split('\n').length;

  return {
    files,
    schema,
    warnings,
    statistics,
  };
}

/**
 * Generate GraphQL SDL schema
 */
function generateSchema(domain: ISLDomain, options: GraphQLGeneratorOptions): string {
  const lines: string[] = [];

  // Custom scalars
  lines.push('# Custom Scalars');
  lines.push('scalar DateTime');
  lines.push('scalar Date');
  lines.push('scalar Time');
  lines.push('scalar JSON');
  lines.push('');

  // ISL directives
  if (options.islDirectives) {
    lines.push('# ISL Validation Directives');
    lines.push('directive @isl_precondition(expression: String!) on FIELD_DEFINITION');
    lines.push('directive @isl_postcondition(expression: String!) on FIELD_DEFINITION');
    lines.push('directive @isl_invariant(expression: String!) on OBJECT');
    lines.push('directive @isl_constraint(min: Int, max: Int, minLength: Int, maxLength: Int, pattern: String) on FIELD_DEFINITION');
    lines.push('');
  }

  // Generate types for each entity
  for (const entity of domain.entities) {
    lines.push(generateEntityType(entity, options));
    lines.push('');
    lines.push(generateInputTypes(entity, options));
    lines.push('');
  }

  // Generate connection types for Relay
  if (options.relayConnections) {
    lines.push('# Relay Connection Types');
    lines.push('interface Node {');
    lines.push('  id: ID!');
    lines.push('}');
    lines.push('');
    lines.push('type PageInfo {');
    lines.push('  hasNextPage: Boolean!');
    lines.push('  hasPreviousPage: Boolean!');
    lines.push('  startCursor: String');
    lines.push('  endCursor: String');
    lines.push('}');
    lines.push('');

    for (const entity of domain.entities) {
      lines.push(generateConnectionType(entity.name, options));
      lines.push('');
    }
  }

  // Generate Query type
  lines.push('# Queries');
  lines.push('type Query {');
  for (const entity of domain.entities) {
    lines.push(generateEntityQueries(entity, options));
  }
  lines.push('}');
  lines.push('');

  // Generate Mutation type
  lines.push('# Mutations');
  lines.push('type Mutation {');
  for (const entity of domain.entities) {
    lines.push(generateEntityMutations(entity, options));
  }
  lines.push('}');

  // Generate Subscription type if enabled
  if (options.generateSubscriptions) {
    lines.push('');
    lines.push('# Subscriptions');
    lines.push('type Subscription {');
    for (const entity of domain.entities) {
      lines.push(generateEntitySubscriptions(entity, options));
    }
    lines.push('}');
  }

  return lines.join('\n');
}

/**
 * Generate entity type
 */
function generateEntityType(entity: ISLEntity, options: GraphQLGeneratorOptions): string {
  const lines: string[] = [];
  const implements_ = options.relayConnections ? ' implements Node' : '';

  if (entity.description) {
    lines.push(`"""${entity.description}"""`);
  }

  // Add invariant directive
  if (options.islDirectives && entity.invariants?.length) {
    for (const inv of entity.invariants) {
      lines.push(`@isl_invariant(expression: "${inv}")`);
    }
  }

  lines.push(`type ${entity.name}${implements_} {`);
  lines.push('  id: ID!');

  for (const prop of entity.properties) {
    const gqlType = convertToGraphQLType(prop.type, prop.required ?? false);
    const description = prop.description ? `  """${prop.description}"""` : '';
    
    if (description) {
      lines.push(description);
    }

    let fieldDef = `  ${camelCase(prop.name)}: ${gqlType}`;

    // Add constraint directives
    if (options.islDirectives && prop.constraints?.length) {
      const constraintArgs = parseConstraints(prop.constraints);
      if (Object.keys(constraintArgs).length > 0) {
        const args = Object.entries(constraintArgs)
          .map(([k, v]) => `${k}: ${typeof v === 'string' ? `"${v}"` : v}`)
          .join(', ');
        fieldDef += ` @isl_constraint(${args})`;
      }
    }

    lines.push(fieldDef);
  }

  lines.push('  createdAt: DateTime!');
  lines.push('  updatedAt: DateTime');
  lines.push('}');

  return lines.join('\n');
}

/**
 * Generate input types
 */
function generateInputTypes(entity: ISLEntity, _options: GraphQLGeneratorOptions): string {
  const lines: string[] = [];

  // Create input
  lines.push(`input ${entity.name}CreateInput {`);
  for (const prop of entity.properties) {
    const gqlType = convertToGraphQLType(prop.type, prop.required ?? false);
    lines.push(`  ${camelCase(prop.name)}: ${gqlType}`);
  }
  lines.push('}');
  lines.push('');

  // Update input
  lines.push(`input ${entity.name}UpdateInput {`);
  for (const prop of entity.properties) {
    const gqlType = convertToGraphQLType(prop.type, false); // All optional for update
    lines.push(`  ${camelCase(prop.name)}: ${gqlType}`);
  }
  lines.push('}');
  lines.push('');

  // Filter input
  lines.push(`input ${entity.name}FilterInput {`);
  lines.push('  id: ID');
  for (const prop of entity.properties) {
    const baseType = ISL_TO_GRAPHQL_TYPES[prop.type.replace('[]', '').replace('?', '')] || 'String';
    lines.push(`  ${camelCase(prop.name)}: ${baseType}`);
  }
  lines.push('}');

  return lines.join('\n');
}

/**
 * Generate connection type for Relay
 */
function generateConnectionType(entityName: string, _options: GraphQLGeneratorOptions): string {
  return `type ${entityName}Edge {
  node: ${entityName}!
  cursor: String!
}

type ${entityName}Connection {
  edges: [${entityName}Edge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}`;
}

/**
 * Generate entity queries
 */
function generateEntityQueries(entity: ISLEntity, options: GraphQLGeneratorOptions): string {
  const name = camelCase(entity.name);
  const lines: string[] = [];

  // Get by ID
  lines.push(`  ${name}(id: ID!): ${entity.name}`);

  // Get all / connection
  if (options.relayConnections) {
    lines.push(`  ${name}s(first: Int, after: String, last: Int, before: String, filter: ${entity.name}FilterInput): ${entity.name}Connection!`);
  } else {
    lines.push(`  ${name}s(skip: Int, limit: Int, filter: ${entity.name}FilterInput): [${entity.name}!]!`);
  }

  return lines.join('\n');
}

/**
 * Generate entity mutations
 */
function generateEntityMutations(entity: ISLEntity, _options: GraphQLGeneratorOptions): string {
  const lines: string[] = [];

  lines.push(`  create${entity.name}(input: ${entity.name}CreateInput!): ${entity.name}!`);
  lines.push(`  update${entity.name}(id: ID!, input: ${entity.name}UpdateInput!): ${entity.name}`);
  lines.push(`  delete${entity.name}(id: ID!): Boolean!`);

  return lines.join('\n');
}

/**
 * Generate entity subscriptions
 */
function generateEntitySubscriptions(entity: ISLEntity, _options: GraphQLGeneratorOptions): string {
  const name = camelCase(entity.name);
  const lines: string[] = [];

  lines.push(`  ${name}Created: ${entity.name}!`);
  lines.push(`  ${name}Updated(id: ID): ${entity.name}!`);
  lines.push(`  ${name}Deleted: ID!`);

  return lines.join('\n');
}

/**
 * Generate TypeScript types
 */
function generateTypeScriptTypes(domain: ISLDomain, _options: GraphQLGeneratorOptions): string {
  const lines: string[] = [];

  lines.push('// Generated GraphQL TypeScript Types');
  lines.push('');
  lines.push('export type Maybe<T> = T | null;');
  lines.push('export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };');
  lines.push('');
  lines.push('// Scalars');
  lines.push('export type Scalars = {');
  lines.push('  ID: string;');
  lines.push('  String: string;');
  lines.push('  Boolean: boolean;');
  lines.push('  Int: number;');
  lines.push('  Float: number;');
  lines.push('  DateTime: Date;');
  lines.push('  Date: string;');
  lines.push('  Time: string;');
  lines.push('  JSON: Record<string, unknown>;');
  lines.push('};');
  lines.push('');

  // Entity types
  for (const entity of domain.entities) {
    lines.push(`export interface ${entity.name} {`);
    lines.push('  __typename?: \'' + entity.name + '\';');
    lines.push('  id: Scalars[\'ID\'];');
    
    for (const prop of entity.properties) {
      const tsType = convertToTypeScriptType(prop.type, prop.required ?? false);
      lines.push(`  ${camelCase(prop.name)}: ${tsType};`);
    }
    
    lines.push('  createdAt: Scalars[\'DateTime\'];');
    lines.push('  updatedAt?: Maybe<Scalars[\'DateTime\']>;');
    lines.push('}');
    lines.push('');

    // Input types
    lines.push(`export interface ${entity.name}CreateInput {`);
    for (const prop of entity.properties) {
      const tsType = convertToTypeScriptType(prop.type, prop.required ?? false);
      lines.push(`  ${camelCase(prop.name)}: ${tsType};`);
    }
    lines.push('}');
    lines.push('');

    lines.push(`export interface ${entity.name}UpdateInput {`);
    for (const prop of entity.properties) {
      const tsType = convertToTypeScriptType(prop.type, false);
      lines.push(`  ${camelCase(prop.name)}?: ${tsType};`);
    }
    lines.push('}');
    lines.push('');
  }

  // Query and Mutation types
  lines.push('export interface Query {');
  for (const entity of domain.entities) {
    const name = camelCase(entity.name);
    lines.push(`  ${name}?: Maybe<${entity.name}>;`);
    lines.push(`  ${name}s: ${entity.name}[];`);
  }
  lines.push('}');
  lines.push('');

  lines.push('export interface Mutation {');
  for (const entity of domain.entities) {
    lines.push(`  create${entity.name}: ${entity.name};`);
    lines.push(`  update${entity.name}?: Maybe<${entity.name}>;`);
    lines.push(`  delete${entity.name}: boolean;`);
  }
  lines.push('}');

  return lines.join('\n');
}

/**
 * Generate resolvers
 */
function generateResolvers(domain: ISLDomain, _options: GraphQLGeneratorOptions): string {
  const lines: string[] = [];

  lines.push('// Generated GraphQL Resolvers');
  lines.push('import type { Resolvers } from \'./types\';');
  
  for (const entity of domain.entities) {
    lines.push(`import { ${camelCase(entity.name)}Resolvers } from './resolvers/${camelCase(entity.name)}';`);
  }
  
  lines.push('');
  lines.push('export const resolvers: Resolvers = {');
  lines.push('  Query: {');
  
  for (const entity of domain.entities) {
    const name = camelCase(entity.name);
    lines.push(`    ...${name}Resolvers.Query,`);
  }
  
  lines.push('  },');
  lines.push('  Mutation: {');
  
  for (const entity of domain.entities) {
    const name = camelCase(entity.name);
    lines.push(`    ...${name}Resolvers.Mutation,`);
  }
  
  lines.push('  },');
  lines.push('};');

  return lines.join('\n');
}

/**
 * Generate entity resolver
 */
function generateEntityResolver(entity: ISLEntity, _options: GraphQLGeneratorOptions): string {
  const name = camelCase(entity.name);
  const className = entity.name;
  
  const lines: string[] = [];
  lines.push('// ' + className + ' Resolvers');
  lines.push('import type { Context } from \'../context\';');
  lines.push('');
  lines.push(`export const ${name}Resolvers = {`);
  lines.push('  Query: {');
  lines.push(`    ${name}: async (_: unknown, { id }: { id: string }, ctx: Context) => {`);
  lines.push(`      return ctx.dataSources.${name}API.getById(id);`);
  lines.push('    },');
  lines.push(`    ${name}s: async (_: unknown, args: { skip?: number; limit?: number }, ctx: Context) => {`);
  lines.push(`      return ctx.dataSources.${name}API.getAll(args);`);
  lines.push('    },');
  lines.push('  },');
  lines.push('  Mutation: {');
  lines.push(`    create${className}: async (_: unknown, { input }: { input: unknown }, ctx: Context) => {`);
  lines.push(`      return ctx.dataSources.${name}API.create(input);`);
  lines.push('    },');
  lines.push(`    update${className}: async (_: unknown, { id, input }: { id: string; input: unknown }, ctx: Context) => {`);
  lines.push(`      return ctx.dataSources.${name}API.update(id, input);`);
  lines.push('    },');
  lines.push(`    delete${className}: async (_: unknown, { id }: { id: string }, ctx: Context) => {`);
  lines.push(`      return ctx.dataSources.${name}API.delete(id);`);
  lines.push('    },');
  lines.push('  },');
  lines.push('};');

  return lines.join('\n');
}

/**
 * Generate DataLoaders
 */
function generateDataLoaders(domain: ISLDomain, _options: GraphQLGeneratorOptions): string {
  const lines: string[] = [];

  lines.push('// Generated DataLoaders');
  lines.push('import DataLoader from \'dataloader\';');
  lines.push('');

  for (const entity of domain.entities) {
    lines.push(`export const create${entity.name}Loader = (getById: (id: string) => Promise<unknown>) => {`);
    lines.push('  return new DataLoader<string, unknown>(async (ids) => {');
    lines.push('    const items = await Promise.all(ids.map(getById));');
    lines.push('    return ids.map((id) => items.find((item: any) => item?.id === id) || null);');
    lines.push('  });');
    lines.push('};');
    lines.push('');
  }

  lines.push('export const createLoaders = (dataSources: any) => ({');
  for (const entity of domain.entities) {
    const name = camelCase(entity.name);
    lines.push(`  ${name}Loader: create${entity.name}Loader((id) => dataSources.${name}API.getById(id)),`);
  }
  lines.push('});');

  return lines.join('\n');
}

/**
 * Generate client hooks
 */
function generateClientHooks(domain: ISLDomain, options: GraphQLGeneratorOptions): string {
  const lines: string[] = [];

  if (options.client === 'apollo-client') {
    lines.push('// Generated Apollo Client Hooks');
    lines.push('import { gql, useQuery, useMutation, useLazyQuery } from \'@apollo/client\';');
    lines.push('import type { QueryHookOptions, MutationHookOptions } from \'@apollo/client\';');
  } else if (options.client === 'urql') {
    lines.push('// Generated URQL Hooks');
    lines.push('import { useQuery, useMutation } from \'urql\';');
  }

  lines.push('');

  for (const entity of domain.entities) {
    const name = camelCase(entity.name);
    const className = entity.name;

    // Query fragment
    lines.push(`export const ${className.toUpperCase()}_FRAGMENT = gql\``);
    lines.push(`  fragment ${className}Fields on ${className} {`);
    lines.push('    id');
    for (const prop of entity.properties) {
      lines.push(`    ${camelCase(prop.name)}`);
    }
    lines.push('    createdAt');
    lines.push('    updatedAt');
    lines.push('  }');
    lines.push('\`;');
    lines.push('');

    // Get by ID query
    lines.push(`export const GET_${className.toUpperCase()} = gql\``);
    lines.push(`  query Get${className}($id: ID!) {`);
    lines.push(`    ${name}(id: $id) {`);
    lines.push(`      ...${className}Fields`);
    lines.push('    }');
    lines.push('  }');
    lines.push(`  \${${className.toUpperCase()}_FRAGMENT}`);
    lines.push('\`;');
    lines.push('');

    // Get all query
    lines.push(`export const GET_${className.toUpperCase()}S = gql\``);
    lines.push(`  query Get${className}s($skip: Int, $limit: Int) {`);
    lines.push(`    ${name}s(skip: $skip, limit: $limit) {`);
    lines.push(`      ...${className}Fields`);
    lines.push('    }');
    lines.push('  }');
    lines.push(`  \${${className.toUpperCase()}_FRAGMENT}`);
    lines.push('\`;');
    lines.push('');

    // Hooks
    if (options.client === 'apollo-client') {
      lines.push(`export const use${className} = (id: string, options?: QueryHookOptions) => {`);
      lines.push(`  return useQuery(GET_${className.toUpperCase()}, { variables: { id }, ...options });`);
      lines.push('};');
      lines.push('');

      lines.push(`export const use${className}s = (variables?: { skip?: number; limit?: number }, options?: QueryHookOptions) => {`);
      lines.push(`  return useQuery(GET_${className.toUpperCase()}S, { variables, ...options });`);
      lines.push('};');
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Generate server setup
 */
function generateServerSetup(domain: ISLDomain, options: GraphQLGeneratorOptions): string {
  if (options.server === 'apollo-server') {
    return generateApolloServerSetup(domain, options);
  } else if (options.server === 'graphql-yoga') {
    return generateYogaServerSetup(domain, options);
  }
  
  return generateApolloServerSetup(domain, options);
}

function generateApolloServerSetup(_domain: ISLDomain, _options: GraphQLGeneratorOptions): string {
  return `// Apollo Server Setup
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { readFileSync } from 'fs';
import { resolvers } from './resolvers';
import { createLoaders } from './dataloaders';

const typeDefs = readFileSync('./schema.graphql', 'utf-8');

interface Context {
  dataSources: any;
  loaders: ReturnType<typeof createLoaders>;
}

const server = new ApolloServer<Context>({
  typeDefs,
  resolvers,
});

async function start() {
  const { url } = await startStandaloneServer(server, {
    listen: { port: 4000 },
    context: async () => {
      const dataSources = {}; // Initialize your data sources
      return {
        dataSources,
        loaders: createLoaders(dataSources),
      };
    },
  });
  console.log(\`🚀 Server ready at \${url}\`);
}

start();
`;
}

function generateYogaServerSetup(_domain: ISLDomain, _options: GraphQLGeneratorOptions): string {
  return `// GraphQL Yoga Server Setup
import { createServer } from 'node:http';
import { createYoga, createSchema } from 'graphql-yoga';
import { readFileSync } from 'fs';
import { resolvers } from './resolvers';

const typeDefs = readFileSync('./schema.graphql', 'utf-8');

const yoga = createYoga({
  schema: createSchema({
    typeDefs,
    resolvers,
  }),
});

const server = createServer(yoga);

server.listen(4000, () => {
  console.log('🚀 Server ready at http://localhost:4000/graphql');
});
`;
}

// Utility functions
function camelCase(str: string): string {
  const pascal = str
    .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toUpperCase());
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function convertToGraphQLType(islType: string, required: boolean): string {
  let baseType = islType;
  let isList = false;

  if (baseType.endsWith('[]')) {
    isList = true;
    baseType = baseType.slice(0, -2);
  }

  if (baseType.endsWith('?')) {
    required = false;
    baseType = baseType.slice(0, -1);
  }

  const gqlType = ISL_TO_GRAPHQL_TYPES[baseType] || 'String';
  let result = gqlType;

  if (isList) {
    result = `[${result}!]`;
  }

  if (required) {
    result += '!';
  }

  return result;
}

function convertToTypeScriptType(islType: string, required: boolean): string {
  const typeMap: Record<string, string> = {
    'String': 'string',
    'Int': 'number',
    'Float': 'number',
    'Boolean': 'boolean',
    'DateTime': 'Date',
    'Date': 'string',
    'Time': 'string',
    'UUID': 'string',
    'JSON': 'Record<string, unknown>',
  };

  let baseType = islType;
  let isList = false;

  if (baseType.endsWith('[]')) {
    isList = true;
    baseType = baseType.slice(0, -2);
  }

  if (baseType.endsWith('?')) {
    required = false;
    baseType = baseType.slice(0, -1);
  }

  let tsType = typeMap[baseType] || 'unknown';

  if (isList) {
    tsType = `${tsType}[]`;
  }

  if (!required) {
    tsType = `Maybe<${tsType}>`;
  }

  return tsType;
}

function parseConstraints(constraints: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const constraint of constraints) {
    if (constraint.startsWith('min:')) {
      result.min = parseInt(constraint.split(':')[1], 10);
    } else if (constraint.startsWith('max:')) {
      result.max = parseInt(constraint.split(':')[1], 10);
    } else if (constraint.startsWith('minLength:')) {
      result.minLength = parseInt(constraint.split(':')[1], 10);
    } else if (constraint.startsWith('maxLength:')) {
      result.maxLength = parseInt(constraint.split(':')[1], 10);
    } else if (constraint.startsWith('pattern:')) {
      result.pattern = constraint.split(':')[1];
    }
  }

  return result;
}

export { generate as generateGraphQL };
