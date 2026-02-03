// ============================================================================
// ISL Import Resolver
// 
// Resolves local module imports (./foo.isl, ../bar.isl), detects cycles,
// and bundles multi-file specs into a single AST.
// ============================================================================

import * as path from 'node:path';
import type * as AST from '@isl-lang/parser';
import { parse } from '@isl-lang/parser';
import type {
  ResolverOptions,
  BundleResult,
  ResolverError,
} from './types.js';
import { ResolverErrorCode } from './types.js';
import { ImportResolver } from './resolver.js';
import { Bundler, type BundlerOptions } from './bundler.js';
import { importsDisabledError, formatErrors, formatWarnings } from './errors.js';

// Re-export types
export * from './types.js';
export * from './errors.js';
export { ImportResolver, resolveImports } from './resolver.js';
export { Bundler, bundleModules, createEmptyBundle, type BundlerOptions } from './bundler.js';

// Stdlib registry
export {
  StdlibRegistryManager,
  getStdlibRegistry,
  createStdlibRegistry,
  resetStdlibRegistry,
  type StdlibModule,
  type StdlibRegistry,
  type ResolvedStdlibModule,
} from './stdlib-registry.js';

// Module graph builder
export {
  ModuleGraphBuilder,
  buildModuleGraph,
  getMergedAST,
  hasCircularDependencies,
  formatGraphDebug,
  type AliasedImport,
  type GraphModule,
  type ModuleGraph,
  type ModuleGraphDebug,
  type ModuleGraphOptions,
  type UseStatementSpec,
  type ASTCache,
  type ASTCacheEntry,
} from './module-graph.js';

/**
 * Options for the high-level resolve and bundle API
 */
export interface ResolveAndBundleOptions extends Partial<ResolverOptions>, BundlerOptions {
  /**
   * Source code content (if provided, entryPoint is treated as virtual file path)
   */
  source?: string;
}

/**
 * High-level API to resolve imports and bundle into a single AST
 * 
 * This is the main entry point for most use cases. It handles:
 * - Parsing the entry file
 * - Resolving all imports (if enabled)
 * - Detecting cycles
 * - Merging fragments
 * - Producing a canonical bundled AST
 * 
 * MVP Mode Toggle:
 * - Set `enableImports: false` to disable import resolution
 * - When disabled, any import statements will produce an explicit error
 *   explaining that the system is in single-file mode
 * 
 * @example
 * ```typescript
 * // Single file mode (MVP mode - imports disabled)
 * const result = await resolveAndBundle('./spec.isl', {
 *   enableImports: false,
 * });
 * 
 * // Multi-file mode (imports enabled)
 * const result = await resolveAndBundle('./main.isl', {
 *   enableImports: true,
 *   basePath: './specs',
 * });
 * ```
 */
export async function resolveAndBundle(
  entryPoint: string,
  options: ResolveAndBundleOptions = {}
): Promise<BundleResult> {
  const {
    source,
    enableImports = true,
    basePath = path.dirname(entryPoint),
    allowShadowing,
    stripImports,
    bundleDomainName,
    bundleVersion,
    ...resolverOptions
  } = options;

  // If source is provided, use virtual file system
  let virtualFS: Map<string, string> | undefined;
  if (source !== undefined) {
    virtualFS = new Map([[path.resolve(basePath, entryPoint), source]]);
  }

  // Create resolver
  const resolver = new ImportResolver({
    basePath,
    enableImports,
    ...resolverOptions,
    ...(virtualFS && {
      readFile: async (filePath: string) => {
        const content = virtualFS!.get(filePath);
        if (content === undefined) {
          throw new Error(`File not found: ${filePath}`);
        }
        return content;
      },
      fileExists: async (filePath: string) => virtualFS!.has(filePath),
    }),
  });

  // Resolve imports
  const resolveResult = await resolver.resolve(entryPoint);
  
  if (!resolveResult.success || !resolveResult.graph) {
    return {
      success: false,
      errors: resolveResult.errors,
      warnings: [],
    };
  }

  // Bundle the resolved modules
  const bundler = new Bundler({
    allowShadowing,
    stripImports,
    bundleDomainName,
    bundleVersion,
  });

  return bundler.bundle(resolveResult.graph);
}

