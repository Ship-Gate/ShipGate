/**
 * File Writer
 *
 * Utilities for writing generated files to disk.
 */

import { writeFile, mkdir, readFile, stat, access, chmod } from 'fs/promises';
import { join, dirname, relative } from 'path';
import type { GeneratedFile } from '../types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for writing files.
 */
export interface WriteOptions {
  /** Output directory */
  outputDir: string;
  /** Overwrite existing files */
  overwrite?: boolean;
  /** Dry run (don't actually write) */
  dryRun?: boolean;
  /** Callback for each file written */
  onWrite?: (file: string, status: 'created' | 'updated' | 'skipped') => void;
  /** Create backup of existing files */
  backup?: boolean;
  /** Header to prepend to all files */
  header?: string;
  /** Footer to append to all files */
  footer?: string;
}

/**
 * Result of a write operation.
 */
export interface WriteResult {
  /** Files that were created */
  created: string[];
  /** Files that were updated */
  updated: string[];
  /** Files that were skipped */
  skipped: string[];
  /** Files that had errors */
  errors: Array<{ path: string; error: Error }>;
  /** Total bytes written */
  totalBytes: number;
}

// ============================================================================
// File Writer Class
// ============================================================================

/**
 * Utility class for writing generated files to disk.
 *
 * @example
 * ```typescript
 * const writer = new FileWriter();
 *
 * const result = await writer.writeFiles(generatedFiles, {
 *   outputDir: './generated',
 *   overwrite: true,
 *   onWrite: (file, status) => console.log(`${status}: ${file}`),
 * });
 *
 * console.log(`Created ${result.created.length} files`);
 * ```
 */
export class FileWriter {
  /**
   * Write multiple files to disk.
   *
   * @param files - Array of generated files
   * @param options - Write options
   * @returns Write result
   */
  async writeFiles(files: GeneratedFile[], options: WriteOptions): Promise<WriteResult> {
    const result: WriteResult = {
      created: [],
      updated: [],
      skipped: [],
      errors: [],
      totalBytes: 0,
    };

    for (const file of files) {
      try {
        const status = await this.writeFile(file, options);
        result[status].push(file.path);
        if (status !== 'skipped') {
          result.totalBytes += Buffer.byteLength(file.content, 'utf-8');
        }
        options.onWrite?.(file.path, status);
      } catch (error) {
        result.errors.push({
          path: file.path,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    return result;
  }

  /**
   * Write a single file to disk.
   *
   * @param file - Generated file
   * @param options - Write options
   * @returns Status of the write operation
   */
  async writeFile(
    file: GeneratedFile,
    options: WriteOptions
  ): Promise<'created' | 'updated' | 'skipped'> {
    const fullPath = join(options.outputDir, file.path);

    // Check if file exists
    const exists = await this.fileExists(fullPath);

    // Check if we should skip
    if (exists && !options.overwrite && file.overwrite !== true) {
      return 'skipped';
    }

    // Dry run
    if (options.dryRun) {
      return exists ? 'updated' : 'created';
    }

    // Create backup if requested
    if (exists && options.backup) {
      await this.createBackup(fullPath);
    }

    // Prepare content with header/footer
    let content = file.content;
    if (options.header) {
      content = options.header + '\n' + content;
    }
    if (options.footer) {
      content = content + '\n' + options.footer;
    }

    // Ensure directory exists
    await mkdir(dirname(fullPath), { recursive: true });

    // Write file
    await writeFile(fullPath, content, 'utf-8');

    // Set permissions if specified
    if (file.permissions) {
      await chmod(fullPath, parseInt(file.permissions, 8));
    }

    return exists ? 'updated' : 'created';
  }

  /**
   * Check if a file exists.
   */
  async fileExists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a backup of an existing file.
   */
  private async createBackup(path: string): Promise<void> {
    const backupPath = `${path}.bak`;
    const content = await readFile(path, 'utf-8');
    await writeFile(backupPath, content, 'utf-8');
  }

  /**
   * Compare a generated file with an existing file.
   *
   * @param file - Generated file
   * @param outputDir - Output directory
   * @returns true if files are different
   */
  async isDifferent(file: GeneratedFile, outputDir: string): Promise<boolean> {
    const fullPath = join(outputDir, file.path);

    if (!(await this.fileExists(fullPath))) {
      return true;
    }

    const existing = await readFile(fullPath, 'utf-8');
    return existing !== file.content;
  }

  /**
   * Get diff between generated and existing file.
   *
   * @param file - Generated file
   * @param outputDir - Output directory
   * @returns Diff information
   */
  async getDiff(
    file: GeneratedFile,
    outputDir: string
  ): Promise<{ exists: boolean; different: boolean; existing?: string; generated: string }> {
    const fullPath = join(outputDir, file.path);
    const exists = await this.fileExists(fullPath);

    if (!exists) {
      return {
        exists: false,
        different: true,
        generated: file.content,
      };
    }

    const existing = await readFile(fullPath, 'utf-8');
    return {
      exists: true,
      different: existing !== file.content,
      existing,
      generated: file.content,
    };
  }

  /**
   * Clean output directory (remove all generated files).
   *
   * @param files - Previously generated files
   * @param outputDir - Output directory
   * @returns List of removed files
   */
  async cleanGeneratedFiles(files: GeneratedFile[], outputDir: string): Promise<string[]> {
    const { unlink } = await import('fs/promises');
    const removed: string[] = [];

    for (const file of files) {
      const fullPath = join(outputDir, file.path);
      if (await this.fileExists(fullPath)) {
        await unlink(fullPath);
        removed.push(file.path);
      }
    }

    return removed;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a standard file header comment.
 *
 * @param options - Header options
 * @returns Header string
 */
export function createFileHeader(options: {
  generator: string;
  timestamp?: boolean;
  warning?: string;
  style?: 'js' | 'python' | 'hash';
}): string {
  const { generator, timestamp = true, warning, style = 'js' } = options;

  const lines = [];

  if (style === 'js') {
    lines.push('/**');
    lines.push(` * Generated by ${generator}`);
    if (timestamp) {
      lines.push(` * Generated at: ${new Date().toISOString()}`);
    }
    if (warning) {
      lines.push(' *');
      lines.push(` * ${warning}`);
    }
    lines.push(' */');
  } else if (style === 'python') {
    lines.push('"""');
    lines.push(`Generated by ${generator}`);
    if (timestamp) {
      lines.push(`Generated at: ${new Date().toISOString()}`);
    }
    if (warning) {
      lines.push('');
      lines.push(warning);
    }
    lines.push('"""');
  } else {
    lines.push(`# Generated by ${generator}`);
    if (timestamp) {
      lines.push(`# Generated at: ${new Date().toISOString()}`);
    }
    if (warning) {
      lines.push('#');
      lines.push(`# ${warning}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format file size for display.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
