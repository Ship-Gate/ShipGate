// ============================================================================
// ISL Standard Library - Search Module Entry Point
// @isl-lang/stdlib-search
// ============================================================================

// Re-export all types
export * from './types.js';

// Re-export query builders
export * from './queries.js';

// Re-export client and service
export type { SearchClientConfig, SearchServiceDependencies } from './client.js';
export {
  DEFAULT_SEARCH_CONFIG,
  SearchRequestBuilder,
  InMemorySearchRepository,
  SearchService,
  createInMemorySearchService,
} from './client.js';

// Import for namespace export
import * as QueryBuilders from './queries.js';
import {
  SearchService,
  SearchRequestBuilder,
  InMemorySearchRepository,
  createInMemorySearchService,
} from './client.js';

// Convenience namespace export
export const Search = {
  Service: SearchService,
  RequestBuilder: SearchRequestBuilder,
  InMemoryRepository: InMemorySearchRepository,
  createInMemoryService: createInMemorySearchService,
  Query: QueryBuilders,
};

export default Search;
