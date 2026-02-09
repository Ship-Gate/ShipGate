// ============================================================================
// Package.json Exports Resolution
// ============================================================================

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Package.json exports field structure
 */
export type PackageExports =
  | string
  | {
      [condition: string]: PackageExports;
    }
  | PackageExports[];

/**
 * Package.json structure (subset we care about)
 */
export interface PackageJson {
  name?: string;
  exports?: PackageExports;
  main?: string;
  types?: string;
  type?: 'module' | 'commonjs';
}

/**
 * Resolve a subpath import using package.json exports
 * Follows Node.js ESM resolution algorithm
 */
export async function resolvePackageExport(
  packagePath: string,
  subpath: string,
  conditions: string[] = ['import', 'types', 'default']
): Promise<string | null> {
  const packageJsonPath = path.join(packagePath, 'package.json');

  let packageJson: PackageJson;
  try {
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    packageJson = JSON.parse(content);
  } catch {
    return null;
  }

  // If no exports field, fall back to main/types
  if (!packageJson.exports) {
    if (subpath === '.') {
      // Main entry point
      if (packageJson.types) {
        return path.join(packagePath, packageJson.types);
      }
      if (packageJson.main) {
        return path.join(packagePath, packageJson.main);
      }
    }
    return null;
  }

  // Resolve using exports field
  const resolved = resolveExportsField(
    packageJson.exports,
    subpath,
    conditions,
    packagePath
  );

  return resolved;
}

/**
 * Resolve exports field recursively
 */
function resolveExportsField(
  exports: PackageExports,
  subpath: string,
  conditions: string[],
  packagePath: string
): string | null {
  // Handle array (try each export)
  if (Array.isArray(exports)) {
    for (const exp of exports) {
      const resolved = resolveExportsField(exp, subpath, conditions, packagePath);
      if (resolved) {
        return resolved;
      }
    }
    return null;
  }

  // Handle string (direct path)
  if (typeof exports === 'string') {
    return path.join(packagePath, exports);
  }

  // Handle object (conditional exports)
  if (typeof exports === 'object' && exports !== null) {
    // Try conditions in order
    for (const condition of conditions) {
      if (condition in exports) {
        const value = exports[condition];
        if (typeof value === 'string') {
          return path.join(packagePath, value);
        }
        // Recursive resolution
        const resolved = resolveExportsField(
          value as PackageExports,
          subpath,
          conditions,
          packagePath
        );
        if (resolved) {
          return resolved;
        }
      }
    }

    // Try 'default' condition
    if ('default' in exports && exports.default !== undefined) {
      const defaultValue = exports.default;
      if (typeof defaultValue === 'string') {
        return path.join(packagePath, defaultValue);
      }
      return resolveExportsField(
        defaultValue as PackageExports,
        subpath,
        conditions,
        packagePath
      );
    }
  }

  return null;
}

/**
 * Find package.json for a module path
 * Walks up from the given path to find node_modules/package-name/package.json
 */
export async function findPackageJson(
  modulePath: string,
  projectRoot: string
): Promise<{ path: string; packageJson: PackageJson } | null> {
  // Extract package name from import path
  // e.g., "lodash" or "@types/node" or "lodash/get"
  const parts = modulePath.split('/');
  let packageName: string = '';
  let subpath = '.';

  if (modulePath.startsWith('@')) {
    // Scoped package: @scope/name or @scope/name/subpath
    if (parts.length >= 2) {
      packageName = parts.slice(0, 2).join('/');
      if (parts.length > 2) {
        subpath = './' + parts.slice(2).join('/');
      }
    }
  } else {
    // Regular package: name or name/subpath
    if (parts.length > 0 && parts[0]) {
      packageName = parts[0];
      if (parts.length > 1) {
        subpath = './' + parts.slice(1).join('/');
      }
    }
  }

  if (!packageName) {
    return null;
  }

  // Search in node_modules
  let current = projectRoot;
  while (current !== path.dirname(current)) {
    const nodeModulesPath = path.join(current, 'node_modules', packageName);
    const packageJsonPath = path.join(nodeModulesPath, 'package.json');

    try {
      await fs.access(packageJsonPath);
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content) as PackageJson;
      return {
        path: nodeModulesPath,
        packageJson,
      };
    } catch {
      // Continue searching
    }

    current = path.dirname(current);
  }

  return null;
}
