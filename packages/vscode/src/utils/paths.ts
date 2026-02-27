/**
 * Path normalization utilities
 */

import * as path from 'path';

export function normalizePath(p: string): string {
  return path.normalize(p).replace(/\\/g, '/');
}

export function joinPaths(...segments: string[]): string {
  return path.join(...segments);
}

export function resolveWorkspacePath(workspaceRoot: string, relativePath: string): string {
  return path.resolve(workspaceRoot, relativePath);
}
