// ============================================================================
// ISL Standard Library - API Entry Point
// @isl-lang/stdlib-api
// ============================================================================

// Re-export all modules
export * from './http.js';
export * from './endpoint.js';
export * from './crud.js';
export * from './graphql.js';

// Re-export default objects
export { default as Http } from './http.js';
export { default as Endpoint } from './endpoint.js';
export { default as Crud } from './crud.js';
export { default as GraphQL } from './graphql.js';

// Import for namespace
import Http from './http.js';
import Endpoint from './endpoint.js';
import Crud from './crud.js';
import GraphQL from './graphql.js';

/**
 * API Standard Library namespace
 */
export const StdLibApi = {
  Http,
  Endpoint,
  Crud,
  GraphQL,
};

export default StdLibApi;
