/**
 * GraphQL Client Generator
 * 
 * Generates client operations (queries, mutations, fragments) and typed hooks.
 */

import type {
  GraphQLGeneratorOptions,
  ClientFramework,
  ClientOutput,
} from '../types.js';

// Simple types for this generator
interface DomainDeclaration {
  name: string;
  entities: EntityDeclaration[];
  behaviors: BehaviorDeclaration[];
}

interface EntityDeclaration {
  name: string;
  fields: FieldDeclaration[];
}

interface BehaviorDeclaration {
  name: string;
  postconditions?: { conditions?: unknown[] };
  input?: { fields: FieldDeclaration[] };
}

interface FieldDeclaration {
  name: string;
  type: string;
  optional?: boolean;
  computed?: boolean;
}

/**
 * Generate GraphQL client code
 */
export function generateClient(
  domain: DomainDeclaration,
  options: Partial<GraphQLGeneratorOptions> = {}
): ClientOutput {
  const framework = options.clientFramework || 'apollo-client';
  
  return {
    queries: generateQueryDocuments(domain, options),
    mutations: generateMutationDocuments(domain, options),
    fragments: generateFragmentDocuments(domain, options),
    operationTypes: generateOperationTypes(domain, options),
    hooks: generateHooks(domain, framework, options),
  };
}

/**
 * Generate query documents
 */
function generateQueryDocuments(
  domain: DomainDeclaration,
  options: Partial<GraphQLGeneratorOptions>
): string {
  const lines: string[] = [];
  
  lines.push(`/**
 * GraphQL Query Documents
 * Generated from ISL domain: ${domain.name}
 */

import { gql } from 'graphql-tag';
`);
  
  // Generate queries for each entity
  for (const entity of domain.entities) {
    const name = entity.name;
    const fieldName = toCamelCase(name);
    const pluralName = pluralize(fieldName);
    const fragmentName = `${name}Fragment`;
    
    // Single item query
    lines.push(`
export const GET_${toConstantCase(name)} = gql\`
  query Get${name}($id: ID!) {
    ${fieldName}(id: $id) {
      ...${fragmentName}
    }
  }
  \${${fragmentName}}
\`;
`);
    
    // List query with pagination
    lines.push(`
export const GET_${toConstantCase(pluralName)} = gql\`
  query Get${toPascalCase(pluralName)}(
    $where: ${name}Filter
    $orderBy: ${name}SortInput
    $first: Int
    $after: String
    $last: Int
    $before: String
  ) {
    ${pluralName}(
      where: $where
      orderBy: $orderBy
      first: $first
      after: $after
      last: $last
      before: $before
    ) {
      edges {
        node {
          ...${fragmentName}
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
  \${${fragmentName}}
\`;
`);
  }
  
  // Generate queries from behaviors
  const queries = domain.behaviors.filter(b => !hasSideEffects(b) && !isSubscription(b));
  for (const behavior of queries) {
    lines.push(generateBehaviorQueryDocument(behavior, options));
  }
  
  return lines.join('\n');
}

/**
 * Generate mutation documents
 */
function generateMutationDocuments(
  domain: DomainDeclaration,
  options: Partial<GraphQLGeneratorOptions>
): string {
  const lines: string[] = [];
  
  lines.push(`/**
 * GraphQL Mutation Documents
 * Generated from ISL domain: ${domain.name}
 */

import { gql } from 'graphql-tag';
`);
  
  // Generate CRUD mutations for each entity
  for (const entity of domain.entities) {
    const name = entity.name;
    const fragmentName = `${name}Fragment`;
    
    // Create mutation
    lines.push(`
export const CREATE_${toConstantCase(name)} = gql\`
  mutation Create${name}($input: ${name}Input!) {
    create${name}(input: $input) {
      ...${fragmentName}
    }
  }
  \${${fragmentName}}
\`;
`);
    
    // Update mutation
    lines.push(`
export const UPDATE_${toConstantCase(name)} = gql\`
  mutation Update${name}($id: ID!, $input: ${name}Input!) {
    update${name}(id: $id, input: $input) {
      ...${fragmentName}
    }
  }
  \${${fragmentName}}
\`;
`);
    
    // Delete mutation
    lines.push(`
export const DELETE_${toConstantCase(name)} = gql\`
  mutation Delete${name}($id: ID!) {
    delete${name}(id: $id)
  }
\`;
`);
  }
  
  // Generate mutations from behaviors
  const mutations = domain.behaviors.filter(b => hasSideEffects(b));
  for (const behavior of mutations) {
    lines.push(generateBehaviorMutationDocument(behavior, options));
  }
  
  return lines.join('\n');
}

