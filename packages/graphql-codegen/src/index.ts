// ============================================================================
// GraphQL Code Generator - Public API
// ============================================================================

// Main generator
export { generate, generateGraphQL } from './generator';

// Types
export type {
  GraphQLServer,
  GraphQLClient,
  GraphQLGeneratorOptions,
  GeneratedFile,
  GenerationResult,
  GraphQLTypeInfo,
  GraphQLFieldInfo,
  GraphQLArgInfo,
  GraphQLDirective,
} from './types';

export { DEFAULT_OPTIONS, ISL_TO_GRAPHQL_TYPES } from './types';
