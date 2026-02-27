/**
 * ISL Module Resolver
 *
 * Resolves module specifiers to filesystem paths following
 * the resolution rules defined in MODULE_RESOLUTION.md.
 */

import * as path from 'path';
import * as fs from 'fs';
import {
  type ModuleId,
  type ModulePath,
  type ResolvedModule,
  type ResolutionResult,
  type ResolverConfig,
  type StdlibCategory,
  type ExportedSymbol,
  createModuleId,
  isRelativePath,
  isStdlibModule,
  isScopedPackage,
  parseModuleSpecifier,
  inferStdlibCategory,
  DEFAULT_RESOLVER_CONFIG,
} from './types.js';

// ============================================================================
// Stdlib Module Mapping
// ============================================================================

/**
 * Map of stdlib module names to their file paths within the stdlib package.
 */
const STDLIB_MODULE_MAP: Record<string, { category: StdlibCategory; file: string }> = {
  // Auth modules
  'stdlib-auth': { category: 'auth', file: 'auth/index.isl' },
  'stdlib-auth/oauth': { category: 'auth', file: 'auth/oauth-login.isl' },
  'stdlib-auth/session': { category: 'auth', file: 'auth/session-create.isl' },
  'stdlib-auth/password-reset': { category: 'auth', file: 'auth/password-reset.isl' },
  'stdlib-auth/rate-limit': { category: 'auth', file: 'auth/rate-limit-login.isl' },

  // Payment modules
  'stdlib-payments': { category: 'payments', file: 'payments/index.isl' },
  'stdlib-payments/process': { category: 'payments', file: 'payments/process-payment.isl' },
  'stdlib-payments/refund': { category: 'payments', file: 'payments/process-refund.isl' },
  'stdlib-payments/subscription': { category: 'payments', file: 'payments/subscription-create.isl' },
  'stdlib-payments/webhook': { category: 'payments', file: 'payments/webhook-handle.isl' },

  // Upload modules
  'stdlib-uploads': { category: 'uploads', file: 'uploads/index.isl' },
  'stdlib-uploads/image': { category: 'uploads', file: 'uploads/upload-image.isl' },
  'stdlib-uploads/blob': { category: 'uploads', file: 'uploads/store-blob.isl' },
  'stdlib-uploads/mime': { category: 'uploads', file: 'uploads/validate-mime.isl' },
};

// ============================================================================
// Module Resolver Class
// ============================================================================

/**
 * Resolves ISL module specifiers to filesystem paths.
 *
 * Resolution order:
 * 1. Relative paths (./local, ../parent)
 * 2. Project modules (bare specifiers)
 * 3. Stdlib modules (stdlib-*)
 * 4. External packages (@org/name)
 */
export class ModuleResolver {
  private config: Required<ResolverConfig>;
  private resolvedCache: Map<string, ResolutionResult> = new Map();

  constructor(config: ResolverConfig) {
    this.config = {
      projectRoot: config.projectRoot,
      searchPaths: config.searchPaths ?? DEFAULT_RESOLVER_CONFIG.searchPaths!,
      extensions: config.extensions ?? DEFAULT_RESOLVER_CONFIG.extensions!,
      stdlibPath: config.stdlibPath ?? this.findStdlibPath(config.projectRoot),
      customResolver: config.customResolver ?? (() => null),
      followSymlinks: config.followSymlinks ?? DEFAULT_RESOLVER_CONFIG.followSymlinks!,
    };
  }

  /**
   * Resolve a module specifier from a source file.
   *
   * @param specifier - The module specifier (from use statement)
   * @param fromFile - The file containing the use statement
   * @returns Resolution result with resolved module or error
   */
  resolve(specifier: ModulePath, fromFile?: string): ResolutionResult {
    const cacheKey = `${fromFile ?? ''}::${specifier.raw}`;

    // Check cache first
    if (this.resolvedCache.has(cacheKey)) {
      return this.resolvedCache.get(cacheKey)!;
    }

    // Parse the specifier
    const { name, version } = parseModuleSpecifier(specifier.raw);
    const triedPaths: string[] = [];

    // Try custom resolver first
    const customResult = this.config.customResolver(name, fromFile ?? this.config.projectRoot);
    if (customResult) {
      const result = this.createSuccessResult(customResult, version);
      this.resolvedCache.set(cacheKey, result);
      return result;
    }

    // 1. Relative paths
    if (isRelativePath(name)) {
      const result = this.resolveRelative(name, fromFile, triedPaths);
      this.resolvedCache.set(cacheKey, result);
      return result;
    }

    // 2. Stdlib modules
    if (isStdlibModule(name)) {
      const result = this.resolveStdlib(name, version, triedPaths);
      this.resolvedCache.set(cacheKey, result);
      return result;
    }

    // 3. Scoped packages
    if (isScopedPackage(name)) {
      const result = this.resolveScopedPackage(name, triedPaths);
      this.resolvedCache.set(cacheKey, result);
      return result;
    }

    // 4. Project modules (bare specifiers)
    const result = this.resolveProject(name, triedPaths);
    this.resolvedCache.set(cacheKey, result);
    return result;
  }

