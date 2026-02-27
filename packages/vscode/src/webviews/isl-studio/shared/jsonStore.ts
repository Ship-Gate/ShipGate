/**
 * ISL Studio - JSON Store
 * 
 * Provides safe, atomic JSON file storage with support for:
 * - Atomic writes (write to temp, then rename)
 * - Automatic directory creation
 * - Type-safe read/write operations
 * - Error handling with fallbacks
 */

import * as fs from 'fs';
import * as path from 'path';
import { getTempPath } from './paths';

/**
 * Options for JSON store operations
 */
export interface JsonStoreOptions {
  /** Pretty-print JSON output (default: true) */
  pretty?: boolean;
  /** Number of spaces for indentation (default: 2) */
  indent?: number;
  /** Create directories if they don't exist (default: true) */
  createDirs?: boolean;
}

const DEFAULT_OPTIONS: Required<JsonStoreOptions> = {
  pretty: true,
  indent: 2,
  createDirs: true,
};

/**
 * Read JSON from a file with type safety
 * @param filePath - Path to the JSON file
 * @param defaultValue - Default value if file doesn't exist or is invalid
 * @returns Parsed JSON or default value
 */
export async function readJson<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    // File doesn't exist or is invalid - return default
    if (isNodeError(error) && error.code === 'ENOENT') {
      return defaultValue;
    }
    // Log parse errors but return default
    if (error instanceof SyntaxError) {
      console.warn(`[JsonStore] Invalid JSON in ${filePath}: ${error.message}`);
      return defaultValue;
    }
    // Re-throw unexpected errors
    throw error;
  }
}

/**
 * Read JSON synchronously with type safety
 * @param filePath - Path to the JSON file
 * @param defaultValue - Default value if file doesn't exist or is invalid
 * @returns Parsed JSON or default value
 */
export function readJsonSync<T>(filePath: string, defaultValue: T): T {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return defaultValue;
    }
    if (error instanceof SyntaxError) {
      console.warn(`[JsonStore] Invalid JSON in ${filePath}: ${error.message}`);
      return defaultValue;
    }
    throw error;
  }
}

/**
 * Write JSON to a file atomically
 * 
 * This function writes to a temporary file first, then renames it to the target.
 * This ensures that the file is never in a partially-written state.
 * 
 * @param filePath - Target file path
 * @param data - Data to write
 * @param options - Write options
 */
export async function writeJson<T>(
  filePath: string,
  data: T,
  options: JsonStoreOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Ensure directory exists
  if (opts.createDirs) {
    const dir = path.dirname(filePath);
    await ensureDir(dir);
  }
  
  // Serialize data
  const content = opts.pretty
    ? JSON.stringify(data, null, opts.indent)
    : JSON.stringify(data);
  
  // Write atomically
  const tempPath = getTempPath(filePath);
  
  try {
    // Write to temp file
    await fs.promises.writeFile(tempPath, content, 'utf-8');
    
    // Rename temp to target (atomic on most systems)
    await fs.promises.rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file on error
    try {
      await fs.promises.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Write JSON synchronously with atomic semantics
 * 
 * @param filePath - Target file path
 * @param data - Data to write
 * @param options - Write options
 */
export function writeJsonSync<T>(
  filePath: string,
  data: T,
  options: JsonStoreOptions = {}
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  if (opts.createDirs) {
    const dir = path.dirname(filePath);
    ensureDirSync(dir);
  }
  
  const content = opts.pretty
    ? JSON.stringify(data, null, opts.indent)
    : JSON.stringify(data);
  
  const tempPath = getTempPath(filePath);
  
  try {
    fs.writeFileSync(tempPath, content, 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    try {
      fs.unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (isNodeError(error) && error.code === 'EEXIST') {
      return;
    }
    throw error;
  }
}

/**
 * Ensure a directory exists synchronously
 */
export function ensureDirSync(dirPath: string): void {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch (error) {
    if (isNodeError(error) && error.code === 'EEXIST') {
      return;
    }
    throw error;
  }
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a file exists synchronously
 */
export function fileExistsSync(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete a file if it exists
 */
export async function deleteFile(filePath: string): Promise<boolean> {
  try {
    await fs.promises.unlink(filePath);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

/**
 * Type guard for Node.js errors
 */
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

/**
 * Update JSON file with a transform function
 * Reads current value, applies transform, writes result atomically
 */
export async function updateJson<T>(
  filePath: string,
  defaultValue: T,
  transform: (current: T) => T,
  options: JsonStoreOptions = {}
): Promise<T> {
  const current = await readJson(filePath, defaultValue);
  const updated = transform(current);
  await writeJson(filePath, updated, options);
  return updated;
}
