/**
 * ISL codegen-graphql - GraphQL Schema and Resolver Generation
 */

// Schema generation
export { generateGraphQLSchema } from './schema/generator';
export type { SchemaGeneratorConfig } from './schema/generator';

// Resolver generation
export { generateResolvers } from './resolvers/generator';
export type { ResolverGeneratorConfig } from './resolvers/generator';

// Type generation
export { generateTypes } from './types/generator';
export type { TypeGeneratorConfig } from './types/generator';

// Federation
export { generateFederatedSchema } from './federation/generator';
export type { FederationConfig } from './federation/generator';

// Utilities
export { mapISLTypeToGraphQL, mapISLEnumToGraphQL } from './utils/type-mapper';
export { generateDataLoaders } from './utils/dataloader';
export { generateInputValidation } from './utils/validation';