  /**
   * Resolve a relative path specifier.
   */
  private resolveRelative(
    specifier: string,
    fromFile: string | undefined,
    triedPaths: string[]
  ): ResolutionResult {
    const baseDir = fromFile ? path.dirname(fromFile) : this.config.projectRoot;
    const basePath = path.resolve(baseDir, specifier);

    // Try with each extension
    for (const ext of this.config.extensions) {
      const candidate = basePath + ext;
      triedPaths.push(candidate);

      if (this.fileExists(candidate)) {
        return this.createSuccessResult(candidate);
      }
    }

    // Try as-is (might already have extension)
    if (this.fileExists(basePath)) {
      return this.createSuccessResult(basePath);
    }
    triedPaths.push(basePath);

    return this.createErrorResult('MODULE_NOT_FOUND', specifier, triedPaths);
  }

  /**
   * Resolve a stdlib module specifier.
   */
  private resolveStdlib(
    specifier: string,
    version: string | undefined,
    triedPaths: string[]
  ): ResolutionResult {
    // Check the stdlib map first
    const mapped = STDLIB_MODULE_MAP[specifier];
    if (mapped) {
      const fullPath = path.join(this.config.stdlibPath, mapped.file);
      triedPaths.push(fullPath);

      if (this.fileExists(fullPath)) {
        return this.createSuccessResult(fullPath, version);
      }
    }

    // Try to infer the path from the specifier
    const baseName = specifier.replace(/^stdlib-/, '');
    const category = inferStdlibCategory(specifier);

    if (category) {
      // Try category/module.isl
      const categoryPath = path.join(this.config.stdlibPath, category, `${baseName}.isl`);
      triedPaths.push(categoryPath);
      if (this.fileExists(categoryPath)) {
        return this.createSuccessResult(categoryPath, version);
      }

      // Try category/index.isl for top-level modules
      const indexPath = path.join(this.config.stdlibPath, category, 'index.isl');
      triedPaths.push(indexPath);
      if (this.fileExists(indexPath)) {
        return this.createSuccessResult(indexPath, version);
      }
    }

    // Try direct path
    for (const ext of this.config.extensions) {
      const directPath = path.join(this.config.stdlibPath, baseName + ext);
      triedPaths.push(directPath);
      if (this.fileExists(directPath)) {
        return this.createSuccessResult(directPath, version);
      }
    }

    return this.createErrorResult('MODULE_NOT_FOUND', specifier, triedPaths);
  }

  /**
   * Resolve a scoped package specifier (@org/name).
   */
  private resolveScopedPackage(specifier: string, triedPaths: string[]): ResolutionResult {
    // Look in node_modules
    const nodeModulesPath = path.join(this.config.projectRoot, 'node_modules', specifier);

    // Try with extensions
    for (const ext of this.config.extensions) {
      const candidate = nodeModulesPath + ext;
      triedPaths.push(candidate);
      if (this.fileExists(candidate)) {
        return this.createSuccessResult(candidate);
      }
    }

    // Try index file in package directory
    const indexPath = path.join(nodeModulesPath, 'index.isl');
    triedPaths.push(indexPath);
    if (this.fileExists(indexPath)) {
      return this.createSuccessResult(indexPath);
    }

    return this.createErrorResult('MODULE_NOT_FOUND', specifier, triedPaths);
  }

  /**
   * Resolve a project module (bare specifier).
   */
  private resolveProject(specifier: string, triedPaths: string[]): ResolutionResult {
    // Search in configured search paths
    for (const searchPath of this.config.searchPaths) {
      const baseDir = path.join(this.config.projectRoot, searchPath);

      // Try with each extension
      for (const ext of this.config.extensions) {
        const candidate = path.join(baseDir, specifier + ext);
        triedPaths.push(candidate);
        if (this.fileExists(candidate)) {
          return this.createSuccessResult(candidate);
        }
      }

      // Try as-is
      const directPath = path.join(baseDir, specifier);
      if (this.fileExists(directPath)) {
        return this.createSuccessResult(directPath);
      }
      triedPaths.push(directPath);
    }

    return this.createErrorResult('MODULE_NOT_FOUND', specifier, triedPaths);
  }

