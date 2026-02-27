/**
 * ISL Standard Library Registry
 * 
 * Provides access to the stdlib module registry, including:
 * - Loading and validating the registry
 * - Querying modules by name, category, or keyword
 * - Dependency resolution
 */

import type {
  StdlibRegistry,
  StdlibModule,
  CategoryInfo,
  StdlibCategory,
} from './types.js';
import { REGISTRY_DATA } from './registry-data.js';

/** The loaded registry instance */
let _registry: StdlibRegistry | null = null;

/**
 * Get the stdlib registry (lazily loaded)
 */
export function getRegistry(): StdlibRegistry {
  if (!_registry) {
    _registry = REGISTRY_DATA;
  }
  return _registry;
}

/**
 * Reset the registry cache (useful for testing)
 */
export function resetRegistryCache(): void {
  _registry = null;
}

/**
 * Get all available module names
 */
export function getModuleNames(): string[] {
  return Object.keys(getRegistry().modules);
}

/**
 * Get a module by its short name (e.g., 'stdlib-auth')
 */
export function getModule(name: string): StdlibModule | undefined {
  const registry = getRegistry();
  
  // Try direct lookup first
  if (registry.modules[name]) {
    return registry.modules[name];
  }
  
  // Try with stdlib- prefix
  if (!name.startsWith('stdlib-') && registry.modules[`stdlib-${name}`]) {
    return registry.modules[`stdlib-${name}`];
  }
  
  // Try resolving from import alias
  const aliasKey = Object.keys(registry.importAliases).find(
    alias => alias === name || alias.endsWith(`/${name}`)
  );
  if (aliasKey) {
    const moduleName = registry.importAliases[aliasKey];
    return registry.modules[moduleName];
  }
  
  return undefined;
}

/**
 * Get a module by its NPM package name (e.g., '@isl-lang/stdlib-auth')
 */
export function getModuleByPackageName(packageName: string): StdlibModule | undefined {
  const registry = getRegistry();
  return Object.values(registry.modules).find(m => m.name === packageName);
}

/**
 * Get all modules in a category
 */
export function getModulesByCategory(category: StdlibCategory): StdlibModule[] {
  const registry = getRegistry();
  return Object.values(registry.modules).filter(m => m.category === category);
}

/**
 * Get category information
 */
export function getCategory(category: string): CategoryInfo | undefined {
  return getRegistry().categories[category];
}

/**
 * Get all categories
 */
export function getCategories(): Record<string, CategoryInfo> {
  return getRegistry().categories;
}

/**
 * Search modules by keyword
 */
export function searchModules(keyword: string): StdlibModule[] {
  const registry = getRegistry();
  const lowerKeyword = keyword.toLowerCase();
  
  return Object.values(registry.modules).filter(module => {
    // Check keywords
    if (module.keywords.some(k => k.toLowerCase().includes(lowerKeyword))) {
      return true;
    }
    // Check name
    if (module.name.toLowerCase().includes(lowerKeyword)) {
      return true;
    }
    // Check description
    if (module.description.toLowerCase().includes(lowerKeyword)) {
      return true;
    }
    return false;
  });
}

/**
 * Get modules that provide a specific entity
 */
export function findModulesWithEntity(entityName: string): StdlibModule[] {
  const registry = getRegistry();
  return Object.values(registry.modules).filter(
    m => m.provides.entities.includes(entityName)
  );
}

/**
 * Get modules that provide a specific behavior
 */
export function findModulesWithBehavior(behaviorName: string): StdlibModule[] {
  const registry = getRegistry();
  return Object.values(registry.modules).filter(
    m => m.provides.behaviors.includes(behaviorName)
  );
}

/**
 * Get modules that provide a specific enum
 */
export function findModulesWithEnum(enumName: string): StdlibModule[] {
  const registry = getRegistry();
  return Object.values(registry.modules).filter(
    m => m.provides.enums.includes(enumName)
  );
}

/**
 * Get modules that provide a specific type
 */
export function findModulesWithType(typeName: string): StdlibModule[] {
  const registry = getRegistry();
  return Object.values(registry.modules).filter(
    m => m.provides.types.includes(typeName)
  );
}

/**
 * Resolve the full dependency tree for a module
 */
