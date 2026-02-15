/**
 * @isl-lang/isl-cache
 *
 * Caching layer for ISL pipeline:
 * - ISL Spec Cache: hash NL prompt → skip Stage 1 on re-run
 * - Incremental Codegen: diff spec, regenerate only affected files
 * - Template Cache: pre-parsed templates in .isl-cache/templates/
 * - Cache stats reporting
 */

export { CacheManager } from './cache-manager.js';
export type { CacheManagerOptions, CacheLookupResult, LastRunEntry } from './cache-manager.js';

export { DependencyGraph } from './dependency-graph.js';
export type { GeneratedFile, FileType, DependencyGraphOptions } from './dependency-graph.js';

export { diffISLSpecs, getEntityNames, getBehaviorNames, getEndpointPaths } from './diff.js';

export { TemplateCache } from './template-cache.js';
export type { CachedTemplate, TemplateCacheOptions } from './template-cache.js';

export { sha256 } from './hash.js';

export type {
  ISLSpecCacheEntry,
  CacheStats,
  ISLConstructDiff,
  IncrementalDiffResult,
} from './types.js';
