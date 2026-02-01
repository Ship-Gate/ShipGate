// ============================================================================
// GraphQL Client Generator
// ============================================================================

import type { Domain, Behavior, Entity } from './types.js';

/**
 * Generate GraphQL client operations
 */
export function generateClientOperations(domain: Domain): string {
  const fragments = generateFragments(domain);
  const queries = generateClientQueries(domain);
  const mutations = generateClientMutations(domain);

  return `/**
 * ${domain.name} GraphQL Operations
 * 
 * Auto-generated from ISL specification.
 */
import { gql } from 'graphql-tag';

// Fragments
${fragments}

// Queries
${queries}

// Mutations
${mutations}
`;
}

/**
 * Generate fragments for entities
 */
function generateFragments(domain: Domain): string {
  if (!domain.entities?.length) return '';

  return domain.entities.map(entity => {
    const fields = Object.keys(entity.properties).join('\n    ');
    
    return `export const ${entity.name.toUpperCase()}_FRAGMENT = gql\`
  fragment ${entity.name}Fragment on ${entity.name} {
    id
    ${fields}
    createdAt
    updatedAt
  }
\`;`;
  }).join('\n\n');
}

/**
 * Generate client queries
 */
function generateClientQueries(domain: Domain): string {
  const queryBehaviors = domain.behaviors.filter(b => isQueryBehavior(b.name));

  const behaviorQueries = queryBehaviors.map(b => {
    const opName = pascalCase(b.name);
    const funcName = camelCase(b.name);
    const hasArgs = b.input && Object.keys(b.input).length > 0;

    const variables = hasArgs 
      ? `(${Object.entries(b.input!).map(([name, prop]) => `$${name}: ${mapToGraphQLType(prop.type)}${prop.required !== false ? '!' : ''}`).join(', ')})`
      : '';

    const args = hasArgs
      ? `(${Object.keys(b.input!).map(name => `${name}: $${name}`).join(', ')})`
      : '';

    return `export const ${opName.toUpperCase()}_QUERY = gql\`
  query ${opName}${variables} {
    ${funcName}${args} {
      ... on ${inferReturnType(b, domain)} {
        ...${inferReturnType(b, domain)}Fragment
      }
    }
  }
  \${${inferReturnType(b, domain).toUpperCase()}_FRAGMENT}
\`;`;
  }).join('\n\n');

  // Entity queries
  const entityQueries = (domain.entities ?? []).map(entity => {
    const name = entity.name;
    const varName = camelCase(name);

    return `export const GET_${name.toUpperCase()}_QUERY = gql\`
  query Get${name}($id: ID!) {
    ${varName}(id: $id) {
      ...${name}Fragment
    }
  }
  \${${name.toUpperCase()}_FRAGMENT}
\`;

export const LIST_${name.toUpperCase()}S_QUERY = gql\`
  query List${name}s($limit: Int, $offset: Int) {
    ${varName}s(limit: $limit, offset: $offset) {
      ...${name}Fragment
    }
  }
  \${${name.toUpperCase()}_FRAGMENT}
\`;`;
  }).join('\n\n');

  return `${behaviorQueries}\n\n${entityQueries}`;
}

/**
 * Generate client mutations
 */
