/**
 * ISL Module Resolution System
 *
 * This module provides a complete module resolution system for ISL including:
 * - Module specifier resolution (relative, stdlib, scoped packages)
 * - Module dependency graph construction
 * - Circular dependency detection
 * - Version conflict detection
 * - AST caching with mtime-based invalidation
 *
 * @example
 * ```typescript
 * import {
 *   ModuleResolver,
 *   ModuleGraphBuilder,
 *   ASTCache,
 *   createModuleId,
 * } from '@isl-lang/isl-core/modules';
 *
 * // Create a resolver
 * const resolver = new ModuleResolver({ projectRoot: '/my/project' });
 *
 * // Resolve a module
 * const result = resolver.resolve({ raw: 'stdlib-auth', span: ... });
 * if (result.success) {
 *   console.log('Resolved to:', result.module.path);
 * }
 *
 * // Build a module graph
 * const builder = new ModuleGraphBuilder({
 *   resolver,
 *   readFile: fs.readFileSync,
 *   parseISL: parseISL,
 * });
 * const graph = builder.build(['./entry.isl']);
 *
 * // Cache parsed ASTs
 * const cache = new ASTCache();
 * cache.set(createModuleId('/path/to/file.isl'), ast, mtime);
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export {
  // Core types
  type ModuleId,
  type ModulePath,
  type ImportEdge,
  type ResolvedModule,
  type ExportedSymbol,
  type ExportKind,
  type ModuleGraph,

  // Configuration types
  type ResolverConfig,
  type ResolutionResult,
  type GraphBuildResult,
  type VersionConflict,
  type StdlibCategory,
  type StdlibModuleInfo,

  // Factory functions
  createModuleId,
  createEmptyGraph,

  // Utility functions
  isRelativePath,
  isStdlibModule,
  isScopedPackage,
  parseModuleSpecifier,
  inferStdlibCategory,

  // Constants
  DEFAULT_RESOLVER_CONFIG,
} from './types.js';

// ============================================================================
// Module Resolver
// ============================================================================

export {
  ModuleResolver,
  createResolver,
  createTestResolver,
  extractExports,
} from './resolver.js';

// ============================================================================
// Module Graph Builder
// ============================================================================

export {
  ModuleGraphBuilder,
  type GraphBuildOptions,
  createGraphBuilder,
  buildModuleGraph,
  formatCycleError,
  formatAllCycles,
} from './graph.js';

// ============================================================================
// AST Cache
// ============================================================================

export {
  ASTCache,
  type ASTCacheOptions,
  type CacheStats,
  createCache,
  getGlobalCache,
  resetGlobalCache,
  cacheKeyFromPath,
  warmCache,
} from './cache.js';
