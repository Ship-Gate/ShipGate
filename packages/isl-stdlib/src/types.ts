/**
 * ISL Standard Library Registry Types
 */

/** Category of a stdlib module */
export type StdlibCategory =
  | 'security'
  | 'compliance'
  | 'business'
  | 'communication'
  | 'storage'
  | 'infrastructure'
  | 'architecture'
  | 'data'
  | 'operations'
  | 'ai';

/** What a module provides (entities, behaviors, enums, types) */
export interface ModuleProvides {
  entities: string[];
  behaviors: string[];
  enums: string[];
  types: string[];
}

/** File entry with content hash for integrity verification */
export interface StdlibFileEntry {
  /** Relative path from module root */
  path: string;
  /** SHA-256 hash of file content */
  contentHash: string;
}

/** Module status */
export type ModuleStatus = 'implemented' | 'planned' | 'deprecated';

/** A single stdlib module definition */
export interface StdlibModule {
  /** NPM package name (e.g., @isl-lang/stdlib-auth) */
  name: string;
  /** Semantic version */
  version: string;
  /** Human-readable description */
  description: string;
  /** Category for grouping */
  category: StdlibCategory;
  /** Module status (implemented, planned, deprecated) */
  status: ModuleStatus;
  /** Main ISL entry point file (relative to stdlib root) */
  entryPoint: string;
  /** Export map: subpath -> file path */
  exports: Record<string, string>;
  /** Files with content hashes for integrity verification */
  files: StdlibFileEntry[];
  /** Aggregate hash of all module files (for quick verification) */
  moduleHash: string;
  /** What entities, behaviors, enums, types this module provides */
  provides: ModuleProvides;
  /** Hard dependencies on other stdlib modules */
  dependencies: string[];
  /** Optional peer dependencies */
  peerDependencies: string[];
  /** Search keywords */
  keywords: string[];
}

/** Category metadata */
export interface CategoryInfo {
  name: string;
  description: string;
  modules: string[];
}

/** The full registry structure */
export interface StdlibRegistry {
  /** Schema reference */
  $schema?: string;
  /** Registry version */
  version: string;
  /** Description */
  description: string;
  /** Generation timestamp */
  generated: string;
  /** Root directory for stdlib files (relative to workspace) */
  stdlibRoot: string;
  /** All modules indexed by short name (e.g., 'stdlib-auth') */
  modules: Record<string, StdlibModule>;
  /** Categories with their modules */
  categories: Record<string, CategoryInfo>;
  /** Import alias mappings (e.g., @isl/stdlib-auth -> stdlib-auth) */
  importAliases: Record<string, string>;
}

/** Result of resolving an import */
export interface ResolvedImport {
  /** The module that was resolved */
  module: StdlibModule;
  /** The specific file path within the module */
  filePath: string;
  /** Full path to the ISL file (when resolved against node_modules) */
  fullPath?: string;
  /** What this import provides */
  provides: ModuleProvides;
}

/** Import resolution error */
export interface ImportResolutionError {
  code: 'MODULE_NOT_FOUND' | 'SUBPATH_NOT_FOUND' | 'INVALID_IMPORT';
  message: string;
  importPath: string;
  suggestions?: string[];
}

/** Options for the resolver */
export interface ResolverOptions {
  /** Base path to resolve modules from (defaults to node_modules) */
  basePath?: string;
  /** Whether to allow missing modules (for validation) */
  allowMissing?: boolean;
  /** Custom registry (defaults to built-in) */
  registry?: StdlibRegistry;
}

// ============================================================================
// Version Pinning Types (for proof bundles and verification)
// ============================================================================

/**
 * Pinned stdlib version for reproducibility
 * 
 * Records exactly which version of a stdlib module was used during verification.
 */
export interface StdlibVersionPin {
  /** Module short name (e.g., 'stdlib-auth') */
  moduleName: string;
  /** Module version */
  version: string;
  /** Module hash at time of verification */
  moduleHash: string;
  /** Entry point path */
  entryPoint: string;
}

/**
 * Complete stdlib version manifest
 * 
 * Records all stdlib modules used during verification for reproducibility.
 */
export interface StdlibVersionManifest {
  /** Registry version */
  registryVersion: string;
  /** Timestamp when versions were resolved */
  resolvedAt: string;
  /** All pinned stdlib versions */
  pins: StdlibVersionPin[];
  /** Combined hash of all pinned modules */
  manifestHash: string;
}

/**
 * Create a version pin from a resolved module
 */
export function createVersionPin(module: StdlibModule, moduleName: string): StdlibVersionPin {
  return {
    moduleName,
    version: module.version,
    moduleHash: module.moduleHash,
    entryPoint: module.entryPoint,
  };
}

/**
 * Calculate manifest hash from version pins
 */
export function calculateManifestHash(pins: StdlibVersionPin[]): string {
  const sortedPins = [...pins].sort((a, b) => a.moduleName.localeCompare(b.moduleName));
  const content = sortedPins
    .map(p => `${p.moduleName}:${p.version}:${p.moduleHash}`)
    .join('\n');
  // Simple hash - in production use crypto.createHash('sha256')
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
