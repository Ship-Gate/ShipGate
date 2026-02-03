/**
 * @isl-lang/isl-stdlib
 * 
 * ISL Standard Library Registry and Import Resolver
 * 
 * This package provides:
 * - Central registry of all stdlib modules
 * - Import path resolution
 * - Module discovery and search
 * - Dependency resolution
 * 
 * @example
 * ```ts
 * import { 
 *   getModule, 
 *   resolveStdlibImport, 
 *   searchModules 
 * } from '@isl-lang/isl-stdlib';
 * 
 * // Get a module by name
 * const authModule = getModule('stdlib-auth');
 * console.log(authModule?.provides.behaviors);
 * // ['Register', 'Login', 'Logout', ...]
 * 
 * // Resolve an import
 * const result = resolveStdlibImport('@isl/stdlib-auth/session');
 * if (!('code' in result)) {
 *   console.log(result.filePath); // 'intents/session.isl'
 * }
 * 
 * // Search for modules
 * const paymentModules = searchModules('payment');
 * ```
 */

// Registry exports
export {
  getRegistry,
  getModuleNames,
  getModule,
  getModuleByPackageName,
  getModulesByCategory,
  getCategory,
  getCategories,
  searchModules,
  findModulesWithEntity,
  findModulesWithBehavior,
  findModulesWithEnum,
  findModulesWithType,
  resolveDependencyTree,
  getImportAliases,
  resolveImportAlias,
  validateRegistry,
  getRegistryStats,
} from './registry.js';

// Resolver exports
export {
  parseImportPath,
  isStdlibImport,
  resolveStdlibImport,
  resolveImports,
  getModuleFilePaths,
  moduleFilesExist,
  getSuggestions,
  mergeProvides,
} from './resolver.js';

// Validation exports
export { runValidation } from './validate-registry.js';

// Type exports
export type {
  StdlibRegistry,
  StdlibModule,
  StdlibFileEntry,
  ModuleStatus,
  CategoryInfo,
  StdlibCategory,
  ModuleProvides,
  ResolvedImport,
  ImportResolutionError,
  ResolverOptions,
  StdlibVersionPin,
  StdlibVersionManifest,
} from './types.js';

// Version pinning utilities
export {
  createVersionPin,
  calculateManifestHash,
} from './types.js';

// Version info
export const VERSION = '1.0.0';