/**
 * Generate fragment documents
 */
function generateFragmentDocuments(
  domain: DomainDeclaration,
  options: Partial<GraphQLGeneratorOptions>
): string {
  const lines: string[] = [];
  
  lines.push(`/**
 * GraphQL Fragment Documents
 * Generated from ISL domain: ${domain.name}
 */

import { gql } from 'graphql-tag';
`);
  
  // Generate fragments for each entity
  for (const entity of domain.entities) {
    lines.push(generateEntityFragment(entity, domain, options));
  }
  
  return lines.join('\n');
}

/**
 * Generate fragment for entity
 */
function generateEntityFragment(
  entity: EntityDeclaration,
  domain: DomainDeclaration,
  options: Partial<GraphQLGeneratorOptions>
): string {
  const name = entity.name;
  const fragmentName = `${name}Fragment`;
  
  // Generate field selections
  const fields: string[] = [];
  for (const field of entity.fields) {
    // Skip computed fields for now (they might need special handling)
    if (field.computed) continue;
    
    const fieldName = field.name;
    const typeName = getBaseTypeName(field.type);
    
    // Check if it's a relation
    const isRelation = domain.entities.some(e => e.name === typeName);
    
    if (isRelation) {
      // Include just the ID for relations by default
      fields.push(`${fieldName} { id }`);
    } else {
      fields.push(fieldName);
    }
  }
  
  return `
export const ${fragmentName} = gql\`
  fragment ${fragmentName} on ${name} {
    ${fields.join('\n    ')}
  }
\`;
`;
}

/**
 * Generate behavior query document
 */
function generateBehaviorQueryDocument(
  behavior: BehaviorDeclaration,
  options: Partial<GraphQLGeneratorOptions>
): string {
  const name = behavior.name;
  const fieldName = toCamelCase(name);
  const constName = toConstantCase(name);
  
  // Build args
  const args: string[] = [];
  const argPass: string[] = [];
  
  if (behavior.input?.fields) {
    for (const field of behavior.input.fields) {
      const argName = field.name;
      const argType = islTypeToGraphQLType(field.type);
      const required = field.optional ? '' : '!';
      args.push(`$${argName}: ${argType}${required}`);
      argPass.push(`${argName}: $${argName}`);
    }
  }
  
  const argsStr = args.length > 0 ? `(${args.join(', ')})` : '';
  const passStr = argPass.length > 0 ? `(${argPass.join(', ')})` : '';
  
  return `
export const ${constName} = gql\`
  query ${name}${argsStr} {
    ${fieldName}${passStr}
  }
\`;
`;
}

/**
 * Generate behavior mutation document
 */
function generateBehaviorMutationDocument(
  behavior: BehaviorDeclaration,
  options: Partial<GraphQLGeneratorOptions>
): string {
  const name = behavior.name;
  const fieldName = toCamelCase(name);
  const constName = toConstantCase(name);
  
  // Build args
  const args: string[] = [];
  const argPass: string[] = [];
  
  if (behavior.input?.fields) {
    for (const field of behavior.input.fields) {
      const argName = field.name;
      const argType = islTypeToGraphQLType(field.type);
      const required = field.optional ? '' : '!';
      args.push(`$${argName}: ${argType}${required}`);
      argPass.push(`${argName}: $${argName}`);
    }
  }
  
  const argsStr = args.length > 0 ? `(${args.join(', ')})` : '';
  const passStr = argPass.length > 0 ? `(${argPass.join(', ')})` : '';
  
  return `
export const ${constName} = gql\`
  mutation ${name}${argsStr} {
    ${fieldName}${passStr}
  }
\`;
`;
}

