/**
 * ISL Studio - Path Utilities
 * 
 * Provides consistent paths for ISL Studio storage locations.
 * All paths are relative to the workspace root and stored within .vibecheck/
 */

import * as path from 'path';

/**
 * Base directory for all vibecheck storage
 */
export const VIBECHECK_DIR = '.vibecheck';

/**
 * Studio-specific subdirectory
 */
export const STUDIO_DIR = 'studio';

/**
 * State file name
 */
export const STATE_FILE = 'state.json';

/**
 * Get the full path to the .vibecheck directory
 */
export function getVibecheckDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, VIBECHECK_DIR);
}

/**
 * Get the full path to the studio directory
 */
export function getStudioDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, VIBECHECK_DIR, STUDIO_DIR);
}

/**
 * Get the full path to the state file
 */
export function getStatePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, VIBECHECK_DIR, STUDIO_DIR, STATE_FILE);
}

/**
 * Get path for temporary file (used for atomic writes)
 * @param targetPath - The target file path
 * @returns Path with .tmp extension
 */
export function getTempPath(targetPath: string): string {
  const dir = path.dirname(targetPath);
  const ext = path.extname(targetPath);
  const base = path.basename(targetPath, ext);
  const timestamp = Date.now();
  return path.join(dir, `${base}.${timestamp}.tmp${ext}`);
}

/**
 * Get backup path for a file
 * @param targetPath - The target file path
 * @returns Path with .bak extension
 */
export function getBackupPath(targetPath: string): string {
  return `${targetPath}.bak`;
}

/**
 * Path configuration interface
 */
export interface StudioPaths {
  /** Workspace root directory */
  workspaceRoot: string;
  /** .vibecheck directory */
  vibecheckDir: string;
  /** .vibecheck/studio directory */
  studioDir: string;
  /** .vibecheck/studio/state.json */
  statePath: string;
}

/**
 * Create a StudioPaths object for a workspace
 */
export function createStudioPaths(workspaceRoot: string): StudioPaths {
  return {
    workspaceRoot,
    vibecheckDir: getVibecheckDir(workspaceRoot),
    studioDir: getStudioDir(workspaceRoot),
    statePath: getStatePath(workspaceRoot),
  };
}

/**
 * Normalize a path for consistent comparison
 */
export function normalizePath(p: string): string {
  return path.normalize(p).replace(/\\/g, '/');
}

/**
 * Check if a path is within the workspace
 */
export function isWithinWorkspace(filePath: string, workspaceRoot: string): boolean {
  const normalizedFile = normalizePath(path.resolve(filePath));
  const normalizedWorkspace = normalizePath(path.resolve(workspaceRoot));
  return normalizedFile.startsWith(normalizedWorkspace);
}
