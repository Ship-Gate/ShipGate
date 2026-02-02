/**
 * GraphQL Client Generator
 *
 * Generate typed GraphQL clients for frontend applications.
 */

export interface ClientGeneratorOptions {
  /** Output language */
  language?: 'typescript' | 'javascript';
  /** Client library to use */
  clientLibrary?: 'apollo' | 'urql' | 'graphql-request' | 'fetch';
  /** Include React hooks */
  includeHooks?: boolean;
  /** Include Vue composables */
  includeComposables?: boolean;
  /** Include Svelte stores */
  includeSvelteStores?: boolean;
  /** Include cache configuration */
  includeCache?: boolean;
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

export class ClientGenerator {
  private options: Required<ClientGeneratorOptions>;
  private domain: ParsedDomain | null = null;

  constructor(options: ClientGeneratorOptions = {}) {
    this.options = {
      language: options.language ?? 'typescript',
      clientLibrary: options.clientLibrary ?? 'apollo',
      includeHooks: options.includeHooks ?? true,
      includeComposables: options.includeComposables ?? false,
      includeSvelteStores: options.includeSvelteStores ?? false,
      includeCache: options.includeCache ?? true,
    };
  }

  /**
   * Generate client code from ISL content
   */
  generate(islContent: string): string {
    this.domain = this.parseISL(islContent);
    const parts: string[] = [];

    // Imports
    parts.push(this.generateImports());

    // Types
    parts.push(this.generateTypes());

    // GraphQL documents
    parts.push(this.generateDocuments());

    // Client hooks/functions
    if (this.options.includeHooks) {
      parts.push(this.generateReactHooks());
    }

    if (this.options.includeComposables) {
      parts.push(this.generateVueComposables());
    }

    // Type policies for cache
    if (this.options.includeCache) {
      parts.push(this.generateCacheConfig());
    }

    return parts.filter(Boolean).join('\n\n');
  }

  /**
   * Generate imports
   */
  private generateImports(): string {
    const imports: string[] = [];

    switch (this.options.clientLibrary) {
      case 'apollo':
        imports.push(`import { gql, useQuery, useMutation, useSubscription } from '@apollo/client';`);
        imports.push(`import type { TypedDocumentNode } from '@apollo/client';`);
        break;
      case 'urql':
        imports.push(`import { gql } from '@urql/core';`);
        imports.push(`import { useQuery, useMutation, useSubscription } from '@urql/vue';`);
        break;
      case 'graphql-request':
        imports.push(`import { gql, GraphQLClient } from 'graphql-request';`);
        break;
      case 'fetch':
        imports.push(`// Using native fetch`);
        break;
    }

    return imports.join('\n');
  }

  /**
   * Generate TypeScript types
   */
  private generateTypes(): string {
    if (this.options.language !== 'typescript') return '';

    const types: string[] = [];

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

    // Enum types
    for (const enumDef of this.domain!.enums) {
      types.push(`
export enum ${enumDef.name} {
  ${enumDef.values.map((v) => `${v} = '${v}'`).join(',\n  ')}
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

    // Query/Mutation result types
    for (const entity of this.domain!.entities) {
      const entityName = entity.name;
      types.push(`
export interface ${entityName}QueryResult {
  ${this.toCamelCase(entityName)}: ${entityName} | null;
}

export interface ${entityName}ListQueryResult {
  ${this.toCamelCase(entityName)}s: {
    edges: Array<{ node: ${entityName}; cursor: string }>;
    pageInfo: PageInfo;
    totalCount: number;
  };
}

export interface ${entityName}QueryVariables {
  id: string;
}

export interface ${entityName}ListQueryVariables {
  first?: number;
  after?: string;
  filter?: ${entityName}Filter;
}`);
    }

    // Common types
    types.push(`
export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}`);

    return types.join('\n');
  }

  /**
   * Generate GraphQL documents
   */
  private generateDocuments(): string {
    const documents: string[] = [];

    // Entity fragments
    for (const entity of this.domain!.entities) {
      const fields = entity.fields
        .filter((f) => !f.type.startsWith('List<') && !this.isEntityType(f.type))
        .map((f) => f.name)
        .join('\n    ');

      documents.push(`
export const ${entity.name.toUpperCase()}_FRAGMENT = gql\`
  fragment ${entity.name}Fields on ${entity.name} {
    ${fields}
  }
\`;`);
    }