/**
 * Generate TypeScript types for operations
 */
function generateOperationTypes(
  domain: DomainDeclaration,
  options: Partial<GraphQLGeneratorOptions>
): string {
  const lines: string[] = [];
  
  lines.push(`/**
 * GraphQL Operation Types
 * Generated from ISL domain: ${domain.name}
 */
`);
  
  // Generate types for each entity
  for (const entity of domain.entities) {
    const name = entity.name;
    const fieldName = toCamelCase(name);
    const pluralName = pluralize(fieldName);
    
    // Query types
    lines.push(`
// ${name} Query Types
export interface Get${name}Variables {
  id: string;
}

export interface Get${name}Data {
  ${fieldName}: ${name} | null;
}

export interface Get${toPascalCase(pluralName)}Variables {
  where?: ${name}Filter;
  orderBy?: ${name}SortInput;
  first?: number;
  after?: string;
  last?: number;
  before?: string;
}

export interface Get${toPascalCase(pluralName)}Data {
  ${pluralName}: ${name}Connection;
}

// ${name} Mutation Types
export interface Create${name}Variables {
  input: ${name}Input;
}

export interface Create${name}Data {
  create${name}: ${name};
}

export interface Update${name}Variables {
  id: string;
  input: Partial<${name}Input>;
}

export interface Update${name}Data {
  update${name}: ${name};
}

export interface Delete${name}Variables {
  id: string;
}

export interface Delete${name}Data {
  delete${name}: boolean;
}
`);
  }
  
  return lines.join('\n');
}

/**
 * Generate React hooks
 */
function generateHooks(
  domain: DomainDeclaration,
  framework: ClientFramework,
  options: Partial<GraphQLGeneratorOptions>
): string {
  switch (framework) {
    case 'apollo-client':
      return generateApolloHooks(domain, options);
    case 'urql':
      return generateUrqlHooks(domain, options);
    case 'react-query':
      return generateReactQueryHooks(domain, options);
    default:
      return generateApolloHooks(domain, options);
  }
}

/**
 * Generate Apollo Client hooks
 */