/**
 * Parse a single file without import resolution (MVP single-file mode)
 * 
 * Use this when you want to parse a single ISL file and explicitly
 * reject any imports. This is the "gated" mode where imports are not supported.
 * 
 * @example
 * ```typescript
 * const result = parseSingleFile(source, 'spec.isl');
 * if (!result.success) {
 *   console.error(formatErrors(result.errors));
 * }
 * ```
 */
export function parseSingleFile(
  source: string,
  filename: string = 'input.isl'
): BundleResult {
  // Parse the source
  const parseResult = parse(source, filename);
  
  if (!parseResult.success || !parseResult.domain) {
    return {
      success: false,
      errors: parseResult.errors.map(e => ({
        code: ResolverErrorCode.PARSE_ERROR,
        message: e.message,
        path: filename,
        location: e.location,
      })),
      warnings: [],
    };
  }

  const ast = parseResult.domain;

  // Check for imports - they are not allowed in single-file mode
  if (ast.imports.length > 0) {
    const errors: ResolverError[] = ast.imports.map(imp => 
      importsDisabledError(imp.from.value, imp.location)
    );
    
    return {
      success: false,
      errors,
      warnings: [],
    };
  }

  // Return the parsed AST as a "bundle" of one file
  return {
    success: true,
    bundle: ast,
    errors: [],
    warnings: [],
  };
}

/**
 * Check if a source file has imports
 * 
 * Useful for determining whether to use single-file or multi-file mode.
 */
export function hasImports(source: string, filename: string = 'input.isl'): boolean {
  const parseResult = parse(source, filename);
  if (!parseResult.success || !parseResult.domain) {
    return false;
  }
  return parseResult.domain.imports.length > 0;
}

/**
 * Normalize path for consistent cross-platform handling
 */
function normalizePath(p: string): string {
  // Normalize and convert backslashes to forward slashes for consistent handling
  return path.normalize(p).replace(/\\/g, '/');
}

/**
 * Create a virtual file system for testing
 */
export function createVirtualFS(
  files: Record<string, string>,
  basePath: string = '/virtual'
): {
  readFile: (path: string) => Promise<string>;
  fileExists: (path: string) => Promise<boolean>;
} {
  const normalizedFiles = new Map<string, string>();
  
  for (const [filePath, content] of Object.entries(files)) {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(basePath, filePath);
    normalizedFiles.set(normalizePath(absolutePath), content);
  }

  return {
    readFile: async (filePath: string) => {
      const normalized = normalizePath(filePath);
      const content = normalizedFiles.get(normalized);
      if (content === undefined) {
        throw new Error(`File not found: ${normalized}`);
      }
      return content;
    },
    fileExists: async (filePath: string) => {
      return normalizedFiles.has(normalizePath(filePath));
    },
  };
}

/**
 * Validate import paths in a source file
 * 
 * Returns validation errors without actually resolving imports.
 * Useful for IDE/LSP integration.
 */
export function validateImportPaths(
  source: string,
  filename: string = 'input.isl'
): {
  valid: boolean;
  errors: Array<{
    importPath: string;
    reason: string;
    location: AST.SourceLocation;
  }>;
} {
  const parseResult = parse(source, filename);
  
  if (!parseResult.success || !parseResult.domain) {
    return { valid: true, errors: [] };
  }

  const errors: Array<{
    importPath: string;
    reason: string;
    location: AST.SourceLocation;
  }> = [];

  for (const imp of parseResult.domain.imports) {
    const importPath = imp.from.value;
    
    // Check for valid relative path
    if (!importPath.startsWith('./') && !importPath.startsWith('../')) {
      errors.push({
        importPath,
        reason: 'Import path must be relative (start with "./" or "../")',
        location: imp.location,
      });
      continue;
    }

    // Check for invalid characters
    if (/[<>:"|?*]/.test(importPath)) {
      errors.push({
        importPath,
        reason: 'Import path contains invalid characters',
        location: imp.location,
      });
    }

    // Check for empty segments
    if (importPath.includes('//') || importPath.endsWith('/')) {
      errors.push({
        importPath,
        reason: 'Import path has empty segments',
        location: imp.location,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Default export for convenience
export default {
  resolveAndBundle,
  parseSingleFile,
  hasImports,
  createVirtualFS,
  validateImportPaths,
  ImportResolver,
  Bundler,
  formatErrors,
  formatWarnings,
};
