/**
 * @packageDocumentation
 * @isl-lang/stdlib-files/transform/temp
 */

import { promises as fs } from 'fs';
import { join, tmpdir } from 'path';
import { randomBytes } from 'crypto';
import type { FileResult } from '../types';
import { FileError, FileErrorFactory, FileErrorCode } from '../errors';

// ============================================================================
// TEMP FILE TYPES
// ============================================================================

export interface TempFileOptions {
  /** Directory for temp files (defaults to OS temp dir) */
  directory?: string;
  
  /** File extension */
  extension?: string;
  
  /** File prefix */
  prefix?: string;
  
  /** File suffix */
  suffix?: string;
  
  /** Whether to cleanup on process exit */
  cleanupOnExit?: boolean;
  
  /** Custom name (overrides random generation) */
  name?: string;
}

export interface TempFileInfo {
  /** Full path to temp file */
  path: string;
  
  /** File name */
  name: string;
  
  /** Directory */
  directory: string;
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** Whether marked for cleanup */
  markedForCleanup: boolean;
}

export interface TempCleanupOptions {
  /** Age in milliseconds after which to clean up */
  olderThan?: number;
  
  /** Pattern to match filenames */
  pattern?: RegExp;
  
  /** Dry run - don't actually delete */
  dryRun?: boolean;
}

// ============================================================================
// TEMP FILE HANDLER
// ============================================================================

export class TempFileHandler {
  private tempFiles = new Set<TempFileInfo>();
  private cleanupRegistered = false;

  constructor() {
    // Register cleanup on exit if not already done
    if (!this.cleanupRegistered) {
      process.once('exit', () => this.cleanupAll());
      process.once('SIGINT', () => this.cleanupAll());
      process.once('SIGTERM', () => this.cleanupAll());
      this.cleanupRegistered = true;
    }
  }