  /**
   * Find the stdlib path by looking in node_modules.
   */
  private findStdlibPath(projectRoot: string): string {
    // First, try the bundled stdlib in this package
    const bundledPath = path.join(__dirname, '..', '..', '..', 'stdlib');
    if (this.directoryExists(bundledPath)) {
      return bundledPath;
    }

    // Try @isl-lang/stdlib in node_modules
    const nodeModulesPath = path.join(projectRoot, 'node_modules', '@isl-lang', 'stdlib');
    if (this.directoryExists(nodeModulesPath)) {
      return nodeModulesPath;
    }

    // Fall back to project root stdlib folder
    const projectStdlib = path.join(projectRoot, 'stdlib');
    if (this.directoryExists(projectStdlib)) {
      return projectStdlib;
    }

    // Default to workspace stdlib (for development)
    return path.resolve(projectRoot, 'stdlib');
  }

  /**
   * Create a successful resolution result.
   */
  private createSuccessResult(resolvedPath: string, version?: string): ResolutionResult {
    const normalizedPath = this.normalizePath(resolvedPath);
    const id = createModuleId(normalizedPath);

    return {
      success: true,
      module: {
        id,
        path: normalizedPath,
        version,
        exports: [], // Will be populated when AST is parsed
      },
    };
  }

  /**
   * Create an error resolution result.
   */
  private createErrorResult(
    errorCode: 'MODULE_NOT_FOUND' | 'VERSION_CONFLICT' | 'INVALID_SPECIFIER',
    specifier: string,
    triedPaths: string[]
  ): ResolutionResult {
    const messages: Record<typeof errorCode, string> = {
      MODULE_NOT_FOUND: `Cannot find module '${specifier}'`,
      VERSION_CONFLICT: `Version conflict for module '${specifier}'`,
      INVALID_SPECIFIER: `Invalid module specifier '${specifier}'`,
    };

    return {
      success: false,
      errorCode,
      errorMessage: messages[errorCode],
      triedPaths,
    };
  }

  /**
   * Normalize a file path for consistent module IDs.
   */
  private normalizePath(filePath: string): string {
    let normalized = path.resolve(filePath);

    // Follow symlinks if configured
    if (this.config.followSymlinks) {
      try {
        normalized = fs.realpathSync(normalized);
      } catch {
        // Ignore errors - file might not exist yet
      }
    }

    // Normalize separators to forward slashes
    return normalized.replace(/\\/g, '/');
  }

  /**
   * Check if a file exists.
   */
  private fileExists(filePath: string): boolean {
    try {
      const stats = fs.statSync(filePath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Check if a directory exists.
   */
  private directoryExists(dirPath: string): boolean {
    try {
      const stats = fs.statSync(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Clear the resolution cache.
   */
  clearCache(): void {
    this.resolvedCache.clear();
  }

  /**
   * Get resolution statistics (for debugging).
   */
  getStats(): { cacheSize: number; config: ResolverConfig } {
    return {
      cacheSize: this.resolvedCache.size,
      config: this.config,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a module resolver with default configuration.
 */
export function createResolver(projectRoot: string): ModuleResolver {
  return new ModuleResolver({ projectRoot });
}

/**
 * Create a module resolver for testing (with mock filesystem).
 */
export function createTestResolver(
  projectRoot: string,
  mockFs: Map<string, string>
): ModuleResolver {
  return new ModuleResolver({
    projectRoot,
    customResolver: (specifier) => {
      // Check mock filesystem
      for (const [mockPath] of mockFs) {
        if (mockPath.includes(specifier)) {
          return mockPath;
        }
      }
      return null;
    },
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract exports from a parsed domain declaration.
 */
export function extractExports(ast: {
  entities?: Array<{ name: { name: string } }>;
  behaviors?: Array<{ name: { name: string } }>;
  types?: Array<{ name: { name: string } }>;
  enums?: Array<{ name: { name: string } }>;
}): ExportedSymbol[] {
  const exports: ExportedSymbol[] = [];

  // All entities are public by default
  for (const entity of ast.entities ?? []) {
    exports.push({
      name: entity.name.name,
      kind: 'entity',
      isPublic: true,
    });
  }

  // All behaviors are public by default
  for (const behavior of ast.behaviors ?? []) {
    exports.push({
      name: behavior.name.name,
      kind: 'behavior',
      isPublic: true,
    });
  }

  // All types are public by default
  for (const type of ast.types ?? []) {
    exports.push({
      name: type.name.name,
      kind: 'type',
      isPublic: true,
    });
  }

  // All enums are public by default
  for (const enumDecl of ast.enums ?? []) {
    exports.push({
      name: enumDecl.name.name,
      kind: 'enum',
      isPublic: true,
    });
  }

  return exports;
}