    // Entity queries
    for (const entity of this.domain!.entities) {
      const entityName = entity.name;
      const entityNameLower = this.toCamelCase(entityName);

      documents.push(`
export const GET_${entityName.toUpperCase()} = gql\`
  query Get${entityName}($id: UUID!) {
    ${entityNameLower}(id: $id) {
      ...${entityName}Fields
    }
  }
  \${${entityName.toUpperCase()}_FRAGMENT}
\`;

export const LIST_${entityName.toUpperCase()}S = gql\`
  query List${entityName}s($first: Int, $after: String, $filter: ${entityName}Filter) {
    ${entityNameLower}s(first: $first, after: $after, filter: $filter) {
      edges {
        node {
          ...${entityName}Fields
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
  \${${entityName.toUpperCase()}_FRAGMENT}
\`;`);
    }

    // Behavior mutations
    for (const behavior of this.domain!.behaviors) {
      const behaviorName = behavior.name;
      const methodName = this.toCamelCase(behaviorName);

      documents.push(`
export const ${behaviorName.toUpperCase()}_MUTATION = gql\`
  mutation ${behaviorName}($input: ${behaviorName}Input!) {
    ${methodName}(input: $input) {
      __typename
      ... on ${behavior.output.success} {
        ...${behavior.output.success}Fields
      }
      ... on Error {
        code
        message
        path
      }
    }
  }
  \${${behavior.output.success.toUpperCase()}_FRAGMENT}
\`;`);
    }

    // Subscriptions
    for (const entity of this.domain!.entities) {
      const entityName = entity.name;
      const entityNameLower = this.toCamelCase(entityName);

      documents.push(`
export const ${entityName.toUpperCase()}_CREATED_SUBSCRIPTION = gql\`
  subscription On${entityName}Created {
    ${entityNameLower}Created {
      ...${entityName}Fields
    }
  }
  \${${entityName.toUpperCase()}_FRAGMENT}
\`;

export const ${entityName.toUpperCase()}_UPDATED_SUBSCRIPTION = gql\`
  subscription On${entityName}Updated($id: UUID!) {
    ${entityNameLower}Updated(id: $id) {
      ...${entityName}Fields
    }
  }
  \${${entityName.toUpperCase()}_FRAGMENT}
\`;`);
    }

    return documents.join('\n');
  }

  /**
   * Generate React hooks
   */
  private generateReactHooks(): string {
    const hooks: string[] = [];

    // Query hooks
    for (const entity of this.domain!.entities) {
      const entityName = entity.name;

      hooks.push(`
/**
 * Hook to fetch a single ${entityName}
 */
export function use${entityName}(id: string) {
  return useQuery<${entityName}QueryResult, ${entityName}QueryVariables>(
    GET_${entityName.toUpperCase()},
    { variables: { id }, skip: !id }
  );
}

/**
 * Hook to fetch a list of ${entityName}s
 */
export function use${entityName}s(variables?: ${entityName}ListQueryVariables) {
  return useQuery<${entityName}ListQueryResult, ${entityName}ListQueryVariables>(
    LIST_${entityName.toUpperCase()}S,
    { variables }
  );
}`);
    }

    // Mutation hooks
    for (const behavior of this.domain!.behaviors) {
      const behaviorName = behavior.name;
      const methodName = this.toCamelCase(behaviorName);

      hooks.push(`
/**
 * Hook for ${behavior.description}
 */
export function use${behaviorName}() {
  const [mutate, result] = useMutation<${behaviorName}Result, { input: ${behaviorName}Input }>(
    ${behaviorName.toUpperCase()}_MUTATION
  );

  const ${methodName} = async (input: ${behaviorName}Input) => {
    const response = await mutate({ variables: { input } });
    return response.data?.${methodName};
  };

  return {
    ${methodName},
    loading: result.loading,
    error: result.error,
    data: result.data,
  };
}`);
    }

    // Subscription hooks
    for (const entity of this.domain!.entities) {
      const entityName = entity.name;
      const entityNameLower = this.toCamelCase(entityName);

      hooks.push(`
/**
 * Hook to subscribe to ${entityName} creation events
 */
export function use${entityName}Created(onData?: (data: ${entityName}) => void) {
  return useSubscription(${entityName.toUpperCase()}_CREATED_SUBSCRIPTION, {
    onData: ({ data }) => onData?.(data.data.${entityNameLower}Created),
  });
}

/**
 * Hook to subscribe to ${entityName} update events
 */
export function use${entityName}Updated(id: string, onData?: (data: ${entityName}) => void) {
  return useSubscription(${entityName.toUpperCase()}_UPDATED_SUBSCRIPTION, {
    variables: { id },
    onData: ({ data }) => onData?.(data.data.${entityNameLower}Updated),
    skip: !id,
  });
}`);
    }

    return hooks.join('\n');
  }

