// ============================================================================
// Workspace Detection and Resolution
// ============================================================================

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { WorkspaceInfo, PackageJson } from './types.js';

/**
 * Detect pnpm workspace configuration
 */
export async function detectWorkspace(projectRoot: string): Promise<WorkspaceInfo> {
  const workspaceRoot = await findWorkspaceRoot(projectRoot);
  const isPnpmWorkspace = workspaceRoot !== null;

  if (!isPnpmWorkspace) {
    return {
      isPnpmWorkspace: false,
      workspaceRoot: projectRoot,
      workspacePackages: [],
      packageMap: new Map(),
    };
  }

  // Read pnpm-workspace.yaml
  const workspaceYamlPath = path.join(workspaceRoot, 'pnpm-workspace.yaml');
  let workspacePatterns: string[] = ['packages/*'];

  try {
    const content = await fs.readFile(workspaceYamlPath, 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('-') || trimmed.startsWith('packages:')) {
        const match = trimmed.match(/['"]([^'"]+)['"]/);
        if (match) {
          workspacePatterns.push(match[1]!);
        }
      }
    }
  } catch {
    // Default pattern
  }

  // Find all workspace packages
  const workspacePackages: string[] = [];
  const packageMap = new Map<string, string>();

  for (const pattern of workspacePatterns) {
    // Convert glob pattern to directory
    const dirPattern = pattern.replace(/\*/g, '');
    const searchDir = path.join(workspaceRoot, dirPattern);

    try {
      const entries = await fs.readdir(searchDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const packageDir = path.join(searchDir, entry.name);
          const packageJsonPath = path.join(packageDir, 'package.json');

          try {
            const content = await fs.readFile(packageJsonPath, 'utf-8');
            const pkg = JSON.parse(content) as PackageJson;
            if (pkg.name) {
              workspacePackages.push(pkg.name);
              packageMap.set(pkg.name, packageDir);
            }
          } catch {
            // Skip packages without valid package.json
          }
        }
      }
    } catch {
      // Pattern doesn't match any directories
    }
  }

  return {
    isPnpmWorkspace: isPnpmWorkspace,
    workspaceRoot: workspaceRoot ?? projectRoot,
    workspacePackages,
    packageMap,
  };
}

/**
 * Find workspace root by looking for pnpm-workspace.yaml
 */
async function findWorkspaceRoot(startDir: string): Promise<string | null> {
  let current = path.resolve(startDir);

  while (current !== path.dirname(current)) {
    const workspaceYamlPath = path.join(current, 'pnpm-workspace.yaml');
    try {
      await fs.access(workspaceYamlPath);
      return current;
    } catch {
      // Continue searching
    }

    current = path.dirname(current);
  }

  return null;
}

/**
 * Check if a package name is a workspace package
 */
export function isWorkspacePackage(
  packageName: string,
  workspaceInfo: WorkspaceInfo
): boolean {
  return workspaceInfo.packageMap.has(packageName);
}

/**
 * Resolve workspace package path
 */
export function resolveWorkspacePackage(
  packageName: string,
  workspaceInfo: WorkspaceInfo
): string | null {
  return workspaceInfo.packageMap.get(packageName) ?? null;
}
