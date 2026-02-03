/**
 * ISL Standard Library Import Resolver
 * 
 * Resolves ISL import statements to stdlib module files.
 * Supports both:
 * - Modern: `import { User } from "@isl/stdlib-auth"`
 * - Legacy: `use stdlib-auth`
 */

import type {
  StdlibModule,
  ResolvedImport,
  ImportResolutionError,
  ResolverOptions,
  ModuleProvides,
} from './types.js';
import {
  getModule,
  getRegistry,
  resolveDependencyTree,
} from './registry.js';

/** Default resolver options */
const DEFAULT_OPTIONS: Required<ResolverOptions> = {
  basePath: 'node_modules',
  allowMissing: false,
  registry: undefined as unknown as ReturnType<typeof getRegistry>,
};

/**
 * Parse an import path into module name and subpath
 * 
 * Examples:
 * - "@isl/stdlib-auth" -> { module: "stdlib-auth", subpath: "." }
 * - "@isl/stdlib-auth/session" -> { module: "stdlib-auth", subpath: "/session" }
 * - "stdlib-auth" -> { module: "stdlib-auth", subpath: "." }
 */
export function parseImportPath(importPath: string): {
  moduleName: string;
  subpath: string;
} | null {
  // Handle @isl/stdlib-* format
  if (importPath.startsWith('@isl/stdlib-')) {
    const withoutPrefix = importPath.slice(5); // Remove '@isl/'
    const parts = withoutPrefix.split('/');
    const moduleName = parts[0]; // 'stdlib-auth'
    const subpath = parts.length > 1 ? '/' + parts.slice(1).join('/') : '.';
    return { moduleName, subpath };
  }
  
  // Handle @isl-lang/stdlib-* format (npm package name)
  if (importPath.startsWith('@isl-lang/stdlib-')) {
    const withoutPrefix = importPath.slice(10); // Remove '@isl-lang/'
    const parts = withoutPrefix.split('/');
    const moduleName = parts[0];
    const subpath = parts.length > 1 ? '/' + parts.slice(1).join('/') : '.';
    return { moduleName, subpath };
  }
  
  // Handle stdlib-* format (short name)
  if (importPath.startsWith('stdlib-')) {
    const parts = importPath.split('/');
    const moduleName = parts[0];
    const subpath = parts.length > 1 ? '/' + parts.slice(1).join('/') : '.';
    return { moduleName, subpath };
  }
  
  return null;
}

/**
 * Check if an import path is a stdlib import
 */
export function isStdlibImport(importPath: string): boolean {
  return (
    importPath.startsWith('@isl/stdlib-') ||
    importPath.startsWith('@isl-lang/stdlib-') ||
    importPath.startsWith('stdlib-')
  );
}

/**
 * Join path segments (simple implementation without Node.js path module)
 */
function joinPath(...segments: string[]): string {
  return segments
    .map((s, i) => {
      if (i === 0) return s.replace(/\/+$/, '');
      return s.replace(/^\/+/, '').replace(/\/+$/, '');
    })
    .filter(Boolean)
    .join('/');
}

/**
 * Resolve a stdlib import to a module and file path
 */
export function resolveStdlibImport(
  importPath: string,
  options: ResolverOptions = {}
): ResolvedImport | ImportResolutionError {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Parse the import path
  const parsed = parseImportPath(importPath);
  if (!parsed) {
    return {
      code: 'INVALID_IMPORT',
      message: `Invalid stdlib import path: ${importPath}`,
      importPath,
      suggestions: ['@isl/stdlib-auth', '@isl/stdlib-payments', 'stdlib-auth'],
    };
  }
  
  const { moduleName, subpath } = parsed;
  
  // Look up the module
  const module = getModule(moduleName);
  if (!module) {
    const available = Object.keys(getRegistry().modules);
    const suggestions = available
      .filter(name => name.includes(moduleName.replace('stdlib-', '')))
      .slice(0, 3);
    
    return {
      code: 'MODULE_NOT_FOUND',
      message: `Unknown stdlib module: ${moduleName}`,
      importPath,
      suggestions: suggestions.map(s => `@isl/${s}`),
    };
  }
  
  // Resolve the subpath
  const filePath = module.exports[subpath];
  if (!filePath) {
    const availableSubpaths = Object.keys(module.exports).filter(k => k !== '.');
    return {
      code: 'SUBPATH_NOT_FOUND',
      message: `Unknown subpath '${subpath}' in module ${moduleName}`,
      importPath,
      suggestions: availableSubpaths.map(s => `@isl/${moduleName}${s}`),
    };
  }
  
  // Build the full path (if basePath provided)
  let fullPath: string | undefined;
  if (opts.basePath) {
    fullPath = joinPath(opts.basePath, module.name, filePath);
  }
  
  return {
    module,
    filePath,
    fullPath,
    provides: module.provides,
  };
}