  /**
   * Generate Vue composables
   */
  private generateVueComposables(): string {
    const composables: string[] = [];

    for (const entity of this.domain!.entities) {
      const entityName = entity.name;

      composables.push(`
/**
 * Composable to fetch a single ${entityName}
 */
export function use${entityName}(id: Ref<string>) {
  return useQuery({
    query: GET_${entityName.toUpperCase()},
    variables: { id },
    pause: computed(() => !id.value),
  });
}

/**
 * Composable to fetch a list of ${entityName}s
 */
export function use${entityName}s(variables?: Ref<${entityName}ListQueryVariables>) {
  return useQuery({
    query: LIST_${entityName.toUpperCase()}S,
    variables,
  });
}`);
    }

    return composables.join('\n');
  }

  /**
   * Generate Apollo cache configuration
   */
  private generateCacheConfig(): string {
    const typePolicies: string[] = [];

    for (const entity of this.domain!.entities) {
      typePolicies.push(`
    ${entity.name}: {
      keyFields: ['id'],
    }`);
    }

    return `
/**
 * Apollo Cache Type Policies
 */
export const typePolicies = {
  Query: {
    fields: {
      ${this.domain!.entities.map((e) => `
      ${this.toCamelCase(e.name)}: {
        read(existing, { args, toReference }) {
          return existing ?? toReference({ __typename: '${e.name}', id: args?.id });
        },
      },
      ${this.toCamelCase(e.name)}s: {
        keyArgs: ['filter'],
        merge(existing, incoming, { args }) {
          // Implement cursor-based pagination merge
          if (!existing) return incoming;
          return {
            ...incoming,
            edges: [...existing.edges, ...incoming.edges],
          };
        },
      }`).join(',')}
    },
  },${typePolicies.join(',')}
};`;
  }

  private isEntityType(type: string): boolean {
    return this.domain!.entities.some((e) => e.name === type);
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
      case 'DateTime':
      case 'Date':
        return 'string';
      case 'Int':
      case 'Float':
      case 'Decimal':
        return 'number';
      case 'Boolean':
        return 'boolean';
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

  private parseISL(content: string): ParsedDomain {
    const domain: ParsedDomain = {
      name: '',
      entities: [],
      behaviors: [],
      enums: [],
    };

    const domainMatch = content.match(/domain\s+(\w+)\s*\{/);
    if (domainMatch) domain.name = domainMatch[1];

    const entityRegex = /entity\s+(\w+)\s*\{([^}]+)\}/g;
    let match;
    while ((match = entityRegex.exec(content)) !== null) {
      domain.entities.push({ name: match[1], fields: this.parseFields(match[2]) });
    }

    const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g;
    while ((match = enumRegex.exec(content)) !== null) {
      const values = match[2].match(/\b[A-Z][A-Z0-9_]+\b/g) ?? [];
      domain.enums.push({ name: match[1], values });
    }

    const behaviorRegex = /behavior\s+(\w+)\s*\{([\s\S]*?)(?=\n\s*(?:behavior|entity|enum|type|invariants|\}))/g;
    while ((match = behaviorRegex.exec(content)) !== null) {
      domain.behaviors.push(this.parseBehavior(match[1], match[2]));
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
      const successMatch = outputMatch[1].match(/success\s*:\s*(\w+)/);
      if (successMatch) behavior.output.success = successMatch[1];
    }

    return behavior;
  }
}

export function generateClient(
  islContent: string,
  options?: ClientGeneratorOptions
): string {
  const generator = new ClientGenerator(options);
  return generator.generate(islContent);
}
