/**
 * ISL API Generator
 * 
 * Generate REST and GraphQL APIs from ISL specifications.
 * Produces OpenAPI specs, GraphQL schemas, and server code.
 */

export { RestGenerator, generateRestApi, type RestApiOptions } from './rest/generator.js';
export { GraphQLGenerator, generateGraphQLApi, type GraphQLOptions } from './graphql/generator.js';
export { OpenAPIGenerator, generateOpenAPISpec, type OpenAPIOptions } from './openapi/generator.js';
export { ServerGenerator, generateServer, type ServerOptions } from './server/generator.js';

export type { GeneratedFile, ApiEndpoint, ApiMethod } from './types.js';