/**
 * Resolve multiple imports and return all resolved modules
 */
export function resolveImports(
  importPaths: string[],
  options: ResolverOptions = {}
): {
  resolved: ResolvedImport[];
  errors: ImportResolutionError[];
} {
  const resolved: ResolvedImport[] = [];
  const errors: ImportResolutionError[] = [];
  
  for (const importPath of importPaths) {
    const result = resolveStdlibImport(importPath, options);
    if ('code' in result) {
      errors.push(result);
    } else {
      resolved.push(result);
    }
  }
  
  return { resolved, errors };
}

/**
 * Get all ISL file paths needed for a module and its dependencies
 */
export function getModuleFilePaths(
  moduleName: string,
  options: ResolverOptions = {}
): string[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const deps = resolveDependencyTree(moduleName);
  const paths: string[] = [];
  
  for (const dep of deps) {
    const module = getModule(dep);
    if (!module) continue;
    
    // Add the main entry point
    const entryPath = opts.basePath
      ? joinPath(opts.basePath, module.name, module.entryPoint)
      : module.entryPoint;
    paths.push(entryPath);
  }
  
  return paths;
}

/**
 * Get suggestions for an unknown import
 */
export function getSuggestions(partialImport: string): string[] {
  const registry = getRegistry();
  const lowerPartial = partialImport.toLowerCase().replace(/[@/]/g, '');
  
  const suggestions: Array<{ name: string; score: number }> = [];
  
  for (const [name, module] of Object.entries(registry.modules)) {
    let score = 0;
    
    // Check name match
    if (name.includes(lowerPartial)) {
      score += 10;
    }
    
    // Check keyword match
    for (const keyword of module.keywords) {
      if (keyword.includes(lowerPartial)) {
        score += 5;
      }
    }
    
    // Check provided symbols
    const allSymbols = [
      ...module.provides.entities,
      ...module.provides.behaviors,
      ...module.provides.enums,
      ...module.provides.types,
    ];
    
    for (const symbol of allSymbols) {
      if (symbol.toLowerCase().includes(lowerPartial)) {
        score += 3;
      }
    }
    
    if (score > 0) {
      suggestions.push({ name: `@isl/${name}`, score });
    }
  }
  
  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(s => s.name);
}

/**
 * Merge the provides from multiple resolved imports
 */
export function mergeProvides(imports: ResolvedImport[]): ModuleProvides {
  const merged: ModuleProvides = {
    entities: [],
    behaviors: [],
    enums: [],
    types: [],
  };
  
  const seen = {
    entities: new Set<string>(),
    behaviors: new Set<string>(),
    enums: new Set<string>(),
    types: new Set<string>(),
  };
  
  for (const imp of imports) {
    for (const entity of imp.provides.entities) {
      if (!seen.entities.has(entity)) {
        seen.entities.add(entity);
        merged.entities.push(entity);
      }
    }
    for (const behavior of imp.provides.behaviors) {
      if (!seen.behaviors.has(behavior)) {
        seen.behaviors.add(behavior);
        merged.behaviors.push(behavior);
      }
    }
    for (const enumItem of imp.provides.enums) {
      if (!seen.enums.has(enumItem)) {
        seen.enums.add(enumItem);
        merged.enums.push(enumItem);
      }
    }
    for (const type of imp.provides.types) {
      if (!seen.types.has(type)) {
        seen.types.add(type);
        merged.types.push(type);
      }
    }
  }
  
  return merged;
}

/**
 * Check if a module's files would exist at a given path (placeholder implementation)
 * In production, this would check the actual file system
 */
export function moduleFilesExist(
  _moduleName: string,
  _basePath = 'node_modules'
): boolean {
  // Placeholder - in production this would check fs.existsSync
  return true;
}

// Re-export types
export type { ResolvedImport, ImportResolutionError, ResolverOptions };