function generateApolloHooks(
  domain: DomainDeclaration,
  options: Partial<GraphQLGeneratorOptions>
): string {
  const lines: string[] = [];
  
  lines.push(`/**
 * Apollo Client Hooks
 * Generated from ISL domain: ${domain.name}
 */

import { useQuery, useMutation, useSubscription } from '@apollo/client';
import type { QueryHookOptions, MutationHookOptions } from '@apollo/client';

// Import operations
import * as Queries from './queries';
import * as Mutations from './mutations';
import * as Types from './types';
`);
  
  for (const entity of domain.entities) {
    const name = entity.name;
    const fieldName = toCamelCase(name);
    const pluralName = pluralize(fieldName);
    const constName = toConstantCase(name);
    
    // useGet hook
    lines.push(`
/**
 * Hook to fetch a single ${name}
 */
export function useGet${name}(
  id: string,
  options?: QueryHookOptions<Types.Get${name}Data, Types.Get${name}Variables>
) {
  return useQuery<Types.Get${name}Data, Types.Get${name}Variables>(
    Queries.GET_${constName},
    { variables: { id }, ...options }
  );
}
`);
    
    // useList hook
    lines.push(`
/**
 * Hook to fetch ${name} list with pagination
 */
export function use${toPascalCase(pluralName)}(
  variables?: Types.Get${toPascalCase(pluralName)}Variables,
  options?: QueryHookOptions<Types.Get${toPascalCase(pluralName)}Data, Types.Get${toPascalCase(pluralName)}Variables>
) {
  return useQuery<Types.Get${toPascalCase(pluralName)}Data, Types.Get${toPascalCase(pluralName)}Variables>(
    Queries.GET_${toConstantCase(pluralName)},
    { variables, ...options }
  );
}
`);
    
    // useCreate hook
    lines.push(`
/**
 * Hook to create a ${name}
 */
export function useCreate${name}(
  options?: MutationHookOptions<Types.Create${name}Data, Types.Create${name}Variables>
) {
  return useMutation<Types.Create${name}Data, Types.Create${name}Variables>(
    Mutations.CREATE_${constName},
    options
  );
}
`);
    
    // useUpdate hook
    lines.push(`
/**
 * Hook to update a ${name}
 */
export function useUpdate${name}(
  options?: MutationHookOptions<Types.Update${name}Data, Types.Update${name}Variables>
) {
  return useMutation<Types.Update${name}Data, Types.Update${name}Variables>(
    Mutations.UPDATE_${constName},
    options
  );
}
`);
    
    // useDelete hook
    lines.push(`
/**
 * Hook to delete a ${name}
 */
export function useDelete${name}(
  options?: MutationHookOptions<Types.Delete${name}Data, Types.Delete${name}Variables>
) {
  return useMutation<Types.Delete${name}Data, Types.Delete${name}Variables>(
    Mutations.DELETE_${constName},
    options
  );
}
`);
  }
  
  return lines.join('\n');
}

/**
 * Generate URQL hooks
 */
function generateUrqlHooks(
  domain: DomainDeclaration,
  options: Partial<GraphQLGeneratorOptions>
): string {
  const lines: string[] = [];
  
  lines.push(`/**
 * URQL Hooks
 * Generated from ISL domain: ${domain.name}
 */

import { useQuery, useMutation } from 'urql';
import * as Queries from './queries';
import * as Mutations from './mutations';
import * as Types from './types';
`);
  
  for (const entity of domain.entities) {
    const name = entity.name;
    const fieldName = toCamelCase(name);
    const pluralName = pluralize(fieldName);
    const constName = toConstantCase(name);
    
    lines.push(`
export function useGet${name}(id: string) {
  return useQuery<Types.Get${name}Data, Types.Get${name}Variables>({
    query: Queries.GET_${constName},
    variables: { id },
  });
}

export function use${toPascalCase(pluralName)}(variables?: Types.Get${toPascalCase(pluralName)}Variables) {
  return useQuery<Types.Get${toPascalCase(pluralName)}Data, Types.Get${toPascalCase(pluralName)}Variables>({
    query: Queries.GET_${toConstantCase(pluralName)},
    variables,
  });
}

export function useCreate${name}() {
  return useMutation<Types.Create${name}Data, Types.Create${name}Variables>(
    Mutations.CREATE_${constName}
  );
}

export function useUpdate${name}() {
  return useMutation<Types.Update${name}Data, Types.Update${name}Variables>(
    Mutations.UPDATE_${constName}
  );
}

export function useDelete${name}() {
  return useMutation<Types.Delete${name}Data, Types.Delete${name}Variables>(
    Mutations.DELETE_${constName}
  );
}
`);
  }
  
  return lines.join('\n');
}

/**
 * Generate React Query + graphql-request hooks
 */