export function resolveDependencyTree(moduleName: string): string[] {
  const visited = new Set<string>();
  const result: string[] = [];
  
  function visit(name: string) {
    if (visited.has(name)) return;
    visited.add(name);
    
    const module = getModule(name);
    if (!module) return;
    
    // Visit dependencies first (topological order)
    for (const dep of module.dependencies) {
      visit(dep);
    }
    
    result.push(name);
  }
  
  visit(moduleName);
  return result;
}

/**
 * Get the import alias mapping
 */
export function getImportAliases(): Record<string, string> {
  return getRegistry().importAliases;
}

/**
 * Resolve an import alias to a module name
 * @param alias The import path (e.g., '@isl/stdlib-auth')
 * @returns The module short name (e.g., 'stdlib-auth') or undefined
 */
export function resolveImportAlias(alias: string): string | undefined {
  const registry = getRegistry();
  
  // Direct alias lookup
  if (registry.importAliases[alias]) {
    return registry.importAliases[alias];
  }
  
  // Check if it's a subpath import (e.g., '@isl/stdlib-auth/session')
  const basePath = alias.split('/').slice(0, 2).join('/');
  if (registry.importAliases[basePath]) {
    return registry.importAliases[basePath];
  }
  
  return undefined;
}

/**
 * Validate the registry structure
 */
export function validateRegistry(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const registry = getRegistry();
  
  // Check all modules
  for (const [name, module] of Object.entries(registry.modules)) {
    // Validate status field
    if (!module.status) {
      errors.push(`Module ${name} missing status field`);
    }
    
    // Validate dependencies exist
    for (const dep of module.dependencies) {
      if (!registry.modules[dep]) {
        errors.push(`Module ${name} depends on unknown module: ${dep}`);
      }
    }
    
    // Validate peer dependencies exist
    for (const peer of module.peerDependencies) {
      if (!registry.modules[peer]) {
        errors.push(`Module ${name} has unknown peer dependency: ${peer}`);
      }
    }
    
    // Validate category exists
    if (!registry.categories[module.category]) {
      errors.push(`Module ${name} has unknown category: ${module.category}`);
    }
    
    // For implemented modules, validate required fields
    if (module.status === 'implemented') {
      // Validate entry point is defined
      if (!module.entryPoint) {
        errors.push(`Module ${name} missing entry point`);
      }
      
      // Validate files array exists and has content
      if (!module.files || module.files.length === 0) {
        errors.push(`Module ${name} has no files`);
      }
      
      // Validate module hash exists
      if (!module.moduleHash) {
        errors.push(`Module ${name} missing module hash`);
      }
      
      // Validate each file has required fields
      for (const file of module.files || []) {
        if (!file.path) {
          errors.push(`Module ${name} has file without path`);
        }
        if (!file.contentHash) {
          errors.push(`Module ${name} has file without contentHash: ${file.path}`);
        }
      }
    }
  }
  
  // Check all categories reference valid modules
  for (const [catName, category] of Object.entries(registry.categories)) {
    for (const modName of category.modules) {
      if (!registry.modules[modName]) {
        errors.push(`Category ${catName} references unknown module: ${modName}`);
      }
    }
  }
  
  // Check all import aliases reference valid modules
  for (const [alias, moduleName] of Object.entries(registry.importAliases)) {
    if (!registry.modules[moduleName]) {
      errors.push(`Import alias ${alias} references unknown module: ${moduleName}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get registry statistics
 */
export function getRegistryStats(): {
  totalModules: number;
  totalEntities: number;
  totalBehaviors: number;
  totalEnums: number;
  totalTypes: number;
  byCategory: Record<string, number>;
} {
  const registry = getRegistry();
  const modules = Object.values(registry.modules);
  
  const stats = {
    totalModules: modules.length,
    totalEntities: 0,
    totalBehaviors: 0,
    totalEnums: 0,
    totalTypes: 0,
    byCategory: {} as Record<string, number>,
  };
  
  for (const module of modules) {
    stats.totalEntities += module.provides.entities.length;
    stats.totalBehaviors += module.provides.behaviors.length;
    stats.totalEnums += module.provides.enums.length;
    stats.totalTypes += module.provides.types.length;
    
    stats.byCategory[module.category] = (stats.byCategory[module.category] || 0) + 1;
  }
  
  return stats;
}

// Re-export types
export type { StdlibRegistry, StdlibModule, CategoryInfo, StdlibCategory };