  /**
   * Create a temporary file
   */
  async createFile(options?: TempFileOptions): Promise<FileResult<TempFileInfo>> {
    try {
      const directory = options?.directory || tmpdir();
      const prefix = options?.prefix || 'tmp';
      const suffix = options?.suffix || '';
      const extension = options?.extension ? `.${options.extension.replace(/^\./, '')}` : '';
      
      // Ensure directory exists
      await fs.mkdir(directory, { recursive: true });
      
      // Generate filename
      let name: string;
      if (options?.name) {
        name = options.name + extension;
      } else {
        const random = randomBytes(8).toString('hex');
        name = `${prefix}-${random}${suffix}${extension}`;
      }
      
      const path = join(directory, name);
      
      // Create empty file
      await fs.writeFile(path, '');
      
      const fileInfo: TempFileInfo = {
        path,
        name,
        directory,
        createdAt: new Date(),
        markedForCleanup: options?.cleanupOnExit !== false // Default to true
      };
      
      // Track temp file
      if (fileInfo.markedForCleanup) {
        this.tempFiles.add(fileInfo);
      }
      
      return { ok: true, value: fileInfo };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Create a temporary directory
   */
  async createDirectory(options?: Omit<TempFileOptions, 'extension'>): Promise<FileResult<TempFileInfo>> {
    try {
      const directory = options?.directory || tmpdir();
      const prefix = options?.prefix || 'tmpdir';
      const suffix = options?.suffix || '';
      
      // Ensure base directory exists
      await fs.mkdir(directory, { recursive: true });
      
      // Generate directory name
      let name: string;
      if (options?.name) {
        name = options.name;
      } else {
        const random = randomBytes(8).toString('hex');
        name = `${prefix}-${random}${suffix}`;
      }
      
      const path = join(directory, name);
      
      // Create directory
      await fs.mkdir(path, { recursive: true });
      
      const fileInfo: TempFileInfo = {
        path,
        name,
        directory,
        createdAt: new Date(),
        markedForCleanup: options?.cleanupOnExit !== false
      };
      
      // Track temp directory
      if (fileInfo.markedForCleanup) {
        this.tempFiles.add(fileInfo);
      }
      
      return { ok: true, value: fileInfo };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Write to a temporary file
   */
  async writeFile(
    content: string | Buffer | NodeJS.ReadableStream,
    options?: TempFileOptions
  ): Promise<FileResult<TempFileInfo>> {
    const createResult = await this.createFile(options);
    
    if (!createResult.ok) {
      return createResult;
    }
    
    try {
      if (content instanceof Buffer || typeof content === 'string') {
        await fs.writeFile(createResult.value.path, content);
      } else {
        // Handle stream
        const { pipeline } = await import('stream/promises');
        const { createWriteStream } = await import('fs');
        const writeStream = createWriteStream(createResult.value.path);
        await pipeline(content, writeStream);
      }
      
      return { ok: true, value: createResult.value };
    } catch (error) {
      // Clean up on error
      await this.remove(createResult.value.path).catch(() => {});
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Read a temporary file
   */
  async readFile(
    path: string,
    encoding?: BufferEncoding
  ): Promise<FileResult<Buffer | string>> {
    try {
      const content = await fs.readFile(path, encoding);
      return { ok: true, value: content };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Remove a temporary file or directory
   */
  async remove(path: string): Promise<FileResult<void>> {
    try {
      const stats = await fs.stat(path);
      
      if (stats.isDirectory()) {
        await fs.rm(path, { recursive: true, force: true });
      } else {
        await fs.unlink(path);
      }
      
      // Remove from tracking
      for (const fileInfo of this.tempFiles) {
        if (fileInfo.path === path) {
          this.tempFiles.delete(fileInfo);
          break;
        }
      }
      
      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Track an existing file for cleanup
   */
  track(path: string, cleanupOnExit: boolean = true): FileResult<TempFileInfo> {
    try {
      const name = path.split(/[/\\]/).pop() || '';
      const directory = path.substring(0, path.length - name.length);
      
      const fileInfo: TempFileInfo = {
        path,
        name,
        directory,
        createdAt: new Date(),
        markedForCleanup: cleanupOnExit
      };
      
      if (cleanupOnExit) {
        this.tempFiles.add(fileInfo);
      }
      
      return { ok: true, value: fileInfo };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Untrack a file (won't be cleaned up automatically)
   */
  untrack(path: string): void {
    for (const fileInfo of this.tempFiles) {
      if (fileInfo.path === path) {
        this.tempFiles.delete(fileInfo);
        break;
      }
    }
  }

  /**
   * Get info about tracked temp files
   */
  getTrackedFiles(): TempFileInfo[] {
    return Array.from(this.tempFiles);
  }

  /**
   * Check if a path is a tracked temp file
   */
  isTracked(path: string): boolean {
    for (const fileInfo of this.tempFiles) {
      if (fileInfo.path === path) {
        return true;
      }
    }
    return false;
  }

  /**
   * Clean up all tracked temp files
   */
  async cleanupAll(): Promise<FileResult<{ removed: string[]; failed: string[] }>> {
    const removed: string[] = [];
    const failed: string[] = [];
    
    for (const fileInfo of this.tempFiles) {
      const result = await this.remove(fileInfo.path);
      if (result.ok) {
        removed.push(fileInfo.path);
      } else {
        failed.push(fileInfo.path);
      }
    }
    
    return { ok: true, value: { removed, failed } };
  }

  /**
   * Clean up old temp files in a directory
   */
  async cleanupOld(
    directory: string = tmpdir(),
    options?: TempCleanupOptions
  ): Promise<FileResult<{ removed: string[]; failed: string[]; totalSize: number }>> {
    try {
      const removed: string[] = [];
      const failed: string[] = [];
      let totalSize = 0;
      
      const entries = await fs.readdir(directory, { withFileTypes: true });
      const cutoffTime = options?.olderThan ? 
        Date.now() - options.olderThan : 
        Date.now() - (24 * 60 * 60 * 1000); // Default 24 hours
      
      for (const entry of entries) {
        const fullPath = join(directory, entry.name);
        
        // Check pattern if provided
        if (options?.pattern && !options.pattern.test(entry.name)) {
          continue;
        }
        
        try {
          const stats = await fs.stat(fullPath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            if (!options?.dryRun) {
              if (stats.isDirectory()) {
                await fs.rm(fullPath, { recursive: true, force: true });
              } else {
                await fs.unlink(fullPath);
                totalSize += stats.size;
              }
            }
            removed.push(fullPath);
          }
        } catch (error) {
          failed.push(fullPath);
        }
      }
      
      return { ok: true, value: { removed, failed, totalSize } };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Create a temporary file with a template
   */
  async createFromTemplate(
    template: string,
    variables: Record<string, string> = {},
    options?: TempFileOptions
  ): Promise<FileResult<TempFileInfo>> {
    try {
      // Replace variables in template
      let content = template;
      for (const [key, value] of Object.entries(variables)) {
        content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      }
      
      return this.writeFile(content, options);
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Move a temp file to a permanent location
   */
  async moveTo(
    tempPath: string,
    permanentPath: string
  ): Promise<FileResult<void>> {
    try {
      await fs.rename(tempPath, permanentPath);
      
      // Untrack from temp files
      this.untrack(tempPath);
      
      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Copy a temp file to a permanent location
   */
  async copyTo(
    tempPath: string,
    permanentPath: string
  ): Promise<FileResult<void>> {
    try {
      await fs.copyFile(tempPath, permanentPath);
      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }

  /**
   * Get temporary file statistics
   */
  async getStats(): Promise<FileResult<{
    totalFiles: number;
    totalSize: number;
    oldestFile?: Date;
    newestFile?: Date;
  }>> {
    try {
      let totalSize = 0;
      let oldestFile: Date | undefined;
      let newestFile: Date | undefined;
      
      for (const fileInfo of this.tempFiles) {
        try {
          const stats = await fs.stat(fileInfo.path);
          totalSize += stats.size;
          
          if (!oldestFile || stats.mtime < oldestFile) {
            oldestFile = stats.mtime;
          }
          
          if (!newestFile || stats.mtime > newestFile) {
            newestFile = stats.mtime;
          }
        } catch {
          // File might not exist, skip
        }
      }
      
      return {
        ok: true,
        value: {
          totalFiles: this.tempFiles.size,
          totalSize,
          oldestFile,
          newestFile
        }
      };
    } catch (error) {
      return { ok: false, error: FileErrorFactory.fromError(error) };
    }
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export const tempFileHandler = new TempFileHandler();

export async function createTempFile(options?: TempFileOptions): Promise<FileResult<TempFileInfo>> {
  return tempFileHandler.createFile(options);
}

export async function createTempDirectory(options?: Omit<TempFileOptions, 'extension'>): Promise<FileResult<TempFileInfo>> {
  return tempFileHandler.createDirectory(options);
}

export async function writeTempFile(
  content: string | Buffer | NodeJS.ReadableStream,
  options?: TempFileOptions
): Promise<FileResult<TempFileInfo>> {
  return tempFileHandler.writeFile(content, options);
}

export async function cleanupTempFiles(): Promise<FileResult<{ removed: string[]; failed: string[] }>> {
  return tempFileHandler.cleanupAll();
}