function generateReactQueryHooks(
  domain: DomainDeclaration,
  options: Partial<GraphQLGeneratorOptions>
): string {
  const lines: string[] = [];
  
  lines.push(`/**
 * React Query + GraphQL Request Hooks
 * Generated from ISL domain: ${domain.name}
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GraphQLClient } from 'graphql-request';
import * as Queries from './queries';
import * as Mutations from './mutations';
import * as Types from './types';

// Create GraphQL client
const graphqlClient = new GraphQLClient(process.env.GRAPHQL_ENDPOINT || '/graphql');

// Query keys
export const queryKeys = {
${domain.entities.map(e => `  ${toCamelCase(e.name)}: (id?: string) => ['${e.name}', id] as const,`).join('\n')}
};
`);
  
  for (const entity of domain.entities) {
    const name = entity.name;
    const fieldName = toCamelCase(name);
    const pluralName = pluralize(fieldName);
    
    lines.push(`
// ${name} hooks
export function useGet${name}(id: string) {
  return useQuery({
    queryKey: queryKeys.${fieldName}(id),
    queryFn: () => graphqlClient.request<Types.Get${name}Data>(
      Queries.GET_${toConstantCase(name)},
      { id }
    ),
    enabled: !!id,
  });
}

export function use${toPascalCase(pluralName)}(variables?: Types.Get${toPascalCase(pluralName)}Variables) {
  return useQuery({
    queryKey: [...queryKeys.${fieldName}(), variables],
    queryFn: () => graphqlClient.request<Types.Get${toPascalCase(pluralName)}Data>(
      Queries.GET_${toConstantCase(pluralName)},
      variables
    ),
  });
}

export function useCreate${name}() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (input: Types.Create${name}Variables['input']) =>
      graphqlClient.request<Types.Create${name}Data>(
        Mutations.CREATE_${toConstantCase(name)},
        { input }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.${fieldName}() });
    },
  });
}

export function useUpdate${name}() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, input }: Types.Update${name}Variables) =>
      graphqlClient.request<Types.Update${name}Data>(
        Mutations.UPDATE_${toConstantCase(name)},
        { id, input }
      ),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.${fieldName}(id) });
    },
  });
}

export function useDelete${name}() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) =>
      graphqlClient.request<Types.Delete${name}Data>(
        Mutations.DELETE_${toConstantCase(name)},
        { id }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.${fieldName}() });
    },
  });
}
`);
  }
  
  return lines.join('\n');
}

// ============================================
// Utility Functions
// ============================================

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function toPascalCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toConstantCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toUpperCase()
    .replace(/^_/, '');
}

function pluralize(str: string): string {
  if (str.endsWith('s')) return str + 'es';
  if (str.endsWith('y')) return str.slice(0, -1) + 'ies';
  return str + 's';
}

function getBaseTypeName(type: string): string {
  // Handle generic types like List<T>, Set<T>, Optional<T>
  const genericMatch = type.match(/^(\w+)<(.+)>$/);
  if (genericMatch) {
    const [, containerType, innerType] = genericMatch;
    if (containerType === 'List' || containerType === 'Set' || containerType === 'Optional') {
      return getBaseTypeName(innerType);
    }
    return containerType;
  }
  
  // Handle array types like String[]
  if (type.endsWith('[]')) {
    return getBaseTypeName(type.slice(0, -2));
  }
  
  return type;
}

function islTypeToGraphQLType(type: string): string {
  const typeName = getBaseTypeName(type);
  const typeMap: Record<string, string> = {
    String: 'String',
    Int: 'Int',
    Float: 'Float',
    Boolean: 'Boolean',
    ID: 'ID',
    UUID: 'ID',
    DateTime: 'DateTime',
    Email: 'String',
    URL: 'String',
  };
  return typeMap[typeName] || typeName;
}

function hasSideEffects(behavior: BehaviorDeclaration): boolean {
  if (behavior.postconditions?.conditions) return true;
  const name = behavior.name.toLowerCase();
  return name.startsWith('create') || name.startsWith('update') || 
         name.startsWith('delete') || name.startsWith('add') ||
         name.startsWith('remove') || name.startsWith('set');
}

function isSubscription(behavior: BehaviorDeclaration): boolean {
  const name = behavior.name.toLowerCase();
  return name.startsWith('on') || name.includes('subscribe') || name.includes('watch');
}