function generateClientMutations(domain: Domain): string {
  const mutationBehaviors = domain.behaviors.filter(b => !isQueryBehavior(b.name));

  const behaviorMutations = mutationBehaviors.map(b => {
    const opName = pascalCase(b.name);
    const funcName = camelCase(b.name);
    const hasInput = b.input && Object.keys(b.input).length > 0;

    const inputTypeName = `${opName}Input`;
    const variables = hasInput ? `($input: ${inputTypeName}!)` : '';
    const args = hasInput ? '(input: $input)' : '';

    return `export const ${opName.toUpperCase()}_MUTATION = gql\`
  mutation ${opName}${variables} {
    ${funcName}${args} {
      ... on ${inferReturnType(b, domain)} {
        ...${inferReturnType(b, domain)}Fragment
      }
    }
  }
  \${${inferReturnType(b, domain).toUpperCase()}_FRAGMENT}
\`;`;
  }).join('\n\n');

  // Entity CRUD mutations
  const entityMutations = (domain.entities ?? []).map(entity => {
    const name = entity.name;

    return `export const CREATE_${name.toUpperCase()}_MUTATION = gql\`
  mutation Create${name}($input: ${name}Input!) {
    create${name}(input: $input) {
      ...${name}Fragment
    }
  }
  \${${name.toUpperCase()}_FRAGMENT}
\`;

export const UPDATE_${name.toUpperCase()}_MUTATION = gql\`
  mutation Update${name}($id: ID!, $input: ${name}UpdateInput!) {
    update${name}(id: $id, input: $input) {
      ...${name}Fragment
    }
  }
  \${${name.toUpperCase()}_FRAGMENT}
\`;

export const DELETE_${name.toUpperCase()}_MUTATION = gql\`
  mutation Delete${name}($id: ID!) {
    delete${name}(id: $id)
  }
\`;`;
  }).join('\n\n');

  return `${behaviorMutations}\n\n${entityMutations}`;
}

/**
 * Generate React hooks (for Apollo Client)
 */
export function generateReactHooks(domain: Domain): string {
  const hooks: string[] = [];

  // Entity hooks
  for (const entity of domain.entities ?? []) {
    const name = entity.name;
    const varName = camelCase(name);

    hooks.push(`
export function use${name}(id: string) {
  return useQuery(GET_${name.toUpperCase()}_QUERY, {
    variables: { id },
    skip: !id,
  });
}

export function use${name}s(options?: { limit?: number; offset?: number }) {
  return useQuery(LIST_${name.toUpperCase()}S_QUERY, {
    variables: options,
  });
}

export function useCreate${name}() {
  return useMutation(CREATE_${name.toUpperCase()}_MUTATION, {
    refetchQueries: [LIST_${name.toUpperCase()}S_QUERY],
  });
}

export function useUpdate${name}() {
  return useMutation(UPDATE_${name.toUpperCase()}_MUTATION);
}

export function useDelete${name}() {
  return useMutation(DELETE_${name.toUpperCase()}_MUTATION, {
    refetchQueries: [LIST_${name.toUpperCase()}S_QUERY],
  });
}`);
  }

  // Behavior hooks
  for (const behavior of domain.behaviors) {
    const opName = pascalCase(behavior.name);
    const isQuery = isQueryBehavior(behavior.name);
    const hookType = isQuery ? 'useQuery' : 'useMutation';
    const queryName = `${opName.toUpperCase()}_${isQuery ? 'QUERY' : 'MUTATION'}`;

    hooks.push(`
export function use${opName}() {
  return ${hookType}(${queryName});
}`);
  }

  return `/**
 * ${domain.name} React Hooks
 * 
 * Auto-generated from ISL specification.
 */
import { useQuery, useMutation } from '@apollo/client';
import * as Operations from './operations';

${hooks.join('\n')}
`;
}

// Helper functions
function isQueryBehavior(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.startsWith('get') || lower.startsWith('list') || 
         lower.startsWith('find') || lower.startsWith('search');
}

function inferReturnType(behavior: Behavior, domain: Domain): string {
  if (!behavior.output) return 'Boolean';
  const entityNames = (domain.entities ?? []).map(e => e.name);
  for (const name of entityNames) {
    if (behavior.output[name.toLowerCase()] || behavior.output[name]) {
      return name;
    }
  }
  return entityNames[0] ?? 'JSON';
}

function mapToGraphQLType(type: string): string {
  const mapping: Record<string, string> = {
    string: 'String',
    number: 'Float',
    integer: 'Int',
    boolean: 'Boolean',
  };
  return mapping[type] ?? 'String';
}

function camelCase(str: string): string {
  const pascal = str.split(/[_\s-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function pascalCase(str: string): string {
  return str.split(/[_\s-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}
